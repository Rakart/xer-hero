import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { EmptyState } from '@/components/shelf/EmptyState'
import { activeFilterLabels } from '@/components/shelf/empty-state'
import { FilterBar } from '@/components/shelf/FilterBar'
import { HomeLede } from '@/components/shelf/HomeLede'
import { Pager } from '@/components/shelf/Pager'
import controls from '@/components/shelf/ShelfControls.module.css'
import { ShelfGrid, SingleResultNote } from '@/components/shelf/ShelfGrid'
import { ActiveFilters, ResultCount, SortControl } from '@/components/shelf/ShelfToolbar'
import { loadEmptyShelfExtras, loadShelfPage } from '@/components/shelf/shelf-data'
import {
  isBareShelf,
  parseShelfParams,
  type ShelfParams,
  shelfHref,
} from '@/components/shelf/shelf-url'
import { PageShell } from '@/components/site'

/**
 * `/` — **the shelf, and the homepage** (§6.2, §6.3).
 *
 * It renders the row grid directly: full catalogue, filter bar, sort control. No hero, no
 * curated strips, no separate `/browse` route. The composed-homepage alternative — Featured
 * / Newest / Most-forked strips — was rejected because launch stock is authored sector
 * templates: the whole shelf is two or three screens, and a strip of five is a worse view
 * of the same rows.
 *
 * **The default order is frozen and never becomes vote-weighted.** Recently-updated loses
 * because a Programme is new once and updated forever. Quality loses because DCMA inverts —
 * a real live contract fails check 7 at 69% negative float while a clean authored template
 * passes by construction. Operator-set rank loses because it is curation. That ordering
 * lives in the query layer, which is the only place it can be true of both the grid and its
 * count.
 *
 * Dynamic, because the page reads `searchParams`. There is no page TTL and none is wanted:
 * the two Postgres queries behind it are cached for 60 s instead, so the database sees at
 * most one shelf query a minute at any traffic and the render is CPU-only (§6.4).
 */
export const dynamic = 'force-dynamic'

type RawSearchParams = Record<string, string | string[] | undefined>

/**
 * §7.16.3, and the two governing rules are worth restating because swapping them is the
 * bug: **a URL emits a canonical pointing elsewhere, or a `noindex`, never both**; and
 * **`Disallow` and `noindex` are mirror instruments and are never used together**.
 *
 * - bare `/` and `/?page=N` self-canonicalise, including the `?page=N`.
 * - **Any facet, `q` or `sort` URL emits no canonical and no robots meta at all.** Those
 *   URLs are `Disallow`ed in `robots.txt`, and a directive on a URL a crawler is forbidden
 *   to fetch is the classic contradiction. The absence is deliberate and has a CI
 *   assertion behind it — this function returning `{}` is that absence.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}): Promise<Metadata> {
  const params = parseShelfParams(await searchParams)
  if (isFiltered(params)) return {}
  return { alternates: { canonical: shelfHref(params) } }
}

/** Any of the six `SHELF_QUERY_PARAMS`; `page` is not one of them, on purpose. */
function isFiltered(params: ShelfParams): boolean {
  return (
    params.sector.length > 0 ||
    params.size.length > 0 ||
    params.p6.length > 0 ||
    params.progressed ||
    params.q !== '' ||
    params.sort !== null
  )
}

/** What a non-bare shelf is a page of. `sort` is not a filter and does not name the set. */
function shelfHeading(params: ShelfParams): string {
  const labels = activeFilterLabels(params)
  const subject = labels.length > 0 ? `Programmes: ${labels.join(', ')}` : 'All programmes'
  return params.page > 1 ? `${subject} — page ${params.page}` : subject
}

export default async function ShelfPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const raw = await searchParams
  const params = parseShelfParams(raw)

  // `?page=1` **308s** to the canonical URL, which omits it (§7.16.3). The specified
  // mechanism is a `next.config` redirect with a query matcher, so that it costs no
  // Function invocation; `next.config.ts` is not this surface's file, and the same
  // contract enforced in the page is the fallback that makes the URL rule true either way.
  // The same branch catches `page=0`, `page=-3` and `page=cheese`, all of which parse to 1.
  if (raw.page !== undefined && params.page === 1) permanentRedirect(shelfHref(params))

  const { rows, total, counts } = await loadShelfPage(params)

  // A page past the last one **404s**. Zero rows beyond page 1 is exactly that condition,
  // and reading it off the grid query costs no second statement: the window count is 0 on
  // an empty page, so it cannot distinguish the two — the page number can.
  if (params.page > 1 && rows.length === 0) notFound()

  const bare = isBareShelf(params)
  const extras = rows.length === 0 ? await loadEmptyShelfExtras(params) : null
  const now = new Date()

  return (
    <PageShell width="wide">
      {/* The lede renders at the canonical bare `/` **only** — never on a filtered variant,
          never on page 2 — and is identical for every viewer, signed in or out (§7.13). */}
      {/* Every other variant still needs an `h1`, and the filter state is what it is about.
          It is drawn off-screen rather than printed: the active-filter chips already say the
          same thing on the page, in a form you can click. */}
      {bare ? <HomeLede /> : <h1 className={controls.srOnly}>{shelfHeading(params)}</h1>}

      <FilterBar params={params} counts={counts} />

      <div className={controls.toolbar}>
        <ResultCount total={total} page={params.page} />
        <SortControl params={params} />
      </div>

      <ActiveFilters params={params} />

      {rows.length === 0 && extras ? (
        <EmptyState
          params={params}
          counts={counts}
          relaxed={extras.relaxed}
          suggestions={extras.suggestions}
        />
      ) : (
        <>
          <ShelfGrid rows={rows} now={now} />
          {rows.length === 1 && rows[0] ? <SingleResultNote row={rows[0]} /> : null}
          <Pager params={params} total={total} />
        </>
      )}
    </PageShell>
  )
}
