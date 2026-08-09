/**
 * The stack-up smoke query (§9.5, job 3).
 *
 * It asserts that migrate → seed → read actually works end to end, which is what catches
 * migration drift, seed drift and `derived.json` contract drift together. It prints
 * **assertions, never rows** — Actions logs on a public repo are world-readable.
 */

import { sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import {
  countListableContributors,
  getProgrammeBySlug,
  getShelfFacetCounts,
  listLeaderboard,
  listSectors,
  listShelf,
} from '@/lib/db/queries'
import { programme } from '@/lib/db/schema'

const db = getDb()
let failures = 0

function assert(label: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`  ok    ${label}`)
  } else {
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
    failures++
  }
}

async function main() {
  console.log('Smoke query against the local stack')

  const sectors = await listSectors(db)
  assert('the eight sector rows are seeded', sectors.length === 8, `saw ${sectors.length}`)

  const shelf = await listShelf(db, {})
  assert('the shelf returns rows', shelf.length > 0, `saw ${shelf.length}`)
  assert('a shelf page is capped at 25', shelf.length <= 25, `saw ${shelf.length}`)

  const first = shelf[0]
  assert('a shelf row carries its card payload', Boolean(first?.card))
  assert(
    'a shelf row carries its DCMA denominator',
    first?.checks_applicable != null,
    'checks_applicable was null',
  )
  assert(
    'the default order is newest first, never vote-weighted',
    shelf.every((row, i) => i === 0 || row.created_at <= shelf[i - 1]!.created_at),
  )

  const facets = await getShelfFacetCounts(db, {})
  assert('facet counts pre-fill all eight sectors', Object.keys(facets.sector).length === 8)
  assert('facet counts pre-fill all four size bands', Object.keys(facets.size).length === 4)

  if (first?.slug) {
    const [programme] = await getProgrammeBySlug(db, first.slug)
    assert('a programme resolves by slug', Boolean(programme), first.slug)
  }

  const leaderboard = await listLeaderboard(db)
  assert('the leaderboard returns contributors', leaderboard.length > 0)
  assert('the leaderboard is one page of at most 100', leaderboard.length <= 100)

  const contributors = await countListableContributors(db)
  assert(
    'the contributor total is countable',
    typeof contributors === 'number' || contributors != null,
  )

  // A pending, failed or tombstoned programme must be invisible to the shelf **for free**, via
  // the grid's inner join on `current_revision_id` — with no status predicate anywhere (§2.10).
  // The seed plants one `failed` row and two tombstones so this has something to be true about.
  const [{ total = 0 } = {}] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(programme)
  assert(
    'unpublished and tombstoned programmes are excluded from the shelf',
    (shelf[0]?.total_count ?? 0) < total,
    `shelf reports ${shelf[0]?.total_count} of ${total} programme rows`,
  )

  console.log(failures === 0 ? '\nSmoke query passed.' : `\n${failures} smoke assertion(s) failed.`)
  if (failures > 0) process.exit(1)
}

await main()
