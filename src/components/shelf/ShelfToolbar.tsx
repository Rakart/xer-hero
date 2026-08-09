import { Chip } from '@/components/site'
import { facetValueLabel } from './facet-labels'
import styles from './ShelfControls.module.css'
import { formatCount } from './shelf-format'
import {
  clearAllFilters,
  effectiveSort,
  type ListFacet,
  pageCountFor,
  type ShelfParams,
  type ShelfSortParam,
  SORT_LABELS,
  SORT_PARAM_VALUES,
  shelfHref,
  toggleFacetValue,
  withoutFacet,
  withSort,
} from './shelf-url'

/**
 * `142 programmes · page 1 of 6` — itself a fact the browser wants, which is half the case
 * for numbered pages over infinite scroll (§6.3). The page clause is dropped at one page,
 * because *page 1 of 1* is a count of nothing.
 */
export function ResultCount({ total, page }: { total: number; page: number }) {
  const pages = pageCountFor(total)
  return (
    <p className={styles.count}>
      {formatCount(total)} programme{total === 1 ? '' : 's'}
      {pages > 1 ? ` · page ${page} of ${pages}` : ''}
    </p>
  )
}

/**
 * The sort menu (§6.3). Links rather than a `<select>`: every option is a real URL, it
 * needs no JavaScript on a page whose whole cost argument is that it needs none, and the
 * active option is simply the URL you are on.
 *
 * **Relevance appears only while `q` is set**, and is the active option then — expressed by
 * *omitting* `sort`, which is what makes it the contextual default rather than a fifth
 * value the URL scheme would have to carry.
 *
 * *Most viewed* is cut: nothing counts views, it would mean a write per render, and it is
 * the most gameable signal on the shelf.
 */
export function SortControl({ params }: { params: ShelfParams }) {
  const active = effectiveSort(params)
  return (
    <div className={styles.sort}>
      <span className={styles.groupLabel}>Sort</span>
      <div className={styles.chips}>
        {params.q ? (
          <Chip href={shelfHref(withSort(params, null))} selected={active === 'relevance'}>
            {SORT_LABELS.relevance}
          </Chip>
        ) : null}
        {SORT_PARAM_VALUES.map((value: ShelfSortParam) => (
          <Chip
            key={value}
            href={shelfHref(withSort(params, value))}
            selected={active === value}
            title={
              value === 'dcma'
                ? 'The ratio of checks passed to checks applicable. A computed audit, not a score.'
                : undefined
            }
          >
            {SORT_LABELS[value]}
          </Chip>
        ))}
      </div>
    </div>
  )
}

/**
 * The active-filter chips, **individually clearable** (§6.3). They sit above the grid with
 * the result count, so the filters that produced a short shelf are never off-screen from
 * the shelf they produced.
 */
export function ActiveFilters({ params }: { params: ShelfParams }) {
  const chips: { key: string; label: string; href: string }[] = []

  if (params.q) {
    chips.push({
      key: 'q',
      label: `'${params.q}'`,
      href: shelfHref(withoutFacet(params, 'q')),
    })
  }
  for (const facet of ['sector', 'size', 'p6'] as ListFacet[]) {
    for (const value of params[facet] as string[]) {
      chips.push({
        key: `${facet}:${value}`,
        label: facetValueLabel(facet, value),
        href: shelfHref(toggleFacetValue(params, facet, value)),
      })
    }
  }
  if (params.progressed) {
    chips.push({
      key: 'progressed',
      label: 'Progressed',
      href: shelfHref(withoutFacet(params, 'progressed')),
    })
  }

  if (chips.length === 0) return null

  return (
    <div className={styles.active}>
      <span className={styles.groupLabel}>Filtering by</span>
      <div className={styles.chips}>
        {chips.map((chip) => (
          <a key={chip.key} className={styles.clearChip} href={chip.href}>
            {chip.label}
            <span aria-hidden="true">×</span>
            <span className={styles.srOnly}>— remove this filter</span>
          </a>
        ))}
        {chips.length > 1 ? (
          <a className={styles.clearAll} href={shelfHref(clearAllFilters(params))}>
            Clear all
          </a>
        ) : null}
      </div>
    </div>
  )
}
