/**
 * The read queries behind the four public surfaces: the shelf (§6.2, §6.3), the programme
 * page (§6.7), the contributor page (§6.10) and the leaderboard (§6.11).
 *
 * They live here rather than in the pages so that the shelf's grid and its facet counts are
 * built from **one set of predicate helpers**. A facet count computed from a second, prose
 * copy of the WHERE clause is the bug this file exists to make impossible.
 *
 * Two shapes of export, and the difference is deliberate:
 *
 * - `list…` / `get…` returning a Drizzle query object. It is thenable — `await` it — and it
 *   is also inspectable with `.toSQL()` without a server, which is what the tests do.
 *   Single-row readers still return a builder, so callers destructure: `const [row] = await
 *   getProgrammeBySlug(db, slug)`.
 * - `…Query(): SQL` plus an `async get…` beside it, for the three statements Drizzle's
 *   builder cannot express (a `FILTER`-aggregate union, a window over an aggregate, and a
 *   recursive CTE). The `SQL` builder is what the tests read.
 */

import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  lte,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import { alias, type PgTable } from 'drizzle-orm/pg-core'
import {
  LEADERBOARD_LIMIT,
  type ProgrammeStatus,
  SECTORS,
  type SectorCode,
  SHELF_PAGE_SIZE,
  SIZE_BANDS,
  type SizeBandCode,
} from '@/lib/contracts/domain'
import type { Db } from './client'
import { appUser, bookmark, programme, programmeVote, revision, sectorTable } from './schema'

// --- the shelf --------------------------------------------------------------

export interface ShelfFilters {
  /** OR within the facet. The eight seeded codes; there is no `sector=none` (§1.6). */
  sector?: readonly SectorCode[]
  size?: readonly SizeBandCode[]
  p6?: readonly string[]
  /** Presence-only. Absent means no constraint. */
  progressed?: boolean
  /** Free text. Switches the default ordering to relevance (§6.3). */
  q?: string
}

/** `new` is the frozen default and is never vote-weighted (§6.3). */
export type ShelfSort = 'new' | 'votes' | 'size' | 'dcma' | 'relevance'

export interface ShelfQuery extends ShelfFilters {
  sort?: ShelfSort
  /** 1-based. Offset pagination, because that is what makes `page=3` a real URL (§6.3). */
  page?: number
  /** Set by `/u/{handle}`, which renders the same rows scoped to one uploader (§6.10). */
  ownerUserId?: string
}

/**
 * What the shelf never shows (§6.3).
 *
 * The inner join on `current_revision_id` is doing half the work by itself: a **pending**
 * Programme has a null pointer and an inner join drops nulls, so it is invisible here for
 * free. The two status equalities exist for the other half — tombstones, which keep a
 * current revision because their page stays at its URL forever.
 */
function publishedOnly(): SQL {
  return and(eq(programme.status, 'published'), eq(revision.status, 'published')) as SQL
}

function ownerScope(ownerUserId: string | undefined): SQL | undefined {
  return ownerUserId ? eq(programme.owner_user_id, ownerUserId) : undefined
}

function sectorPredicate(codes: readonly SectorCode[] | undefined): SQL | undefined {
  return codes?.length ? inArray(programme.sector, [...codes]) : undefined
}

/**
 * Size bands come from `SIZE_BANDS` rather than being written out here, so the boundary the
 * facet counts and the boundary the size chips render can never drift apart. The `xl` band's
 * upper edge is infinite, which is why the `lte` half is conditional.
 */
function sizePredicate(bands: readonly SizeBandCode[] | undefined): SQL | undefined {
  if (!bands?.length) return undefined
  const parts = bands.flatMap((code) => {
    const band = SIZE_BANDS.find((b) => b.code === code)
    if (!band) return []
    const lower = gte(revision.activity_count, band.min)
    return [
      Number.isFinite(band.max)
        ? (and(lower, lte(revision.activity_count, band.max)) as SQL)
        : lower,
    ]
  })
  return parts.length ? or(...parts) : undefined
}

function p6Predicate(versions: readonly string[] | undefined): SQL | undefined {
  return versions?.length ? inArray(revision.p6_version, [...versions]) : undefined
}

function progressedPredicate(on: boolean | undefined): SQL | undefined {
  return on ? gt(revision.pct_complete, 0) : undefined
}

