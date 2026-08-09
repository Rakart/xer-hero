import { unstable_cache } from 'next/cache'
import { LEADERBOARD_LIMIT } from '@/lib/contracts/domain'
import { getDb } from '@/lib/db/client'
import {
  countListableContributors,
  getContributorByHandle,
  getContributorRank,
  getShelfFacetCounts,
  listLeaderboard,
  listShelf,
  type ShelfFacetCounts,
  type ShelfQuery,
  suggestTitles,
} from '@/lib/db/queries'
import type { ShelfRowData } from './ShelfRow'
import type { ShelfParams } from './shelf-url'

/**
 * Every read behind the shelf, the contributor page and the leaderboard, with its cache.
 *
 * **The shelf render issues two Postgres queries** (§6.4): the grid's one query — 25 rows ×
 * 12 fixed slots, zero blob reads, no per-row aggregate — and the facet-count query. Both
 * are wrapped in `unstable_cache` at **60 s**, so the render is CPU-only and the database
 * sees at most one shelf query a minute at any traffic. A new upload therefore reaches the
 * shelf within 60 seconds, which is a courtesy to everybody else: the uploader's own path
 * never goes through the shelf, and under a frozen newest-first order a minute's lag moves
 * exactly one row.
 *
 * The per-viewer join is **not** one of the two. It moved off this request onto
 * `GET /api/viewer` (§6.13), which restores the one-query rule rather than bending it.
 *
 * A cached value comes back JSON-serialised, so the two `timestamptz` columns arrive as
 * strings on every read but the first — which is why {@link ShelfRowData} widens them.
 */

const SHELF_TTL = 60
/** `/contributors` is one page, no query params, and ISR at an hour (§6.1, §10.7). */
const BOARD_TTL = 3600

/**
 * Whether a database is configured at all.
 *
 * `/contributors` is the one prerendered route here, and §4.8's dev tier 1 is a checkout
 * with neither Clerk keys nor a running stack — the same condition the root layout guards
 * `<ClerkProvider>` against. Without this a `pnpm build` on a fresh clone fails on a page
 * whose entire content is a database read.
 */
function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

/**
 * Configured is not the same as reachable, and the difference is a build that fails.
 *
 * `.env.example` ships a working `DATABASE_URL` and the documented first step is to copy it,
 * so the common state of a fresh clone is a URL that is set and a Postgres that is not yet
 * running — `docker compose up` is a separate step and may be several minutes away. The
 * presence check above passes, the prerender connects, and `pnpm build` dies on a page whose
 * only content is a leaderboard.
 *
 * So the **prerendered** board tolerates an unreachable database and comes back empty. It is
 * ISR at an hour, so the first request after the stack is up repopulates it.
 *
 * The shelf itself deliberately does **not** get this treatment: `/` is server-rendered on
 * demand, and a 500 naming the connection failure is the honest answer there. Swallowing it
 * would turn "the database is down" into "nobody has uploaded anything", which is the worse
 * of the two lies.
 */
async function tolerateUnreachable<T>(read: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await read()
  } catch {
    return empty
  }
}

/** The URL's shape, as the query layer's shape. Empty lists are absent, not empty. */
export function toShelfQuery(params: ShelfParams, ownerUserId?: string): ShelfQuery {
  return {
    sector: params.sector.length > 0 ? params.sector : undefined,
    size: params.size.length > 0 ? params.size : undefined,
    p6: params.p6.length > 0 ? params.p6 : undefined,
    progressed: params.progressed || undefined,
    q: params.q || undefined,
    // `undefined` rather than `'new'`: it is what lets `effectiveShelfSort` hand the
    // ordering to relevance while `q` is set, which is the same rule the sort control draws.
    sort: params.sort ?? undefined,
    page: params.page,
    ownerUserId,
  }
}

const cachedGrid = unstable_cache(
  async (query: ShelfQuery): Promise<ShelfRowData[]> =>
    (await listShelf(getDb(), query)) as ShelfRowData[],
  ['shelf-grid'],
  { revalidate: SHELF_TTL },
)

const cachedFacets = unstable_cache(
  async (query: ShelfQuery): Promise<ShelfFacetCounts> => getShelfFacetCounts(getDb(), query),
  ['shelf-facets'],
  { revalidate: SHELF_TTL },
)

