import { describe, expect, it } from 'vitest'
import { SECTORS, type SectorCode, SIZE_BANDS, type SizeBandCode } from '@/lib/contracts/domain'
import type { ShelfFacetCounts } from '@/lib/db/queries'
import { activeFilterLabels, emptyStateCopy, relaxedMatchCount } from './empty-state'
import { parseShelfParams, shelfSearch } from './shelf-url'

/** The shape `getShelfFacetCounts` returns: every seeded code present, at 0 by default. */
function counts(overrides: Partial<ShelfFacetCounts> = {}): ShelfFacetCounts {
  const sector = Object.fromEntries(SECTORS.map((s) => [s.code, 0])) as Record<SectorCode, number>
  const size = Object.fromEntries(SIZE_BANDS.map((b) => [b.code, 0])) as Record<
    SizeBandCode,
    number
  >
  return {
    sector: { ...sector, ...overrides.sector },
    size: { ...size, ...overrides.size },
    p6: overrides.p6 ?? {},
    progressed: overrides.progressed ?? 0,
  }
}

describe('naming the filters that produced the empty shelf (§6.2)', () => {
  it('lists the search term first, then each facet value', () => {
    const params = parseShelfParams({
      q: 'negative float',
      sector: 'marine',
      p6: '19.12',
      progressed: '1',
    })
    expect(activeFilterLabels(params)).toEqual([
      "'negative float'",
      'Marine & ports',
      'P6 19.12',
      'progressed',
    ])
  })

  it('names them in the headline and counts them in words', () => {
    const params = parseShelfParams({ sector: 'marine', p6: '19.12', progressed: '1' })
    const copy = emptyStateCopy(params, counts(), null)
    expect(copy.headline).toBe("Nothing on the shelf for 'Marine & ports | P6 19.12 | progressed'.")
    expect(copy.filterLine).toBe('Three filters are on.')
  })

  it('invents no cause when the catalogue itself is empty', () => {
    const copy = emptyStateCopy(parseShelfParams({}), counts(), null)
    expect(copy.headline).toBe('Nothing on the shelf yet.')
    expect(copy.filterLine).toBeNull()
    expect(copy.clear).toBeNull()
  })
})

describe('explaining the reason where the data model makes it inevitable', () => {
  const params = parseShelfParams({ sector: 'marine', progressed: '1' })

  it('reads the relaxed counts to say how many exist and that none is progressed', () => {
    const relaxed = counts({ sector: { marine: 2 } as Record<SectorCode, number> })
    expect(relaxedMatchCount(params, relaxed)).toEqual({ facet: 'sector', count: 2 })

    const copy = emptyStateCopy(params, counts(), relaxed)
    expect(copy.reason).toContain('Marine & ports matches 2 programmes')
    expect(copy.reason).toContain('none of them is progressed')
    expect(copy.clear?.label).toBe('Clear the progress filter')
    expect(shelfSearch(copy.clear?.params ?? parseShelfParams({}))).toBe('sector=marine')
  })

  it('claims nothing when the relaxed count is zero — the sector really is empty', () => {
    const copy = emptyStateCopy(params, counts(), counts())
    expect(copy.reason).toBeNull()
    expect(copy.clear).toBeNull()
  })
})

describe('offering the one filter worth clearing', () => {
  it('offers the facet whose unselected value holds a positive conjunctive count', () => {
    const params = parseShelfParams({ sector: 'marine', size: 'l' })
    const copy = emptyStateCopy(
      params,
      counts({ sector: { rail: 3 } as Record<SectorCode, number> }),
      null,
    )
    expect(copy.clear?.label).toBe('Clear the sector filter')
    expect(shelfSearch(copy.clear?.params ?? params)).toBe('size=l')
  })

  it('falls back to the search term, which is the filter most likely to be a typo', () => {
    const params = parseShelfParams({ q: 'deopt' })
    const copy = emptyStateCopy(params, counts(), null)
    expect(copy.clear?.label).toBe('Clear the search')
    expect(shelfSearch(copy.clear?.params ?? params)).toBe('')
  })

  it('never offers a filter it cannot prove would return rows', () => {
    const params = parseShelfParams({ sector: 'marine' })
    expect(emptyStateCopy(params, counts(), null).clear).toBeNull()
  })

  it('resets the page, so the offer cannot land on a 404', () => {
    const params = parseShelfParams({ q: 'deopt', page: '4' })
    expect(emptyStateCopy(params, counts(), null).clear?.params.page).toBe(1)
  })
})
