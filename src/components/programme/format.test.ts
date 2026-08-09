import { describe, expect, it } from 'vitest'
import {
  EMPTY,
  formatAge,
  formatBytes,
  formatCount,
  formatDate,
  formatHoursAsDays,
  formatMonth,
  formatPct,
  formatYear,
  parseNaiveDate,
  parseNaiveMonth,
  plural,
} from './format'

describe('formatCount', () => {
  it('separates thousands', () => {
    expect(formatCount(20_000)).toBe('20,000')
    expect(formatCount(0)).toBe('0')
  })

  it('renders the em dash rather than inventing a zero', () => {
    expect(formatCount(null)).toBe(EMPTY)
    expect(formatCount(undefined)).toBe(EMPTY)
    expect(formatCount(Number.NaN)).toBe(EMPTY)
  })
})

describe('formatDate', () => {
  // §3.4 — a naive wall-clock date must never move. `new Date('2017-04-24')` is midnight
  // UTC and prints as the 23rd anywhere west of Greenwich; this is the regression guard.
  it('does not shift a date by timezone', () => {
    expect(formatDate('2017-04-24')).toBe('24 Apr 2017')
    expect(formatDate('2017-01-01')).toBe('1 Jan 2017')
    expect(formatDate('2023-12-31')).toBe('31 Dec 2023')
  })

  it('accepts both wall-clock time separators the contract carries', () => {
    expect(formatDate('2017-09-29 16:00')).toBe('29 Sep 2017')
    expect(formatDate('2017-09-29T16:00')).toBe('29 Sep 2017')
  })

  it('renders the em dash for an absent or unparsable date', () => {
    expect(formatDate(null)).toBe(EMPTY)
    expect(formatDate('')).toBe(EMPTY)
    expect(formatDate('not a date')).toBe(EMPTY)
    expect(formatDate('2017-13-01')).toBe(EMPTY)
  })
})

describe('formatYear / parse helpers', () => {
  it('reads the year without a Date', () => {
    expect(formatYear('2017-04-24')).toBe('2017')
    expect(formatYear(null)).toBe(EMPTY)
  })

  it('parses the parts', () => {
    expect(parseNaiveDate('2017-04-24')).toEqual({ year: 2017, month: 4, day: 24 })
    expect(parseNaiveMonth('2017-04')).toEqual({ year: 2017, month: 4 })
    expect(parseNaiveMonth('2017-99')).toBeNull()
  })
})

describe('formatMonth', () => {
  it('rolls a month offset over a year boundary', () => {
    expect(formatMonth(2017, 3)).toBe('Apr 2017')
    expect(formatMonth(2017, 12)).toBe('Jan 2018')
    expect(formatMonth(2017, 25)).toBe('Feb 2019')
  })
})

describe('formatBytes', () => {
  it('prints the gzipped download size in binary units', () => {
    expect(formatBytes(932_864)).toBe('911 KB')
    expect(formatBytes(340_081)).toBe('332 KB')
    expect(formatBytes(6_810_000)).toBe('6.5 MB')
    expect(formatBytes(512)).toBe('512 B')
  })

  it('renders the em dash when the size is unknown', () => {
    expect(formatBytes(null)).toBe(EMPTY)
  })
})

describe('formatPct', () => {
  it('keeps the decimal so a column stays aligned', () => {
    expect(formatPct(2)).toBe('2.0')
    expect(formatPct(89.5)).toBe('89.5')
    expect(formatPct(null)).toBe(EMPTY)
  })
})

describe('formatHoursAsDays', () => {
  it('converts on the hours-per-day it was given', () => {
    expect(formatHoursAsDays(-240)).toBe('-30d')
    expect(formatHoursAsDays(-3728)).toBe('-466d')
    expect(formatHoursAsDays(-12, 8)).toBe('-1.5d')
    expect(formatHoursAsDays(240, 10)).toBe('24d')
    expect(formatHoursAsDays(null)).toBe(EMPTY)
  })
})

describe('formatAge', () => {
  const now = new Date('2026-08-09T12:00:00Z')

  // One scale, shared with the shelf's slot 12, because the byline and the row print the same
  // fact about the same revision — a reader arriving from a row that said `3mo` must not be
  // told `2mo` here. Under 48 hours the shelf reports hours, which is finer than the coarse
  // `today` this page used to print on its own.
  it("coarsens by scale, on the shelf's scale", () => {
    expect(formatAge('2026-08-09T06:00:00Z', now)).toBe('6h')
    expect(formatAge('2026-08-01T12:00:00Z', now)).toBe('8d')
    expect(formatAge('2026-05-09T12:00:00Z', now)).toBe('3mo')
    expect(formatAge('2023-08-09T12:00:00Z', now)).toBe('3y')
  })
})

describe('plural', () => {
  it('never prints a parenthesised s', () => {
    expect(plural(1, 'revision')).toBe('1 revision')
    expect(plural(23, 'revision')).toBe('23 revisions')
    expect(plural(0, 'fork')).toBe('0 forks')
  })
})
