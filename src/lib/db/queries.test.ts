/**
 * The read queries, checked by rendering them.
 *
 * Nothing here needs a server: a Drizzle builder is inspectable with `.toSQL()` and a raw
 * `SQL` fragment with `PgDialect.sqlToQuery()`. What is asserted is the handful of clauses
 * the spec fixes by name — the frozen order, the ratio sort, the inner join that hides
 * pending rows, the eligibility gate, and the facet counts' minus-its-own-predicate rule.
 */

import { drizzle } from 'drizzle-orm/neon-http'
import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { LEADERBOARD_LIMIT, SHELF_PAGE_SIZE, SIZE_BANDS } from '@/lib/contracts/domain'
import * as queries from './queries'
import * as schema from './schema'

const db = drizzle.mock({ schema })
const dialect = new PgDialect()

/** Collapses the whitespace the raw fragments are formatted with. */
const flat = (s: string): string => s.replace(/\s+/g, ' ').trim()

const shelf = (opts: queries.ShelfQuery = {}) => queries.listShelf(db, opts).toSQL()
const facets = (opts: queries.ShelfQuery = {}) =>
  dialect.sqlToQuery(queries.shelfFacetCountsQuery(opts))

describe('the shelf grid', () => {
  it('is one query: an inner join onto the current revision, no subselect per row', () => {
    const { sql } = shelf()
    expect(sql).toContain(
      'inner join "revision" on "revision"."id" = "programme"."current_revision_id"',
    )
    // `forked from X` names a programme, so the parent joins in rather than being fetched.
    expect(sql).toContain('left join "programme" "parent_programme"')
    expect(sql.match(/select /g)).toHaveLength(1)
  })

  it('reads the card column and no blob', () => {
    expect(shelf().sql).toContain('"revision"."card"')
  })

  it('prints its own result count from a window function, not a second count(*)', () => {
    expect(shelf().sql).toContain('cast(count(*) over () as integer)')
  })

  it('orders by created_at desc, id desc and nothing else by default', () => {
    const { sql } = shelf()
    expect(sql).toContain('order by "programme"."created_at" desc, "programme"."id" desc')
    expect(sql).not.toContain('vote_count" desc')
  })

  it('pages at 25 by offset, so page=3 is a real URL', () => {
    expect(shelf({ page: 3 }).params).toContain(SHELF_PAGE_SIZE)
    expect(shelf({ page: 3 }).params).toContain(2 * SHELF_PAGE_SIZE)
    expect(shelf().sql).not.toContain('offset')
  })

  it('clamps a nonsense page rather than emitting a negative offset', () => {
    expect(shelf({ page: 0 }).sql).not.toContain('offset')
    expect(shelf({ page: -4 }).sql).not.toContain('offset')
  })

  it('ends every named sort with the frozen order, so offset pagination is stable', () => {
    for (const sort of ['votes', 'size', 'dcma'] as const) {
      expect(shelf({ sort }).sql, sort).toContain(
        '"programme"."created_at" desc, "programme"."id" desc',
      )
    }
  })

  it('sorts DCMA on the ratio and tiebreaks on the denominator, never on the raw count', () => {
    const { sql } = shelf({ sort: 'dcma' })
    expect(sql).toContain(
      'order by ("revision"."checks_passed"::numeric / nullif("revision"."checks_applicable", 0)) desc nulls last, "revision"."checks_applicable" desc nulls last',
    )
  })

  it('switches to relevance when q is set, and lets an explicit sort override it', () => {
    expect(queries.effectiveShelfSort({ q: 'depot' })).toBe('relevance')
    expect(queries.effectiveShelfSort({ q: 'depot', sort: 'votes' })).toBe('votes')
    expect(queries.effectiveShelfSort({ q: '   ' })).toBe('new')
    expect(shelf({ q: 'depot' }).sql).toContain('order by ts_rank(')
    expect(shelf({ q: 'depot', sort: 'votes' }).sql).toContain('order by "programme"."vote_count"')
  })

  it('searches title and description only, through websearch_to_tsquery', () => {
    const { sql, params } = shelf({ q: 'depot' })
    expect(sql).toContain(
      '"programme"."search_tsv" @@ websearch_to_tsquery(\'english\', $', // parameterised term
    )
    expect(params).toContain('depot')
  })

  it('ORs within a facet and ANDs across facets', () => {
    const { sql, params } = shelf({ sector: ['rail', 'highways'], size: ['l'], progressed: true })
    expect(sql).toContain('"programme"."sector" in ($')
    expect(sql).toContain('"revision"."activity_count" >=')
    expect(sql).toContain('"revision"."pct_complete" >')
    expect(params).toEqual(expect.arrayContaining(['rail', 'highways', 2000, 5000]))
  })

  it('leaves the xl band open-ended, since its upper edge is infinite', () => {
    const { sql, params } = shelf({ size: ['xl'] })
    expect(params).toContain(5001)
    expect(sql).not.toContain('<= ')
  })

  it('applies no facet predicate at all when a facet is absent or empty', () => {
    const bare = shelf().sql
    expect(shelf({ sector: [], size: [], p6: [], progressed: false }).sql).toBe(bare)
  })

  it('scopes to one uploader for the contributor page, in the shelf order', () => {
    const own = queries.listContributorProgrammes(db, 'user-1').toSQL()
    expect(own.sql).toContain('"programme"."owner_user_id" = $')
    expect(own.sql).toContain('order by "programme"."created_at" desc, "programme"."id" desc')
  })
})

