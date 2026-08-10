/**
 * The shelf surface's public exports — the row and its twelve slots, the filter bar, the
 * sort control, the chips, the pager and the empty state.
 *
 * `/`, `/u/{handle}` and anything else that renders **shelf rows** builds from here.
 * §6.12's `/me/bookmarks` and `/me/votes` are specified as shelf rows too: `ShelfGrid`
 * takes `ShelfRowData[]`, which is exactly what `listShelf` returns, so a page that has
 * rows has a shelf.
 *
 * Import from `@/components/shelf` rather than from a file inside it — except from a
 * client component, which should reach for `./viewer-controls` directly rather than pull
 * every server component here across the boundary.
 */

export { EmptyState, type TitleSuggestion } from './EmptyState'
export { activeFilterLabels, type EmptyStateCopy, emptyStateCopy } from './empty-state'
export { compareP6Versions, FilterBar } from './FilterBar'
export { facetValueLabel, SECTOR_CHIPS, sizeBandLabel } from './facet-labels'
export { HomeLede } from './HomeLede'
export { Pager, pageNumbers } from './Pager'
export { ShelfChrome } from './ShelfChrome'
export { ShelfGrid, SingleResultNote } from './ShelfGrid'
export { ShelfRow, type ShelfRowData } from './ShelfRow'
export { ActiveFilters, ResultCount, SortControl } from './ShelfToolbar'
export {
  type EmptyShelfExtras,
  loadContributor,
  loadContributorRank,
  loadEmptyShelfExtras,
  loadLeaderboard,
  loadShelfPage,
  loadShelfRows,
  type ShelfPageData,
  type ShelfRowsData,
  toShelfQuery,
} from './shelf-data'
export {
  activityTrack,
  dcmaCells,
  dcmaRatio,
  floatSegments,
  formatAge,
  formatCount,
  formatJoined,
  formatMonthYear,
  formatPercent,
  rowBadges,
  voteMagnitude,
  windowGeometry,
} from './shelf-format'
export {
  activeFilterCount,
  clearAllFilters,
  EMPTY_SHELF_PARAMS,
  effectiveSort,
  isBareShelf,
  type ListFacet,
  pageCountFor,
  parseShelfParams,
  type ShelfParams,
  type ShelfSortOption,
  type ShelfSortParam,
  SORT_LABELS,
  shelfHref,
  shelfSearch,
  toggleFacetValue,
  toggleProgressed,
  withoutFacet,
  withPage,
  withSort,
} from './shelf-url'