/**
 * Title and description only, `websearch_to_tsquery` against the generated `search_tsv`
 * (§6.3). Activity names, WBS names, activity codes, the uploader Handle and file contents
 * are all deliberately outside it.
 */
function searchPredicate(q: string | undefined): SQL | undefined {
  const term = q?.trim()
  if (!term) return undefined
  return sql`${programme.search_tsv} @@ websearch_to_tsquery('english', ${term})`
}

/** Relevance is the active option whenever `q` is set and no explicit `sort` overrides it. */
export function effectiveShelfSort(opts: ShelfQuery): ShelfSort {
  if (opts.sort) return opts.sort
  return opts.q?.trim() ? 'relevance' : 'new'
}

/**
 * The frozen default order, and the tiebreak every other option ends with.
 *
 * It is appended to the named sorts as well, and that is not decoration: offset pagination
 * over a non-unique sort key has no defined row order, so `page=2` may repeat a row from
 * `page=1`. `(created_at, id)` is unique, so appending it makes every ordering total.
 */
function defaultOrder(): SQL[] {
  return [desc(programme.created_at), desc(programme.id)]
}

function shelfOrderBy(opts: ShelfQuery): SQL[] {
  const term = opts.q?.trim()
  switch (effectiveShelfSort(opts)) {
    case 'votes':
      return [desc(programme.vote_count), ...defaultOrder()]
    case 'size':
      return [sql`${revision.activity_count} desc nulls last`, ...defaultOrder()]
    case 'dcma':
      // The ratio, never the raw count: applicable varies from 10 without a baseline to 14
      // with, so counts compare different denominators. The tiebreak on `checks_applicable`
      // means 10/10 out of 14 outranks 10/10 out of 10, because more was actually tested.
      return [
        sql`(${revision.checks_passed}::numeric / nullif(${revision.checks_applicable}, 0)) desc nulls last`,
        sql`${revision.checks_applicable} desc nulls last`,
        ...defaultOrder(),
      ]
    case 'relevance':
      return [
        sql`ts_rank(${programme.search_tsv}, websearch_to_tsquery('english', ${term ?? ''})) desc`,
        ...defaultOrder(),
      ]
    default:
      return defaultOrder()
  }
}

function shelfWhere(opts: ShelfQuery): SQL {
  return and(
    publishedOnly(),
    ownerScope(opts.ownerUserId),
    searchPredicate(opts.q),
    sectorPredicate(opts.sector),
    sizePredicate(opts.size),
    p6Predicate(opts.p6),
    progressedPredicate(opts.progressed),
  ) as SQL
}

/**
 * A table-qualified column reference, e.g. `"app_user"."id"`.
 *
 * Drizzle drops the table qualifier from a column rendered inside a single-table select
 * list, which is harmless until the fragment is a **correlated subquery**: an unqualified
 * `id` inside `select … from programme where owner_user_id = id` binds to `programme.id`,
 * not to the outer row, and the query then returns a plausible wrong number rather than an
 * error. Every outer reference inside a subquery below goes through this.
 */
function qualified(table: PgTable, column: { name: string }): SQL {
  return sql`${table}.${sql.identifier(column.name)}`
}

/** The parent Programme, for slot 2's `forked from X`. A left join on a primary key. */
const parentProgramme = alias(programme, 'parent_programme')
/** The parent Revision, for the programme page's `forked from X at rN, by {handle}`. */
const parentRevision = alias(revision, 'parent_revision')

/**
 * The shelf grid — **one query**, 25 rows of 12 fixed slots, zero blob reads and no per-row
 * aggregate (§6.4). Every graphic comes from `revision.card`.
 *
 * `total_count` rides along as a window function rather than as a second `count(*)`: the
 * page prints `142 programmes · page 1 of 6`, which is itself a fact the browser wants, and
 * a window function keeps that inside the one query.
 */
