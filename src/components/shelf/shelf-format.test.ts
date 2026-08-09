import { describe, expect, it } from 'vitest'
import type { CardPayload } from '@/lib/contracts/card'
import {
  ACTIVITY_TRACK_SLOTS,
  activityTrack,
  DCMA_CHECK_COUNT,
  dcmaCells,
  dcmaRatio,
  elapsedFraction,
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

describe('what the row prints', () => {
  it('groups thousands without asking the runtime for a locale', () => {
    expect(formatCount(1751)).toBe('1,751')
    expect(formatCount(0)).toBe('0')
    expect(formatCount(999)).toBe('999')
    expect(formatCount(1234567)).toBe('1,234,567')
    expect(formatCount(null)).toBe('—')
  })

  it('prints whole percent, and 0 rather than nothing', () => {
    expect(formatPercent(41.37)).toBe('41%')
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(null)).toBe('—')
  })

  it('reads a naive date by string, never through a Date', () => {
    expect(formatMonthYear('2024-03-01')).toBe('Mar 24')
    expect(formatMonthYear('2024-12-31 17:00')).toBe('Dec 24')
    expect(formatMonthYear(null)).toBe('—')
    expect(formatMonthYear('not a date')).toBe('—')
  })

  it('prints a joined month in full', () => {
    expect(formatJoined('2024-03-15T09:00:00.000Z')).toBe('March 2024')
    expect(formatJoined(new Date('2024-11-02T00:00:00.000Z'))).toBe('November 2024')
    expect(formatJoined(null)).toBe('—')
  })

  it('keeps the age slot short enough for 52px', () => {
    const now = new Date('2025-06-01T12:00:00.000Z')
    expect(formatAge('2025-06-01T11:30:00.000Z', now)).toBe('new')
    expect(formatAge('2025-06-01T11:00:00.000Z', now)).toBe('1h')
    expect(formatAge('2025-05-31T00:00:00.000Z', now)).toBe('36h')
    expect(formatAge('2025-05-01T12:00:00.000Z', now)).toBe('31d')
    expect(formatAge('2025-03-01T12:00:00.000Z', now)).toBe('3mo')
    expect(formatAge('2022-06-01T12:00:00.000Z', now)).toBe('3y')
    expect(formatAge(null, now)).toBe('—')
  })
})

describe('slot 1 — the float band (§6.2)', () => {
  it('normalises the three fills and keeps all three numbers', () => {
    const segments = floatSegments({ neg: 69, ok: 27, high: 4 })
    expect(segments.map((s) => s.pct)).toEqual([69, 27, 4])
    expect(segments.reduce((n, s) => n + s.fraction, 0)).toBeCloseTo(1)
  })

  it('draws nothing rather than a bogus band when the card is missing', () => {
    expect(floatSegments(null).every((s) => s.fraction === 0)).toBe(true)
  })

  it('keeps three segments whatever the mix, because the slots are fixed', () => {
    expect(floatSegments({ neg: 0, ok: 100, high: 0 })).toHaveLength(3)
  })
})

describe('slot 5 — the vote magnitude bar', () => {
  it('is √-scaled against a fixed full scale, so pages compare', () => {
    expect(voteMagnitude(0)).toBe(0)
    expect(voteMagnitude(100)).toBeCloseTo(0.5)
    expect(voteMagnitude(400)).toBe(1)
    expect(voteMagnitude(4000)).toBe(1)
  })

  it('gives a single vote a visible share rather than nothing', () => {
    expect(voteMagnitude(1)).toBeGreaterThan(0.04)
  })
})

describe('slot 8 — the activity track (§6.2)', () => {
  it('never renders a small programme as a blank cell', () => {
    const track = activityTrack(310)
    expect(track.filled).toBe(1)
    expect(track.saturated).toBe(false)
    expect(track.label).toBe('310')
  })

  it('fills one slot per 1,000', () => {
    expect(activityTrack(1751).filled).toBe(2)
    expect(activityTrack(9000).filled).toBe(9)
  })

  it('saturates over 10,000, and the count takes a `+`', () => {
    const track = activityTrack(12431)
    expect(track.filled).toBe(ACTIVITY_TRACK_SLOTS)
    expect(track.saturated).toBe(true)
    expect(track.label).toBe('12,431+')
    expect(activityTrack(10000).saturated).toBe(false)
  })

  it('holds its geometry when the count is missing', () => {
    expect(activityTrack(null)).toEqual({ filled: 0, saturated: false, label: '—' })
  })
})

