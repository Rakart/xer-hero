/**
 * The shelf's URL: parse it, canonicalise it, build it (§6.3, §7.16).
 *
 * **One filter state has exactly one URL.** Omit any param at its default; fixed param
 * order as tabled; lowercase values; comma-separated multi-select, never repeated keys;
 * multi-select values sorted. Bare `/` is the default shelf.
 *
 * Every URL on the shelf — a facet chip, a sort option, an active-filter chip's clear
 * control, a page link — is built by {@link shelfHref} rather than by string concatenation
 * at the call site, because the canonical form is the only form and one hand-built link is
 * how a second one appears.
 *
 * The parse is deliberately **tolerant** and the build is **strict**: a link somebody
 * typed, or a stale link with `?sector=RAIL&sector=marine`, still renders the shelf it
 * describes, and every link the page emits is the canonical form of it. These URLs are
 * `Disallow`ed and carry neither a canonical tag nor a robots meta (§7.16.3), so the
 * invariant is for people and for the cache key, not for a crawler.
 */

// Imported from the module rather than from the chrome's barrel: this file is pure, and
// the barrel re-exports client components and their stylesheets.
import { SHELF_QUERY_PARAMS } from '@/components/site/routes'
import {
  SECTOR_CODES,
  type SectorCode,
  SHELF_PAGE_SIZE,
  SIZE_BANDS,
  type SizeBandCode,
} from '@/lib/contracts/domain'

/** The four values `sort=` may carry. `relevance` is never written — see {@link effectiveSort}. */
export type ShelfSortParam = 'new' | 'votes' | 'size' | 'dcma'

/** What the sort control offers, plus the one option that only exists while `q` is set. */
export type ShelfSortOption = ShelfSortParam | 'relevance'

export interface ShelfParams {
  sector: SectorCode[]
  size: SizeBandCode[]
  /** The version strings present in the catalogue; not a closed set (§6.3). */
  p6: string[]
  progressed: boolean
  /** Empty string means absent. Free text, trimmed and lowercased. */
  q: string
  /** `null` is the contextual default: relevance while `q` is set, newest otherwise. */
  sort: ShelfSortParam | null
  /** 1-based. `1` is the default and is never written. */
  page: number
}

export const EMPTY_SHELF_PARAMS: ShelfParams = {
  sector: [],
  size: [],
  p6: [],
  progressed: false,
  q: '',
  sort: null,
  page: 1,
}

/**
 * The sort menu, in the order §6.3 tables it. The DCMA option is **labelled literally** —
 * never "Quality", never "Best" — because the label is the whole guard against reading a
 * compliance audit as a quality score.
 */
export const SORT_LABELS: Record<ShelfSortOption, string> = {
  new: 'Newest',
  votes: 'Most upvoted',
  size: 'Largest',
  dcma: 'DCMA checks passed',
  relevance: 'Relevance',
}

export const SORT_PARAM_VALUES: readonly ShelfSortParam[] = ['new', 'votes', 'size', 'dcma']

/** Longer than any P6 version string or sector code; bounds a hand-typed URL. */
const MAX_VALUE_LENGTH = 40
/** Bounds the `IN` list a hand-typed URL can ask Postgres for. */
const MAX_LIST_LENGTH = 24
const MAX_Q_LENGTH = 200

type RawSearchParams = Record<string, string | string[] | undefined>

function raw(params: RawSearchParams, key: string): string {
  const value = params[key]
  // A repeated key is not the canonical form, but it is a URL somebody may hold: joining
  // rather than dropping means `?sector=rail&sector=marine` renders the shelf it names.
  if (Array.isArray(value)) return value.join(',')
  return value ?? ''
}

/**
 * A comma list: lowercased, trimmed, deduped, sorted, bounded.
 *
 * Sorting is plain code-unit ascending rather than by the taxonomy's `sort_order`, because
 * one rule has to cover the P6 versions too — which come out of uploaded files and have no
 * seeded order to sort by.
 */
function parseList(value: string, allowed?: readonly string[]): string[] {
  const seen = new Set<string>()
  for (const part of value.split(',')) {
    const item = part.trim().toLowerCase()
    if (!item || item.length > MAX_VALUE_LENGTH) continue
    if (allowed && !allowed.includes(item)) continue
    seen.add(item)
    if (seen.size >= MAX_LIST_LENGTH) break
  }
  return [...seen].sort()
}

const SIZE_CODES: readonly string[] = SIZE_BANDS.map((band) => band.code)

/**
 * Free text, normalised to the one form that names this filter state: trimmed, internal
 * whitespace collapsed, lowercased. Lowercasing is safe because both readers are
 * case-insensitive — `websearch_to_tsquery` folds case, and `pg_trgm` lowercases
 * internally — so `?q=Depot` and `?q=depot` are one state and get one URL.
 */
function parseQuery(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_Q_LENGTH).toLowerCase()
}

function parsePage(value: string): number {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) && n > 1 ? n : 1
}

/**
 * Read a `searchParams` object into the canonical shape.
 *
 * `sort=new` collapses to `null` when there is no `q`, because newest is the default there
 * and a default is never written. With `q` set it does **not** collapse: the contextual
 * default is relevance, so `Newest` is a real choice and has to survive in the URL.
 */