export function listShelf(db: Db, opts: ShelfQuery = {}) {
  const page = Math.max(1, Math.trunc(opts.page ?? 1))
  return db
    .select({
      programme_id: programme.id,
      slug: programme.slug,
      title: programme.title,
      sector: programme.sector,
      vote_count: programme.vote_count,
      created_at: programme.created_at,
      revision_id: revision.id,
      rev_no: revision.rev_no,
      uploaded_at: revision.uploaded_at,
      uploader_display_name: revision.uploader_display_name,
      p6_version: revision.p6_version,
      activity_count: revision.activity_count,
      start_date: revision.start_date,
      finish_date: revision.finish_date,
      data_date: revision.data_date,
      pct_complete: revision.pct_complete,
      checks_passed: revision.checks_passed,
      checks_applicable: revision.checks_applicable,
      card: revision.card,
      parent_slug: parentProgramme.slug,
      parent_title: parentProgramme.title,
      total_count: sql<number>`cast(count(*) over () as integer)`,
    })
    .from(programme)
    .innerJoin(revision, eq(revision.id, programme.current_revision_id))
    .leftJoin(parentProgramme, eq(parentProgramme.id, programme.parent_programme_id))
    .where(shelfWhere(opts))
    .orderBy(...shelfOrderBy(opts))
    .limit(SHELF_PAGE_SIZE)
    .offset((page - 1) * SHELF_PAGE_SIZE)
}

export type ShelfRow = Awaited<ReturnType<typeof listShelf>>[number]

/**
 * The `pg_trgm` fallback, run **only when full-text returns zero rows** (§6.3), so one
 * stemmed miss ("depot" vs "depots") gives a did-you-mean instead of an empty shelf. It
 * returns candidate titles, not rows: the caller offers them, it does not silently swap
 * them into the grid.
 */
export function suggestTitles(db: Db, q: string, limit = 5) {
  return db
    .select({
      slug: programme.slug,
      title: programme.title,
      similarity: sql<number>`similarity(${programme.title}, ${q})`,
    })
    .from(programme)
    .innerJoin(revision, eq(revision.id, programme.current_revision_id))
    .where(and(publishedOnly(), sql`${programme.title} % ${q}`))
    .orderBy(sql`similarity(${programme.title}, ${q}) desc`)
    .limit(limit)
}

// --- the facet counts -------------------------------------------------------

export interface ShelfFacetCounts {
  /** Every seeded code, present at 0 when the current filters exclude it. */
  sector: Record<SectorCode, number>
  size: Record<SizeBandCode, number>
  /** The version strings present in the catalogue — a *can I use this* filter. */
  p6: Record<string, number>
  progressed: number
}

/**
 * The size band as a value, built from `SIZE_BANDS` so the grouping and `sizePredicate`
 * cannot disagree.
 *
 * **Every literal here is `sql.raw`, and the upper bounds have to be.** The band codes are raw
 * because a bound parameter in a `case … then` arm has no inferable type in Postgres. The
 * *bounds* are raw for a sharper reason: this expression is rendered twice in one statement,
 * once in the select list and once in `group by`, and Drizzle numbers bound parameters
 * sequentially across the whole statement — so the two copies would carry `$3, $4, $5` and
 * `$8, $9, $10`. Postgres matches a grouping expression to a select expression structurally,
 * two different `Param` nodes are not the same node, and the statement is rejected with
 * *"column revision.activity_count must appear in the GROUP BY clause"* — an error that names
 * the column rather than the parameters and sends you looking in the wrong place entirely.
 *
 * Both come from a frozen const and never from a URL, so neither is an injection surface.
 */
const sizeBandExpression: SQL = sql.join(
  [
    sql`case`,
    ...SIZE_BANDS.filter((b) => Number.isFinite(b.max)).map(
      (b) =>
        sql`when ${revision.activity_count} <= ${sql.raw(String(b.max))} then ${sql.raw(`'${b.code}'`)}`,
    ),
    sql`else ${sql.raw(`'${SIZE_BANDS[SIZE_BANDS.length - 1]?.code}'`)} end`,
  ],
  sql` `,
)

/**
 * Live conjunctive facet counts (§6.3): each value is counted against the current WHERE
 * clause **minus that facet's own predicate**, because otherwise selecting "rail" makes
 * every other sector read zero.
 *
 * That is what the `filter` clauses do. The outer WHERE carries only what is not a facet —
 * the status gate, the owner scope — so each branch can add back exactly the three other
 * facets. It is one extra query per shelf render and does not touch the grid's one-query
 * rule.
 */