describe('the trigram fallback', () => {
  it('matches on the % operator and ranks by similarity, so the GIN index is usable', () => {
    const { sql } = queries.suggestTitles(db, 'depots').toSQL()
    expect(sql).toContain('"programme"."title" % $')
    expect(sql).toContain('order by similarity("programme"."title", $')
  })
})

describe('the facet counts', () => {
  it('counts each facet against the filters minus its own predicate', () => {
    const { sql } = facets({ sector: ['rail'], p6: ['19.12'], progressed: true })
    const [sectorBranch, sizeBranch] = flat(sql).split(' union all ')

    // The sector branch must not carry the sector predicate, or picking "rail" would make
    // every other sector read zero — the exact trap the conjunctive rule exists to avoid.
    expect(sectorBranch).not.toContain('"programme"."sector" in')
    expect(sectorBranch).toContain('"revision"."p6_version" in')
    expect(sectorBranch).toContain('"revision"."pct_complete" >')

    // Every other branch keeps it.
    expect(sizeBranch).toContain('"programme"."sector" in')
  })

  it('leaves the value list catalogue-wide: the outer where carries no facet predicate', () => {
    const { sql } = facets({ sector: ['rail'] })
    for (const branch of flat(sql).split(' union all ')) {
      const where = branch.slice(branch.indexOf(' where '))
      expect(where).not.toContain('"programme"."sector" in')
    }
  })

  it('emits exactly four branches — sector, size, p6, progressed', () => {
    const branches = flat(facets().sql).split(' union all ')
    expect(branches).toHaveLength(4)
    expect(branches[0]).toContain("'sector' as facet")
    expect(branches[1]).toContain("'size' as facet")
    expect(branches[2]).toContain("'p6' as facet")
    expect(branches[3]).toContain("'progressed' as facet")
  })

  it('derives the size bands from SIZE_BANDS rather than restating the edges', () => {
    const { sql, params } = facets()
    expect(flat(sql)).toContain("then 's' when")
    // The edges are inlined, not bound. They have to be: the expression is rendered twice in
    // one statement and Postgres matches the `group by` copy to the select copy structurally,
    // which two differently-numbered parameters defeat. Asserted in full below.
    for (const band of SIZE_BANDS.filter((b) => Number.isFinite(b.max))) {
      expect(flat(sql)).toContain(`<= ${band.max}`)
    }
    expect(params).not.toEqual(expect.arrayContaining([499, 1999, 5000]))
  })

  it('is a separate query, so the grid keeps its one-query rule', () => {
    expect(facets().sql).not.toContain('limit')
  })
})

