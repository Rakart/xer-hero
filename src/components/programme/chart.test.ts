import { describe, expect, it } from 'vitest'
import {
  axisLabel,
  clampPct,
  columnGeometry,
  columnPath,
  dataDateIndex,
  finishToStartPct,
  linePath,
  niceScale,
  yearTicks,
} from './chart'
import { broken, perf20k, tender } from './fixture'

describe('niceScale', () => {
  it('tops out on a round number above the data, never on the data', () => {
    expect(niceScale(20_000).top).toBe(20_000)
    expect(niceScale(19_999).top).toBe(20_000)
    expect(niceScale(3344).top).toBe(4000)
    expect(niceScale(7).top).toBeGreaterThanOrEqual(7)
  })

  it('always starts at zero and never returns an empty axis', () => {
    expect(niceScale(0).ticks[0]).toBe(0)
    expect(niceScale(0).top).toBeGreaterThan(0)
    expect(niceScale(1).ticks.length).toBeGreaterThan(1)
  })
})

describe('axisLabel', () => {
  it('abbreviates thousands and leaves small numbers alone', () => {
    expect(axisLabel(20_000)).toBe('20k')
    expect(axisLabel(1500)).toBe('1.5k')
    expect(axisLabel(400)).toBe('400')
  })
})

describe('dataDateIndex — the rule that says which half of the curve happened', () => {
  it('lands inside the month, not on its boundary', () => {
    // from 2026-01, data date 2027-04-23 → 15 whole months plus 22/30 of April.
    const index = dataDateIndex('2026-01', '2027-04-23 13:00')
    expect(index).toBeCloseTo(15 + 22 / 30, 6)
  })

  it('is null when there is no data date, rather than zero', () => {
    // Drawing the rule at zero would assert that all of the work is remaining as of the
    // programme start, which is a different claim from "nothing has started yet".
    expect(dataDateIndex('2017-04', null)).toBeNull()
    expect(dataDateIndex(tender.distributions.s_curve.from, tender.time.data_date)).toBeNull()
  })

  it('is null when the curve has no origin', () => {
    expect(dataDateIndex(broken.distributions.s_curve.from, '2020-01-01')).toBeNull()
  })

  it('goes negative when the data date precedes the window, rather than clamping silently', () => {
    expect(dataDateIndex('2026-01', '2025-12-01')).toBeCloseTo(-1, 6)
  })
})

describe('yearTicks', () => {
  it('marks January of each year across the real 40-bucket curve', () => {
    const ticks = yearTicks('2026-01', perf20k.distributions.s_curve.cumulative.length)
    expect(ticks.map((t) => t.label)).toEqual(['2026', '2027', '2028', '2029'])
    expect(ticks[0]?.index).toBe(0)
    expect(ticks[1]?.index).toBe(12)
  })

  it('never leaves a short curve with a bare axis', () => {
    const ticks = yearTicks('2017-04', 6)
    expect(ticks).toEqual([{ index: 0, label: '2017' }])
  })

  it('returns nothing when there is no window', () => {
    expect(yearTicks(null, 40)).toEqual([])
  })
})

describe('linePath', () => {
  it('opens with a move and continues with lines', () => {
    const path = linePath(
      [0, 1, 2],
      (i) => i * 10,
      (v) => 100 - v,
    )
    expect(path).toBe('M0.0,100.0L10.0,99.0L20.0,98.0')
  })
})

describe('columnGeometry / columnPath', () => {
  it('caps a column at 24px and centres it in its band', () => {
    expect(columnGeometry(100)).toEqual({ width: 24, offset: 38 })
    expect(columnGeometry(10)).toEqual({ width: 6, offset: 2 })
  })

  it('keeps a hairline column visible rather than collapsing it', () => {
    expect(columnGeometry(3).width).toBeGreaterThanOrEqual(1)
  })

  it('collapses the cap radius on a short bar instead of inverting it', () => {
    expect(columnPath(0, 10, 20, 1)).toContain('Q')
    expect(columnPath(0, 10, 20, 0)).not.toContain('NaN')
  })
})

describe('finishToStartPct', () => {
  it('is one number, shared by the tile and the meter', () => {
    expect(finishToStartPct(perf20k.logic.relationship_type_mix, 34_000)).toBeCloseTo(91.99, 2)
    expect(finishToStartPct(tender.logic.relationship_type_mix, 5883)).toBeCloseTo(89.53, 2)
  })

  it('is null rather than NaN on a file with no relationships', () => {
    expect(finishToStartPct({}, 0)).toBeNull()
  })
})

describe('clampPct', () => {
  it('keeps a mark on its track', () => {
    expect(clampPct(150)).toBe(100)
    expect(clampPct(-5)).toBe(0)
    expect(clampPct(Number.NaN)).toBe(0)
  })
})