export function shelfFacetCountsQuery(opts: ShelfQuery = {}): SQL {
  const q = searchPredicate(opts.q)
  const sectorP = sectorPredicate(opts.sector)
  const sizeP = sizePredicate(opts.size)
  const p6P = p6Predicate(opts.p6)
  const progP = progressedPredicate(opts.progressed)

  const others = (...parts: (SQL | undefined)[]): SQL => and(q, ...parts) ?? sql`true`

  const source = sql`
    from ${programme}
    inner join ${revision} on ${revision.id} = ${programme.current_revision_id}
    where ${and(publishedOnly(), ownerScope(opts.ownerUserId))}`

  return sql`
    select 'sector' as facet, ${programme.sector} as value,
           cast(count(*) filter (where ${others(sizeP, p6P, progP)}) as integer) as n
    ${source} and ${programme.sector} is not null
    group by ${programme.sector}
    union all
    select 'size' as facet, ${sizeBandExpression} as value,
           cast(count(*) filter (where ${others(sectorP, p6P, progP)}) as integer) as n
    ${source} and ${revision.activity_count} is not null
    group by ${sizeBandExpression}
    union all
    select 'p6' as facet, ${revision.p6_version} as value,
           cast(count(*) filter (where ${others(sectorP, sizeP, progP)}) as integer) as n
    ${source} and ${revision.p6_version} is not null
    group by ${revision.p6_version}
    union all
    select 'progressed' as facet, '1' as value,
           cast(count(*) filter (where ${others(sectorP, sizeP, p6P)} and ${gt(revision.pct_complete, 0)}) as integer) as n
    ${source}`
}

/** `& Record<string, unknown>` only satisfies `db.execute`'s constraint on a raw result. */
type FacetCountRow = { facet: string; value: string | null; n: number } & Record<string, unknown>

/**
 * Zero-count values render **disabled, not hidden**, so the seeded sector codes and the four
 * size bands are pre-filled at 0 here rather than left for each caller to remember. A
 * control list that shrinks as you filter jumps under the cursor.
 */
export async function getShelfFacetCounts(
  db: Db,
  opts: ShelfQuery = {},
): Promise<ShelfFacetCounts> {
  const sector = Object.fromEntries(SECTORS.map((s) => [s.code, 0])) as Record<SectorCode, number>
  const size = Object.fromEntries(SIZE_BANDS.map((b) => [b.code, 0])) as Record<
    SizeBandCode,
    number
  >
  const counts: ShelfFacetCounts = { sector, size, p6: {}, progressed: 0 }

  const result = await db.execute<FacetCountRow>(shelfFacetCountsQuery(opts))
  for (const row of result.rows) {
    const n = Number(row.n)
    if (row.facet === 'progressed') counts.progressed = n
    else if (row.value == null) continue
    else if (row.facet === 'sector') counts.sector[row.value as SectorCode] = n
    else if (row.facet === 'size') counts.size[row.value as SizeBandCode] = n
    else if (row.facet === 'p6') counts.p6[row.value] = n
  }
  return counts
}

/** The eight chips, in `sort_order` — transport → vertical → utilities → process (§1.6). */
export function listSectors(db: Db) {
  return db
    .select({
      code: sectorTable.code,
      label: sectorTable.label,
      sort_order: sectorTable.sort_order,
    })
    .from(sectorTable)
    .orderBy(asc(sectorTable.sort_order))
}

// --- the programme page -----------------------------------------------------

/**
 * `/p/{slug}` at its current revision.
 *
 * The revision join is a **left** join and no status is filtered, because this reader serves
 * three different answers: a published page, a tombstoned page — which stays at its URL
 * forever (§2.11) — and a 404 for anything unpublished. Deciding between them is the route's
 * job; hiding rows here would make the tombstoned page unreachable.
 */
export function getProgrammeBySlug(db: Db, slug: string) {
  return db
    .select({
      id: programme.id,
      slug: programme.slug,
      title: programme.title,
      description: programme.description,
      sector: programme.sector,
      owner_user_id: programme.owner_user_id,
      licence: programme.licence,
      status: programme.status,
      vote_count: programme.vote_count,
      created_at: programme.created_at,
      root_programme_id: programme.root_programme_id,
      parent_programme_id: programme.parent_programme_id,
      parent_revision_id: programme.parent_revision_id,
      parent_slug: parentProgramme.slug,
      parent_title: parentProgramme.title,
      parent_rev_no: parentRevision.rev_no,
      parent_uploader_display_name: parentRevision.uploader_display_name,
      revision: revision,
    })
    .from(programme)
    .leftJoin(revision, eq(revision.id, programme.current_revision_id))
    .leftJoin(parentProgramme, eq(parentProgramme.id, programme.parent_programme_id))
    .leftJoin(parentRevision, eq(parentRevision.id, programme.parent_revision_id))
    .where(eq(programme.slug, slug))
    .limit(1)
}