export function parseShelfParams(params: RawSearchParams): ShelfParams {
  const q = parseQuery(raw(params, 'q'))
  const sortRaw = raw(params, 'sort').trim().toLowerCase()
  const sort = SORT_PARAM_VALUES.includes(sortRaw as ShelfSortParam)
    ? (sortRaw as ShelfSortParam)
    : null

  return {
    sector: parseList(raw(params, 'sector'), SECTOR_CODES) as SectorCode[],
    size: parseList(raw(params, 'size'), SIZE_CODES) as SizeBandCode[],
    p6: parseList(raw(params, 'p6')),
    progressed: raw(params, 'progressed').trim() === '1',
    q,
    sort: sort === 'new' && !q ? null : sort,
    page: parsePage(raw(params, 'page')),
  }
}

/**
 * The effective ordering: relevance takes over while `q` is set, and an explicit `sort`
 * still overrides it (§6.3). It mirrors `effectiveShelfSort` in the query layer, which is
 * the reader that actually orders the rows — this one exists so the control can mark the
 * active option without a database round trip.
 */
export function effectiveSort(params: ShelfParams): ShelfSortOption {
  if (params.sort) return params.sort
  return params.q ? 'relevance' : 'new'
}

/**
 * The canonical query string, without the `?`.
 *
 * Param order is taken from `SHELF_QUERY_PARAMS` — the same constant `robots.txt` builds
 * its disallow list from — with `page` appended, so a fifth facet cannot be added to one
 * and forgotten in the other.
 */
export function shelfSearch(params: ShelfParams): string {
  const values: Record<string, string> = {
    sector: params.sector.join(','),
    size: params.size.join(','),
    p6: params.p6.join(','),
    progressed: params.progressed ? '1' : '',
    q: params.q,
    sort: params.sort ?? '',
    page: params.page > 1 ? String(params.page) : '',
  }

  const parts: string[] = []
  for (const key of [...SHELF_QUERY_PARAMS, 'page' as const]) {
    const value = values[key]
    // §6.3 tables the canonical form as `?sector=rail,highways` — the comma is the list
    // separator and stays literal. `encodeURIComponent` would percent-encode it to `%2C`,
    // which parses identically but is a *different string*, and the canonical URL is the one
    // thing on this page that has to be byte-stable: it is what `<link rel=canonical>` emits
    // and what a crawler dedupes on.
    if (value) parts.push(`${key}=${encodeURIComponent(value).replace(/%2C/g, ',')}`)
  }
  return parts.join('&')
}

/**
 * A shelf URL. `basePath` is `/` for the shelf and `/u/{handle}` for a contributor's rows,
 * which paginate on the same `?page=N` contract with no facets of their own (§6.10).
 */
export function shelfHref(params: ShelfParams, basePath = '/'): string {
  const search = shelfSearch(params)
  return search ? `${basePath}?${search}` : basePath
}

/**
 * The bare URL, where the home lede renders and nowhere else (§7.13) — no `q`, `sector`,
 * `size`, `p6`, `progressed`, `sort` or `page`.
 */
export function isBareShelf(params: ShelfParams): boolean {
  return shelfSearch(params) === ''
}

/** How many filters are on, counting each facet once and `q` as one (for the empty state). */
export function activeFilterCount(params: ShelfParams): number {
  return (
    (params.sector.length > 0 ? 1 : 0) +
    (params.size.length > 0 ? 1 : 0) +
    (params.p6.length > 0 ? 1 : 0) +
    (params.progressed ? 1 : 0) +
    (params.q ? 1 : 0)
  )
}

/** The three multi-select facets. `progressed` is presence-only and `q` is free text. */
export type ListFacet = 'sector' | 'size' | 'p6'

/**
 * Toggle one value of one facet. **Page resets to 1**: a filter change invalidates the
 * offset, and `page=7` of a narrower result set is a 404 the visitor did not ask for.
 */
export function toggleFacetValue(
  params: ShelfParams,
  facet: ListFacet,
  value: string,
): ShelfParams {
  const current = params[facet] as string[]
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value].sort()
  return { ...params, [facet]: next, page: 1 } as ShelfParams
}

export function toggleProgressed(params: ShelfParams): ShelfParams {
  return { ...params, progressed: !params.progressed, page: 1 }
}

export function withoutFacet(params: ShelfParams, facet: ListFacet | 'progressed' | 'q') {
  const cleared: ShelfParams = { ...params, page: 1 }
  if (facet === 'progressed') cleared.progressed = false
  else if (facet === 'q') cleared.q = ''
  else if (facet === 'sector') cleared.sector = []
  else if (facet === 'size') cleared.size = []
  else cleared.p6 = []
  return cleared
}

/** The sort control's links. `null` writes no `sort` param — that is what relevance is. */
export function withSort(params: ShelfParams, sort: ShelfSortParam | null): ShelfParams {
  return { ...params, sort: sort === 'new' && !params.q ? null : sort, page: 1 }
}

export function withPage(params: ShelfParams, page: number): ShelfParams {
  return { ...params, page: Math.max(1, Math.trunc(page)) }
}

/** Clears every filter and the search term. The sort survives — it is not a filter. */
export function clearAllFilters(params: ShelfParams): ShelfParams {
  return { ...EMPTY_SHELF_PARAMS, sort: params.sort === 'new' ? null : params.sort }
}

/** `142 programmes` → 6 pages. Zero rows is one page, which is where the empty state goes. */
export function pageCountFor(total: number): number {
  return Math.max(1, Math.ceil(total / SHELF_PAGE_SIZE))
}
