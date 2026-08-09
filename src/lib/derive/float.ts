/**
 * Float, banded once — and the hour-to-day conversion every 44-day threshold stands on
 * (§3.7 checks 6 and 7, §3.8's histogram, §6.2's `card.float_mix`, §8.15, §10.10).
 *
 * Three consumers read the same three bands from here rather than each writing its own
 * comparison, because the whole point of `float_mix` is that the row's sliver and the
 * detail page's scorecard are describing one programme. Two modules banding float two ways
 * is a defect nobody would see until a screenshot disagreed with a table.
 *
 * **Empty float is not zero float** (§3.8). `TASK.total_float_hr_cnt` is empty precisely
 * where the work is done — one real fixture has 345 null-float activities and exactly 345
 * completed ones — so `null` is carried through every function here as its own answer and
 * is never coerced to `0`. Coercing would report 345 spurious critical activities.
 *
 * No Node built-ins: the same code runs in the browser (§5.2).
 */

import type { XerFile } from '../contracts/xer'
import { programmeCalendar } from './calendar'

/** DCMA 6 and 8 are both stated in days, and it is the same 44 (§3.7). */
export const DCMA_HIGH_DAYS = 44

/**
 * The documented fallback day length (§10.10). Safe on the real evidence: 44 of 54 real
 * `CALENDAR` rows decode to an eight-hour day and the other 10 are a stock elapsed calendar
 * no activity is assigned to.
 */
export const FALLBACK_HOURS_PER_DAY = 8

/**
 * A day length with its provenance attached, because §10.10 requires the check to record
 * **which of the two was used** — a 44-day threshold is 352 hours on an eight-hour calendar
 * and 1,056 on a 24-hour elapsed one, and a reader cannot tell those apart from the verdict.
 */
export interface HoursPerDay {
  readonly hours: number
  readonly source: 'programme_calendar' | 'fallback'
}

/**
 * The programme calendar's day length, or the documented fixed 8 (§10.10).
 *
 * The same calendar-selection rule `time.duration_working_days` uses — `PROJECT.clndr_id`,
 * never `default_flag` — so the spec carries one calendar rule rather than two. The
 * fallback covers three cases with one branch: no calendar named, the named calendar
 * missing or undecodable, and a decoded calendar that reports **no** day length because its
 * week is ragged or dead (`hours_per_working_day: null`, §8.11).
 */
export function hoursPerDay(file: XerFile): HoursPerDay {
  const selected = programmeCalendar(file)
  if (selected.state !== 'ok') return { hours: FALLBACK_HOURS_PER_DAY, source: 'fallback' }
  const hours = selected.calendar.hours_per_working_day
  if (hours === null || hours <= 0) return { hours: FALLBACK_HOURS_PER_DAY, source: 'fallback' }
  return { hours, source: 'programme_calendar' }
}

/** The 44 days of DCMA 6 and 8, in the hours the file's own columns are written in. */
export function highThresholdHours(day: HoursPerDay): number {
  return DCMA_HIGH_DAYS * day.hours
}

/** Hours as days on a day length. The one place the division happens. */
export function hoursToDays(hours: number, day: HoursPerDay): number {
  return hours / day.hours
}

/**
 * The three bands the row's sliver prints, in the order it prints them.
 *
 * `null` is not a band. An activity with no float is *not described* by this axis, which is
 * why it leaves the denominator rather than joining `ok`.
 */
export type FloatBand = 'neg' | 'ok' | 'high'

/**
 * Which band a float value sits in, or `null` where there is no float to band.
 *
 * The boundary is `> 44 days`, strictly — an activity with exactly 44 days of float passes
 * DCMA 6, and the two must agree because the sliver and the check are read side by side.
 */
export function floatBand(hours: number | null | undefined, highHours: number): FloatBand | null {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return null
  if (hours < 0) return 'neg'
  return hours > highHours ? 'high' : 'ok'
}

/** Percentages that print as three fixed numeric slots and **must sum to 100** (§6.2). */
export interface FloatMix {
  neg: number
  ok: number
  high: number
}

/**
 * The row payload's `float_mix` (§6.2).
 *
 * Integers summing to exactly 100, by largest remainder — the three numbers print beside a
 * sliver whose light-mode amber measures 2.11:1 against the surface, below the 3:1 floor, so
 * they are what makes the band legible and they may not be dropped or left not adding up.
 *
 * Nulls are **excluded from the base**, not folded into `ok`: folding would say "this
 * activity has acceptable float" about an activity that reports none. A programme where
 * every row's float is empty therefore returns three zeroes and draws an empty sliver, which
 * is the honest rendering of "this programme reports no float at all".
 */
export function floatMix(values: readonly (number | null)[], highHours: number): FloatMix {
  const counts = { neg: 0, ok: 0, high: 0 }
  let total = 0
  for (const v of values) {
    const band = floatBand(v, highHours)
    if (band === null) continue
    counts[band]++
    total++
  }
  if (total === 0) return { neg: 0, ok: 0, high: 0 }

  // Largest remainder: floor everything, then hand the shortfall to the biggest fractions.
  const exact = [
    { key: 'neg' as const, share: (counts.neg / total) * 100 },
    { key: 'ok' as const, share: (counts.ok / total) * 100 },
    { key: 'high' as const, share: (counts.high / total) * 100 },
  ]
  const mix: FloatMix = { neg: 0, ok: 0, high: 0 }
  let assigned = 0
  for (const e of exact) {
    mix[e.key] = Math.floor(e.share)
    assigned += mix[e.key]
  }
  const order = [...exact].sort((a, b) => (b.share % 1) - (a.share % 1))
  for (let i = 0; assigned < 100; i++) {
    const e = order[i % order.length]
    if (!e) break
    mix[e.key]++
    assigned++
  }
  return mix
}