export type ProgrammePageRow = Awaited<ReturnType<typeof getProgrammeBySlug>>[number]

/** `/p/{slug}/r/{rev_no}`. A planner says "rev 12", not a uuid (§2.11). */
export function getRevisionByNo(db: Db, slug: string, revNo: number) {
  return db
    .select({ revision: revision })
    .from(revision)
    .innerJoin(programme, eq(programme.id, revision.programme_id))
    .where(and(eq(programme.slug, slug), eq(revision.rev_no, revNo)))
    .limit(1)
}

/** The revision selector: `r23 — current`, newest first. Tombstoned entries stay listed. */
export function listRevisions(db: Db, programmeId: string) {
  return db
    .select({
      id: revision.id,
      rev_no: revision.rev_no,
      uploaded_at: revision.uploaded_at,
      status: revision.status,
      removal_class: revision.removal_class,
      change_note: revision.change_note,
      uploader_display_name: revision.uploader_display_name,
    })
    .from(revision)
    .where(eq(revision.programme_id, programmeId))
    .orderBy(desc(revision.rev_no))
}

/**
 * The lineage line's three numbers: *N revisions · N forks of this · N in the family*.
 *
 * `family_count` is one indexed equality on `root_programme_id` rather than a walk, which is
 * exactly why that column is denormalised — a recursive CTE could not do it inside the
 * one-query rule (§2.11).
 */
export function getLineageCounts(db: Db, programmeId: string, rootProgrammeId: string) {
  return db
    .select({
      revision_count: sql<number>`cast((
        select count(*) from ${revision}
        where ${qualified(revision, revision.programme_id)} = ${programmeId}
          and ${qualified(revision, revision.status)} <> 'tombstoned'
      ) as integer)`,
      fork_count: sql<number>`cast((
        select count(*) from ${programme}
        where ${qualified(programme, programme.parent_programme_id)} = ${programmeId}
      ) as integer)`,
      family_count: sql<number>`cast((
        select count(*) from ${programme}
        where ${qualified(programme, programme.root_programme_id)} = ${rootProgrammeId}
      ) as integer)`,
    })
    .from(sql`(select 1) as one`)
}

export type AncestorRow = {
  id: string
  slug: string
  title: string
  status: ProgrammeStatus
  depth: number
} & Record<string, unknown>

/**
 * Ancestry is a parent pointer plus a **recursive CTE** — no materialised path, no closure
 * table (§2.11). Lineage is strictly a tree with no merge in v1 and Forks never re-parent,
 * so the walk terminates and a materialised path would be write-once; it is a safe pure
 * cache to add later if lineage ever gets hot.
 *
 * Depth 0 is the Programme itself and is dropped, so the result is the chain above it,
 * nearest parent first. A tombstoned ancestor stays in the chain and renders "withdrawn by
 * uploader" there.
 */
export function ancestorsQuery(programmeId: string): SQL {
  return sql`
    with recursive ancestry as (
      select p.id, p.slug, p.title, p.status, p.parent_programme_id, 0 as depth
      from ${programme} p
      where p.id = ${programmeId}
      union all
      select parent.id, parent.slug, parent.title, parent.status, parent.parent_programme_id,
             a.depth + 1
      from ancestry a
      join ${programme} parent on parent.id = a.parent_programme_id
    )
    select id, slug, title, status, depth from ancestry where depth > 0 order by depth`
}

export async function getAncestors(db: Db, programmeId: string): Promise<AncestorRow[]> {
  const result = await db.execute<AncestorRow>(ancestorsQuery(programmeId))
  return result.rows
}

// --- the contributor page and the leaderboard -------------------------------

/**
 * The eligibility gate (§6.11), written once and used by all three of its consumers: the
 * board's ranking, the contributor page's count, and `/u/{handle}`'s indexability — a
 * contributor with zero of these drops from the sitemap and gains `noindex` (§6.10).
 *
 * `current_revision_id is not null` is the pending half of it: a Programme mid-ingest is
 * `published` in `status` and has no current revision yet, exactly as on the shelf.
 */
