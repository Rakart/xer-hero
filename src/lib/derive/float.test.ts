import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseXer } from '../xer'
import {
  DCMA_HIGH_DAYS,
  FALLBACK_HOURS_PER_DAY,
  floatBand,
  floatMix,
  highThresholdHours,
  hoursPerDay,
  hoursToDays,
} from './float'

const CORPUS = fileURLToPath(new URL('../../../fixtures/synthetic/corpus/', import.meta.url))
const fixture = (name: string) => parseXer(readFileSync(`${CORPUS}${name}.xer`))

describe('hoursPerDay', () => {
  it('converts on the programme calendar and says so', () => {
    // §10.10: `PROJECT.clndr_id`, decoded — the same calendar rule `duration_working_days`
    // uses, so the spec carries one calendar-selection rule rather than two.
    const day = hoursPerDay(fixture('wbs-flat'))
    expect(day).toEqual({ hours: 8, source: 'programme_calendar' })
  })

  it('falls back to a documented fixed 8 where there is no CALENDAR table', () => {
    const day = hoursPerDay(fixture('missing-calendar'))
    expect(day).toEqual({ hours: FALLBACK_HOURS_PER_DAY, source: 'fallback' })
  })

  it('falls back where PROJECT.clndr_id names a calendar the file does not carry', () => {
    // `cal-project-clndr-absent` names calendar 841 and two perfectly good calendars sit
    // beside it. Neither may be substituted — the fallback is a stated constant, not a guess.
    expect(hoursPerDay(fixture('cal-project-clndr-absent')).source).toBe('fallback')
  })

  it('falls back where the activities span two projects', () => {
    expect(hoursPerDay(fixture('multiproj-two-proj-id')).source).toBe('fallback')
  })

  it('picks the programme calendar rather than default_flag', () => {
    // `cal-default-unused` sets `default_flag = Y` on a seven-day calendar nothing uses.
    // Reading it would convert 44 days at 24 hours instead of 8.
    expect(hoursPerDay(fixture('cal-default-unused'))).toEqual({
      hours: 8,
      source: 'programme_calendar',
    })
  })
})

describe('the 44-day threshold', () => {
  it('is 352 hours on an eight-hour day and 1,056 on an elapsed one', () => {
    expect(highThresholdHours({ hours: 8, source: 'programme_calendar' })).toBe(352)
    expect(highThresholdHours({ hours: 24, source: 'programme_calendar' })).toBe(1056)
    expect(DCMA_HIGH_DAYS).toBe(44)
  })

  it('divides hours by the same day length everywhere', () => {
    expect(hoursToDays(352, { hours: 8, source: 'fallback' })).toBe(44)
  })
})

describe('floatBand', () => {
  const high = highThresholdHours({ hours: 8, source: 'programme_calendar' })

  it('bands negative, acceptable and high float', () => {
    expect(floatBand(-1, high)).toBe('neg')
    expect(floatBand(0, high)).toBe('ok')
    expect(floatBand(high, high)).toBe('ok')
    expect(floatBand(high + 1, high)).toBe('high')
  })

  it('is null for absent float, because empty float is not zero float', () => {
    // One real fixture has 345 null-float activities and exactly 345 completed ones: float
    // is absent precisely because the work is done. Coercing them to zero would report 345
    // spurious critical activities.
    expect(floatBand(null, high)).toBeNull()
    expect(floatBand(undefined, high)).toBeNull()
    expect(floatBand(Number.NaN, high)).toBeNull()
  })

  it('passes an activity sitting exactly on 44 days, as DCMA 6 does', () => {
    expect(floatBand(352, 352)).toBe('ok')
  })
})

describe('floatMix', () => {
  const high = 352

  it('sums to exactly 100 on values that do not divide', () => {
    // Three thirds must print as 100, not 99 — the numbers sit under a sliver whose amber
    // measures 2.11:1 in light mode and they are what makes the band legible (§6.2).
    const mix = floatMix([-1, 0, 400], high)
    expect(mix.neg + mix.ok + mix.high).toBe(100)
    expect(mix).toEqual({ neg: 34, ok: 33, high: 33 })
  })

  it('excludes nulls from the base rather than folding them into ok', () => {
    // Folding would claim "this activity has acceptable float" about one that reports none.
    expect(floatMix([-1, null, null, null], high)).toEqual({ neg: 100, ok: 0, high: 0 })
  })

  it('returns three zeroes where every row reports no float at all', () => {
    expect(floatMix([null, null], high)).toEqual({ neg: 0, ok: 0, high: 0 })
  })

  it('matches the shape the row prints', () => {
    const values = [...Array(69).fill(-8), ...Array(27).fill(0), ...Array(4).fill(4000)]
    expect(floatMix(values, high)).toEqual({ neg: 69, ok: 27, high: 4 })
  })
})
