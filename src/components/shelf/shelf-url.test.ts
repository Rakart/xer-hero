import { describe, expect, it } from 'vitest'
import { SHELF_QUERY_PARAMS } from '@/components/site/routes'
import {
  activeFilterCount,
  clearAllFilters,
  EMPTY_SHELF_PARAMS,
  effectiveSort,
  isBareShelf,
  pageCountFor,
  parseShelfParams,
  shelfHref,
  shelfSearch,
  toggleFacetValue,
  withPage,
  withSort,
} from './shelf-url'

describe('one filter state has exactly one URL (§6.3)', () => {
  it('omits every param at its default — bare `/` is the default shelf', () => {
    expect(shelfSearch(EMPTY_SHELF_PARAMS)).toBe('')
    expect(shelfHref(EMPTY_SHELF_PARAMS)).toBe('/')
    expect(isBareShelf(EMPTY_SHELF_PARAMS)).toBe(true)
  })

  it('writes params in the tabled order, which is SHELF_QUERY_PARAMS then page', () => {
    const params = parseShelfParams({
      page: '3',
      sort: 'votes',
      q: 'depot',
      progressed: '1',
      p6: '19.12',
      size: 'l',
      sector: 'rail',
    })
    expect(shelfSearch(params)).toBe(
      'sector=rail&size=l&p6=19.12&progressed=1&q=depot&sort=votes&page=3',
    )
    expect([...SHELF_QUERY_PARAMS, 'page']).toEqual([
      'sector',
      'size',
      'p6',
      'progressed',
      'q',
      'sort',
      'page',
    ])
  })

  it('lowercases values and sorts comma lists', () => {
    const params = parseShelfParams({ sector: 'RAIL,marine', size: 'XL,s' })
    expect(shelfSearch(params)).toBe('sector=marine,rail&size=s,xl')
  })

  it('never emits a repeated key, and reads one anyway', () => {
    const params = parseShelfParams({ sector: ['rail', 'marine'] })
    expect(params.sector).toEqual(['marine', 'rail'])
    expect(shelfSearch(params)).toBe('sector=marine,rail')
  })

  it('dedupes and drops values outside the seeded sets', () => {
    const params = parseShelfParams({ sector: 'rail,rail,nuclear', size: 'l,xxl' })
    expect(params.sector).toEqual(['rail'])
    expect(params.size).toEqual(['l'])
  })

  it('collapses the whitespace and case of a search term', () => {
    expect(parseShelfParams({ q: '  Depot   Resignal ' }).q).toBe('depot resignal')
  })

  it('treats `progressed` as presence-only', () => {
    expect(parseShelfParams({ progressed: '1' }).progressed).toBe(true)
    expect(parseShelfParams({ progressed: '0' }).progressed).toBe(false)
    expect(parseShelfParams({ progressed: 'true' }).progressed).toBe(false)
  })

  it('omits page 1 and every unreadable page number', () => {
    for (const page of ['1', '0', '-3', 'cheese', '']) {
      expect(parseShelfParams({ page }).page).toBe(1)
    }
    expect(shelfSearch(parseShelfParams({ page: '1' }))).toBe('')
    expect(shelfSearch(withPage(EMPTY_SHELF_PARAMS, 4))).toBe('page=4')
  })
})

describe('the sort control (§6.3)', () => {
  it('omits `sort=new` where newest is the default', () => {
    expect(parseShelfParams({ sort: 'new' }).sort).toBeNull()
    expect(shelfSearch(withSort(EMPTY_SHELF_PARAMS, 'new'))).toBe('')
  })

  it('keeps `sort=new` while `q` is set, because relevance is the default there', () => {
    const searching = parseShelfParams({ q: 'depot' })
    expect(effectiveSort(searching)).toBe('relevance')
    expect(shelfSearch(withSort(searching, 'new'))).toBe('q=depot&sort=new')
  })

  it('makes relevance the active option by omitting sort, never by naming it', () => {
    expect(parseShelfParams({ q: 'depot', sort: 'relevance' }).sort).toBeNull()
    expect(effectiveSort(parseShelfParams({ q: 'depot', sort: 'dcma' }))).toBe('dcma')
    expect(effectiveSort(EMPTY_SHELF_PARAMS)).toBe('new')
  })

  it('rejects a sort value that is not one of the four', () => {
    expect(parseShelfParams({ sort: 'quality' }).sort).toBeNull()
  })
})

describe('the controls that build URLs', () => {
  it('resets the page when a filter changes', () => {
    const onPage4 = parseShelfParams({ sector: 'rail', page: '4' })
    expect(toggleFacetValue(onPage4, 'sector', 'marine').page).toBe(1)
  })

  it('toggles a value off as readily as on, keeping the list sorted', () => {
    const one = toggleFacetValue(EMPTY_SHELF_PARAMS, 'sector', 'rail')
    const two = toggleFacetValue(one, 'sector', 'marine')
    expect(two.sector).toEqual(['marine', 'rail'])
    expect(toggleFacetValue(two, 'sector', 'rail').sector).toEqual(['marine'])
  })

  it('clears every filter and the search term, keeping the sort', () => {
    const params = parseShelfParams({ sector: 'rail', q: 'depot', sort: 'votes', page: '3' })
    expect(activeFilterCount(params)).toBe(2)
    const cleared = clearAllFilters(params)
    expect(shelfSearch(cleared)).toBe('sort=votes')
  })

  it('paginates a contributor page on the same contract', () => {
    expect(shelfHref(withPage(EMPTY_SHELF_PARAMS, 2), '/u/planner_dave')).toBe(
      '/u/planner_dave?page=2',
    )
    expect(shelfHref(EMPTY_SHELF_PARAMS, '/u/planner_dave')).toBe('/u/planner_dave')
  })
})

describe('pagination arithmetic', () => {
  it('is 25 to a page, and an empty shelf is one page', () => {
    expect(pageCountFor(0)).toBe(1)
    expect(pageCountFor(25)).toBe(1)
    expect(pageCountFor(26)).toBe(2)
    expect(pageCountFor(142)).toBe(6)
  })
})