describe('the programme page', () => {
  it('left-joins the current revision, so a tombstoned page still resolves', () => {
    const { sql } = queries.getProgrammeBySlug(db, 'riverside-depot').toSQL()
    expect(sql).toContain(
      'left join "revision" on "revision"."id" = "programme"."current_revision_id"',
    )
    expect(sql).not.toContain('"programme"."status" = $')
  })

  it('joins the parent revision, which is what the lineage line names', () => {
    const { sql } = queries.getProgrammeBySlug(db, 's').toSQL()
    expect(sql).toContain('left join "revision" "parent_revision"')
    expect(sql).toContain('"parent_revision"."rev_no"')
  })

  it('addresses a revision by rev_no under its programme slug, never by uuid', () => {
    const { sql } = queries.getRevisionByNo(db, 'riverside-depot', 12).toSQL()
    expect(sql).toContain('"programme"."slug" = $')
    expect(sql).toContain('"revision"."rev_no" = $')
  })

  it('lists revisions newest first, tombstoned ones included', () => {
    const { sql } = queries.listRevisions(db, 'p').toSQL()
    expect(sql).toContain('order by "revision"."rev_no" desc')
    expect(sql).not.toContain('"revision"."status" =')
  })

  it('gets the family in one indexed equality on root_programme_id, not a walk', () => {
    const { sql } = queries.getLineageCounts(db, 'p', 'root').toSQL()
    expect(sql).toContain('"programme"."root_programme_id" =')
    expect(sql).not.toContain('recursive')
  })

  it('qualifies every correlated reference, so a subquery cannot bind its own column', () => {
    const { sql } = queries.getLineageCounts(db, 'p', 'root').toSQL()
    expect(sql).toContain('"revision"."programme_id" = $')
    expect(sql).toContain('"programme"."parent_programme_id" = $')
  })

  it('walks ancestry with a recursive CTE and drops the programme itself', () => {
    const { sql } = dialect.sqlToQuery(queries.ancestorsQuery('p'))
    expect(flat(sql)).toContain('with recursive ancestry as')
    expect(flat(sql)).toContain('where depth > 0 order by depth')
  })
})

describe('the contributor page and the leaderboard', () => {
  it('applies one eligibility gate: published, with a current revision', () => {
    const gate = '"programme"."status" = $1 and "programme"."current_revision_id" is not null'
    expect(queries.listLeaderboard(db).toSQL().sql).toContain(gate)
    expect(flat(dialect.sqlToQuery(queries.contributorRankQuery('u')).sql)).toContain(gate)
    expect(queries.countListableContributors(db).toSQL().sql).toContain(gate)
  })

  it('correlates the contributor counts to app_user, not to programme.id', () => {
    const { sql } = queries.getContributorByHandle(db, 'planner-a1b2c3').toSQL()
    expect(sql).toContain('"programme"."owner_user_id" = "app_user"."id"')
    expect(sql).toContain('where parent.owner_user_id = "app_user"."id"')
  })

  it('counts forks live, and holds no denormalised fork column to read instead', () => {
    const { sql } = queries.getContributorByHandle(db, 'x').toSQL()
    expect(sql).toContain('join "revision" pr on pr.id = fork.parent_revision_id')
    expect(sql).not.toContain('fork_count"')
  })

  it('ranks by uploader votes, then published count, then handle — nothing blended', () => {
    const { sql, params } = queries.listLeaderboard(db).toSQL()
    expect(sql).toContain(
      'order by "app_user"."uploader_vote_count" desc, count("programme"."id") desc, "app_user"."display_name" asc',
    )
    expect(params).toContain(LEADERBOARD_LIMIT)
  })

  it('delists a contributor with zero published programmes via the inner join', () => {
    expect(queries.listLeaderboard(db).toSQL().sql).toContain('inner join "programme"')
  })

  it('gives a rank with no ties, because the Handle is the third key', () => {
    const { sql } = dialect.sqlToQuery(queries.contributorRankQuery('u'))
    expect(flat(sql)).toContain('rank() over ( order by "app_user"."uploader_vote_count" desc')
    expect(flat(sql)).toContain('"app_user"."display_name" )')
  })
})

describe('the sector chips', () => {
  it('reads the lookup table in sort_order, not alphabetically', () => {
    expect(queries.listSectors(db).toSQL().sql).toContain('order by "sector"."sort_order" asc')
  })
})

describe('the size-band expression is rendered twice in one statement', () => {
  /**
   * It appears in the select list and again in `group by`, and Postgres matches the two
   * structurally. A bound parameter breaks that match — Drizzle numbers parameters
   * sequentially across the statement, so the two copies would carry different placeholders
   * and Postgres would reject the statement complaining about `revision.activity_count`,
   * which is not where the fault is. This is the regression guard for that.
   */
  it('carries no bound parameter, so both renderings are textually identical', () => {
    const { sql: text } = facets()
    const cases = text.match(/case\s+when[\s\S]*?end/g) ?? []
    expect(cases).toHaveLength(2)
    expect(cases[0]).toBe(cases[1])
    expect(cases[0]).not.toContain('$')
  })

  it('takes its bounds from SIZE_BANDS rather than restating them', () => {
    const { sql: text } = facets()
    for (const band of SIZE_BANDS.filter((b) => Number.isFinite(b.max))) {
      expect(text).toContain(`<= ${band.max} then '${band.code}'`)
    }
  })
})
