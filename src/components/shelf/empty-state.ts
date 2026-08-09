/**
 * The empty shelf, as a decision rather than as a sentence in a component (§6.2).
 *
 * The prototype's copy fixes the shape, and each of its four parts is doing a job:
 *
 * > *"Nothing on the shelf for 'negative float | Marine | P6 19.12'. Three filters are on.
 * > Marine has 2 programmes and neither is progressed — negative float can only appear on a
 * > programme with progress."* → **Clear the progress filter**, with *"or upload a
 * > programme — it publishes under CC-BY 4.0 and appears here immediately."*
 *
 * 1. It **names the filters that produced it**, because an empty page whose cause is
 *    off-screen reads as a broken site.
 * 2. It **explains the reason where the data model makes the combination inevitable** —
 *    which in v1 is the progress filter, since a programme with no progress can never
 *    satisfy it however the other facets move.
 * 3. It **offers the one filter worth clearing**, and the offer is only made where it is
 *    provably right: every branch below is backed by a count that is non-zero *with that
 *    one filter removed*, so the link never lands on a second empty shelf.
 * 4. It **falls back to uploading**, which is the only other thing to do here.
 *
 * The counts come from the facet-count query the filter bar already ran, so parts 1–3 cost
 * nothing extra. Part 2 alone needs one more read, and it is taken **only on a zero-row
 * shelf with the progress filter on** — the same budget the `pg_trgm` did-you-mean spends.
 */

import type { ShelfFacetCounts } from '@/lib/db/queries'
import { facetValueLabel } from './facet-labels'
import { activeFilterCount, type ListFacet, type ShelfParams, withoutFacet } from './shelf-url'

export interface EmptyStateCopy {
  /** `Nothing on the shelf for 'depot | Marine & ports | P6 19.12'.` */
  headline: string
  /** `Three filters are on.` — `null` when the catalogue itself is empty. */
  filterLine: string | null
  /** Why the combination is inevitable, where it is. `null` where it is not. */
  reason: string | null
  /** The one filter worth clearing, with the shelf it clears to. */
  clear: { label: string; params: ShelfParams } | null
}

const NUMBER_WORDS = ['no', 'One', 'Two', 'Three', 'Four', 'Five'] as const

function filterWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n)
}

/** The filters as the visitor set them, in the order the filter bar draws them. */
export function activeFilterLabels(params: ShelfParams): string[] {
  const labels: string[] = []
  if (params.q) labels.push(`'${params.q}'`)
  for (const code of params.sector) labels.push(facetValueLabel('sector', code))
  for (const code of params.size) labels.push(facetValueLabel('size', code))
  for (const version of params.p6) labels.push(facetValueLabel('p6', version))
  if (params.progressed) labels.push('progressed')
  return labels
}

/**
 * How many programmes match everything **except** the progress filter.
 *
 * Read off the relaxed facet counts rather than queried on its own: selecting a value of a
 * facet already excludes rows whose column is null there, so summing the selected values of
 * that facet *is* the relaxed result count. Returns `null` when no multi-select facet is on
 * and there is therefore nothing to sum.
 */
export function relaxedMatchCount(
  params: ShelfParams,
  relaxed: ShelfFacetCounts,
): { facet: ListFacet; count: number } | null {
  if (params.sector.length > 0) {
    return { facet: 'sector', count: sum(params.sector.map((c) => relaxed.sector[c] ?? 0)) }
  }
  if (params.size.length > 0) {
    return { facet: 'size', count: sum(params.size.map((c) => relaxed.size[c] ?? 0)) }
  }
  if (params.p6.length > 0) {
    return { facet: 'p6', count: sum(params.p6.map((v) => relaxed.p6[v] ?? 0)) }
  }
  return null
}

function sum(values: number[]): number {
  return values.reduce((total, n) => total + n, 0)
}

/**
 * The facet whose removal is known to return rows: one of its **unselected** values holds a
 * positive conjunctive count, and that count was computed with every other facet still
 * applied — so clearing this facet returns at least that many rows.
 */
function facetWorthClearing(params: ShelfParams, counts: ShelfFacetCounts): ListFacet | null {
  const tables: { facet: ListFacet; values: Record<string, number>; selected: string[] }[] = [
    { facet: 'sector', values: counts.sector, selected: params.sector },
    { facet: 'size', values: counts.size, selected: params.size },
    { facet: 'p6', values: counts.p6, selected: params.p6 },
  ]
  for (const table of tables) {
    if (table.selected.length === 0) continue
    for (const [value, n] of Object.entries(table.values)) {
      if (n > 0 && !table.selected.includes(value)) return table.facet
    }
  }
  return null
}

const CLEAR_LABELS: Record<ListFacet | 'progressed' | 'q', string> = {
  sector: 'Clear the sector filter',
  size: 'Clear the size filter',
  p6: 'Clear the P6 filter',
  progressed: 'Clear the progress filter',
  q: 'Clear the search',
}

/**
 * @param counts the conjunctive facet counts under the current filters.
 * @param relaxed the same counts with the **progress filter dropped**, or `null` when the
 *   progress filter is off and there is nothing to relax.
 */
export function emptyStateCopy(
  params: ShelfParams,
  counts: ShelfFacetCounts,
  relaxed: ShelfFacetCounts | null,
): EmptyStateCopy {
  const labels = activeFilterLabels(params)
  const filterCount = activeFilterCount(params)

  // No filters and no rows: the catalogue is empty. Naming filters that are not on, or
  // offering to clear one, would both be inventing a cause.
  if (filterCount === 0) {
    return {
      headline: 'Nothing on the shelf yet.',
      filterLine: null,
      reason: null,
      clear: null,
    }
  }

  const headline = `Nothing on the shelf for '${labels.join(' | ')}'.`
  const filterLine = `${filterWord(filterCount)} filter${filterCount === 1 ? ' is' : 's are'} on.`

  // The one combination the data model makes inevitable: progress is a property of the
  // programme, so no movement of the other facets can put progress onto a programme that
  // has none. Only claimed when the relaxed count proves it.
  const relaxedMatch = params.progressed && relaxed ? relaxedMatchCount(params, relaxed) : null
  if (relaxedMatch && relaxedMatch.count > 0) {
    const n = relaxedMatch.count
    const subject =
      relaxedMatch.facet === 'sector' && params.sector.length === 1 && params.sector[0]
        ? facetValueLabel('sector', params.sector[0])
        : 'The rest of those filters'
    return {
      headline,
      filterLine,
      reason:
        `${subject} match${subject === 'The rest of those filters' ? '' : 'es'} ${n} ` +
        `programme${n === 1 ? '' : 's'} and ${n === 1 ? 'it is not' : 'none of them is'} ` +
        'progressed — a programme only appears under that filter once its data date has ' +
        'moved and P6 has recorded progress against it.',
      clear: { label: CLEAR_LABELS.progressed, params: withoutFacet(params, 'progressed') },
    }
  }

  const facet = facetWorthClearing(params, counts)
  if (facet) {
    return {
      headline,
      filterLine,
      reason: null,
      clear: { label: CLEAR_LABELS[facet], params: withoutFacet(params, facet) },
    }
  }

  // Nothing else is provably worth clearing, and the search term is the filter most likely
  // to be a typo — which is also why the did-you-mean runs beside this.
  if (params.q) {
    return {
      headline,
      filterLine,
      reason: null,
      clear: { label: CLEAR_LABELS.q, params: withoutFacet(params, 'q') },
    }
  }

  return { headline, filterLine, reason: null, clear: null }
}