export interface ShelfRowsData {
  rows: ShelfRowData[]
  /** From the grid query's window function, so the count costs no second statement. */
  total: number
}

export interface ShelfPageData extends ShelfRowsData {
  counts: ShelfFacetCounts
}

/**
 * The grid query alone. `/u/{handle}` renders the same rows scoped to one uploader and has
 * no filter bar, so it must not pay for facet counts nothing on the page draws (§6.10).
 */
export async function loadShelfRows(
  params: ShelfParams,
  ownerUserId?: string,
): Promise<ShelfRowsData> {
  const rows = await cachedGrid(toShelfQuery(params, ownerUserId))
  return { rows, total: rows[0]?.total_count ?? 0 }
}

export async function loadShelfPage(
  params: ShelfParams,
  ownerUserId?: string,
): Promise<ShelfPageData> {
  const query = toShelfQuery(params, ownerUserId)
  const [rows, counts] = await Promise.all([cachedGrid(query), cachedFacets(query)])
  return { rows, total: rows[0]?.total_count ?? 0, counts }
}

const cachedSuggestions = unstable_cache(
  async (q: string) => suggestTitles(getDb(), q),
  ['shelf-suggest'],
  { revalidate: SHELF_TTL },
)

export interface EmptyShelfExtras {
  /** The facet counts with the progress filter dropped — the empty state's one reason. */
  relaxed: ShelfFacetCounts | null
  suggestions: { slug: string; title: string }[]
}

/**
 * The two extra reads a **zero-row** shelf is allowed, and neither runs on any other path.
 *
 * The `pg_trgm` did-you-mean is §6.3's own exception: it runs only when full-text returns
 * zero rows. The relaxed facet counts are what let the empty state say *why* — "Marine has
 * 2 programmes and none of them is progressed" is not derivable from the conjunctive counts
 * the filter bar already has, because those keep the progress predicate in every branch.
 */
export async function loadEmptyShelfExtras(
  params: ShelfParams,
  ownerUserId?: string,
): Promise<EmptyShelfExtras> {
  const [relaxed, suggestions] = await Promise.all([
    params.progressed
      ? cachedFacets(toShelfQuery({ ...params, progressed: false }, ownerUserId))
      : Promise.resolve(null),
    params.q ? cachedSuggestions(params.q) : Promise.resolve([]),
  ])
  return { relaxed, suggestions: suggestions.map(({ slug, title }) => ({ slug, title })) }
}

// --- the contributor page and the leaderboard -------------------------------

const cachedContributor = unstable_cache(
  async (handle: string) => {
    const [row] = await getContributorByHandle(getDb(), handle)
    return row ?? null
  },
  ['contributor'],
  { revalidate: SHELF_TTL },
)

/** `/u/{handle}` — public, identical for every viewer, `null` when the Handle is unknown. */
export async function loadContributor(handle: string) {
  return cachedContributor(handle)
}

const cachedRank = unstable_cache(
  async (userId: string) => getContributorRank(getDb(), userId),
  ['contributor-rank'],
  { revalidate: SHELF_TTL },
)

/** The rank line, by the board's rule and no other. `null` means delisted by the gate. */
export async function loadContributorRank(userId: string): Promise<number | null> {
  return cachedRank(userId)
}

export interface LeaderboardData {
  rows: {
    id: string
    display_name: string
    uploader_vote_count: number
    published_programme_count: number
  }[]
  /** How many contributors exist in total — the plain line §10.7 asks for. */
  total: number
}

const cachedBoard = unstable_cache(
  async (): Promise<LeaderboardData> => {
    const db = getDb()
    const [rows, [totals]] = await Promise.all([
      listLeaderboard(db, LEADERBOARD_LIMIT),
      countListableContributors(db),
    ])
    return { rows, total: totals?.total ?? 0 }
  },
  ['leaderboard'],
  { revalidate: BOARD_TTL },
)

export async function loadLeaderboard(): Promise<LeaderboardData> {
  if (!hasDatabase()) return { rows: [], total: 0 }
  return tolerateUnreachable(cachedBoard, { rows: [], total: 0 })
}