describe('slot 9 — the window curve on a local axis (§6.2)', () => {
  const card = {
    s_curve: [0, 0.2, 0.6, 1],
    float_mix: { neg: 0, ok: 100, high: 0 },
    wbs_depth: 3,
    issues_count: 0,
  } as CardPayload

  it('normalises x to its own column and inverts y into SVG space', () => {
    const { points } = windowGeometry(
      card,
      { start: '2024-01-01', finish: '2024-12-31', data: '2024-07-01' },
      { width: 262, height: 30 },
    )
    expect(points?.[0]).toEqual({ x: 0, y: 30 })
    expect(points?.[3]).toEqual({ x: 262, y: 0 })
  })

  it('places the data date as a fraction of the window', () => {
    expect(
      elapsedFraction({ start: '2024-01-01', finish: '2024-01-11', data: '2024-01-06' }),
    ).toBeCloseTo(0.5)
  })

  it('clamps a data date outside the window rather than drawing off the box', () => {
    expect(elapsedFraction({ start: '2024-01-01', finish: '2024-01-11', data: '2025-01-01' })).toBe(
      1,
    )
  })

  it('returns no rule where a date is missing, and no curve where the card is', () => {
    expect(elapsedFraction({ start: '2024-01-01', finish: null, data: '2024-06-01' })).toBeNull()
    expect(
      windowGeometry(null, { start: null, finish: null, data: null }, { width: 262, height: 30 })
        .points,
    ).toBeNull()
  })

  it('refuses a zero-length window rather than dividing by it', () => {
    expect(
      elapsedFraction({ start: '2024-01-01', finish: '2024-01-01', data: '2024-01-01' }),
    ).toBeNull()
  })
})

describe('slot 11 — the DCMA strip (§6.2)', () => {
  it('is always fourteen cells: passes, fails, then dashed skips', () => {
    const cells = dcmaCells(6, 10)
    expect(cells).toHaveLength(DCMA_CHECK_COUNT)
    expect(cells.filter((c) => c === 'pass')).toHaveLength(6)
    expect(cells.filter((c) => c === 'fail')).toHaveLength(4)
    expect(cells.filter((c) => c === 'skip')).toHaveLength(4)
  })

  it('carries its own denominator, so 10 applicable is not 14', () => {
    expect(dcmaRatio(6, 10)).toBe('6/10')
    expect(dcmaRatio(10, 14)).toBe('10/14')
    expect(dcmaRatio(null, 10)).toBe('—')
    // Empty slots stay drawn (§6.2): an unscored revision is fourteen dashes, not a collapsed
    // cell, because a blank cell reads as a narrower row rather than as missing data.
    expect(dcmaCells(6, null)).toHaveLength(14)
    expect(dcmaCells(6, null).every((c) => c === 'skip')).toBe(true)
  })

  it('cannot report more passes than applicable checks', () => {
    expect(dcmaCells(99, 10).filter((c) => c === 'pass')).toHaveLength(10)
  })
})

describe('slot 2 — the two badges, and no others (§6.2)', () => {
  const base = { s_curve: [], float_mix: { neg: 0, ok: 100, high: 0 } }

  it('renders `⚠ partial` above zero issues and `no WBS` at depth 1', () => {
    const badges = rowBadges({ ...base, wbs_depth: 1, issues_count: 2 } as CardPayload)
    expect(badges.map((b) => b.label)).toEqual(['⚠ partial', 'no WBS'])
  })

  it('renders neither on a clean card, and never a baseline badge', () => {
    expect(rowBadges({ ...base, wbs_depth: 4, issues_count: 0 } as CardPayload)).toEqual([])
    expect(rowBadges(null)).toEqual([])
  })
})