const listableProgramme: SQL = and(
  eq(programme.status, 'published'),
  isNotNull(programme.current_revision_id),
) as SQL

/**
 * `/u/{handle}` — public, identical for every viewer.
 *
 * The fork count is a live `count(*)` over Programmes whose parent Revision belongs to a
 * Programme this user owns. It is **never denormalised and never ranked on**: the grid
 * refused a fork counter because it needs every number denormalised for its one-query rule,
 * and a single-contributor page does not pay that cost (§6.10).
 */
export function getContributorByHandle(db: Db, handle: string) {
  return db
    .select({
      id: appUser.id,
      display_name: appUser.display_name,
      uploader_vote_count: appUser.uploader_vote_count,
      created_at: appUser.created_at,
      published_programme_count: sql<number>`cast((
        select count(*) from ${programme}
        where ${qualified(programme, programme.owner_user_id)} = ${qualified(appUser, appUser.id)}
          and ${listableProgramme}
      ) as integer)`,
      fork_count: sql<number>`cast((
        select count(*) from ${programme} fork
        join ${revision} pr on pr.id = fork.parent_revision_id
        join ${programme} parent on parent.id = pr.programme_id
        where parent.owner_user_id = ${qualified(appUser, appUser.id)}
      ) as integer)`,
    })
    .from(appUser)
    .where(eq(appUser.display_name, handle))
    .limit(1)
}

export type ContributorRow = Awaited<ReturnType<typeof getContributorByHandle>>[number]

/** The contributor's published Programmes, as shelf rows, in the shelf's order (§6.10). */
export function listContributorProgrammes(db: Db, ownerUserId: string, page = 1) {
  return listShelf(db, { ownerUserId, page })
}

export interface LeaderboardRow {
  id: string
  display_name: string
  uploader_vote_count: number
  published_programme_count: number
}

/**
 * `/contributors` — one page, top 100, no pagination and no query parameters (§10.7).
 *
 * ```
 * order by uploader_vote_count desc, published_programme_count desc, handle
 * ```
 *
 * Nothing is summed, weighted, blended or tuned: a Programme is votable and an uploader is
 * votable, separately, and the board reads the uploader counter alone. The inner join plus
 * the group by *is* the eligibility gate — an uploader with zero published, non-tombstoned
 * Programmes produces no row, keeps their votes, and relists by publishing again.
 */
export function listLeaderboard(db: Db, limit = LEADERBOARD_LIMIT) {
  return db
    .select({
      id: appUser.id,
      display_name: appUser.display_name,
      uploader_vote_count: appUser.uploader_vote_count,
      published_programme_count: sql<number>`cast(count(${programme.id}) as integer)`,
    })
    .from(appUser)
    .innerJoin(programme, and(eq(programme.owner_user_id, appUser.id), listableProgramme))
    .groupBy(appUser.id, appUser.display_name, appUser.uploader_vote_count)
    .orderBy(
      desc(appUser.uploader_vote_count),
      sql`count(${programme.id}) desc`,
      asc(appUser.display_name),
    )
    .limit(limit)
}

/** The plain line stating how many contributors exist in total (§10.7). */
export function countListableContributors(db: Db) {
  return db
    .select({ total: sql<number>`cast(count(distinct ${programme.owner_user_id}) as integer)` })
    .from(programme)
    .where(and(listableProgramme, isNotNull(programme.owner_user_id)))
}

/**
 * The rank line on a contributor page (§6.10), by the board's rule and no other. `rank()` is
 * safe here rather than `row_number()` because the Handle is the third key and is unique, so
 * the ordering is total and no two contributors ever share a rank.
 */
export function contributorRankQuery(userId: string): SQL {
  return sql`
    with ranked as (
      select ${appUser.id} as id,
             rank() over (
               order by ${appUser.uploader_vote_count} desc,
                        count(${programme.id}) desc,
                        ${appUser.display_name}
             ) as rank
      from ${appUser}
      join ${programme} on ${programme.owner_user_id} = ${appUser.id} and ${listableProgramme}
      group by ${appUser.id}, ${appUser.display_name}, ${appUser.uploader_vote_count}
    )
    select cast(rank as integer) as rank from ranked where id = ${userId}`
}

/** Null when the contributor is delisted by the eligibility gate. */
export async function getContributorRank(db: Db, userId: string): Promise<number | null> {
  const result = await db.execute<{ rank: number } & Record<string, unknown>>(
    contributorRankQuery(userId),
  )
  const row = result.rows[0]
  return row ? Number(row.rank) : null
}

// --- the sitemap ------------------------------------------------------------

export interface SitemapSource {
  /** Drives the sitemap's own `lastmod`; null on an empty catalogue. */
  newestUploadAt: Date | null
  programmes: { slug: string; uploadedAt: Date }[]
  contributors: { handle: string }[]
}

/**
 * Everything `/sitemap.xml` lists (§7.16): every published `/p/{slug}` and every listable
 * `/u/{handle}`, plus the six static routes the route itself owns.
 *
 * It reuses `listableProgramme` rather than restating the predicate, which is the same
 * discipline the facet counts follow: a second prose copy of "what counts as published" is
 * exactly how a tombstoned programme ends up advertised to a crawler.
 */
export async function sitemapSource(db: Db): Promise<SitemapSource> {
  const programmes = await db
    .select({ slug: programme.slug, uploadedAt: revision.uploaded_at })
    .from(programme)
    .innerJoin(revision, eq(revision.id, programme.current_revision_id))
    .where(listableProgramme)
    .orderBy(desc(revision.uploaded_at))

  const contributors = await db
    .selectDistinct({ handle: appUser.display_name })
    .from(appUser)
    .innerJoin(programme, and(eq(programme.owner_user_id, appUser.id), listableProgramme))
    .orderBy(asc(appUser.display_name))

  return {
    newestUploadAt: programmes[0]?.uploadedAt ?? null,
    programmes,
    contributors,
  }
}

// --- the signed-in user's own space (§6.12) ---------------------------------

/**
 * `/me/bookmarks` and `/me/votes` render **shelf rows**, not a reduced line (§6.12), so both
 * read the same twelve-slot projection the grid does. The two queries below exist rather than
 * a parameter on `listShelf` because their ordering is the *join table's* `created_at` — the
 * order you saved things in, not the order they were published in — which is a different
 * fact wearing the same column name.
 *
 * The inner join on `current_revision_id` drops a programme still mid-ingest for free, and a
 * tombstoned one with it, exactly as on the shelf and with no status predicate anywhere.
 */
function ownSpaceRows(db: Db, joined: PgTable, page: number) {
  return db
    .select({
      programme_id: programme.id,
      slug: programme.slug,
      title: programme.title,
      sector: programme.sector,
      vote_count: programme.vote_count,
      created_at: programme.created_at,
      revision_id: revision.id,
      rev_no: revision.rev_no,
      uploaded_at: revision.uploaded_at,
      uploader_display_name: revision.uploader_display_name,
      p6_version: revision.p6_version,
      activity_count: revision.activity_count,
      start_date: revision.start_date,
      finish_date: revision.finish_date,
      data_date: revision.data_date,
      pct_complete: revision.pct_complete,
      checks_passed: revision.checks_passed,
      checks_applicable: revision.checks_applicable,
      card: revision.card,
      parent_slug: parentProgramme.slug,
      parent_title: parentProgramme.title,
      total_count: sql<number>`cast(count(*) over () as integer)`,
    })
    .from(joined)
    .innerJoin(programme, eq(programme.id, sql`${joined}.programme_id`))
    .innerJoin(revision, eq(revision.id, programme.current_revision_id))
    .leftJoin(parentProgramme, eq(parentProgramme.id, programme.parent_programme_id))
    .limit(SHELF_PAGE_SIZE)
    .offset((Math.max(1, Math.trunc(page)) - 1) * SHELF_PAGE_SIZE)
}

/** Ordered `bookmark.created_at desc` — the order you saved them in (§6.12). */
export function listBookmarkedProgrammes(db: Db, userId: string, page = 1) {
  return ownSpaceRows(db, bookmark, page)
    .where(and(eq(bookmark.user_id, userId), publishedOnly()))
    .orderBy(desc(bookmark.created_at))
}

/** Ordered `programme_vote.created_at desc`. The Handles you upvoted are a separate list. */
export function listVotedProgrammes(db: Db, userId: string, page = 1) {
  return ownSpaceRows(db, programmeVote, page)
    .where(and(eq(programmeVote.voter_user_id, userId), publishedOnly()))
    .orderBy(desc(programmeVote.created_at))
}
