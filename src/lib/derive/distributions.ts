/**
 * `distributions` (§3.8) — the S-curve, the two histograms and the activity-type mix.
 *
 * **Buckets are fixed, never adaptive.** Two histograms are only comparable if they share
 * bucket edges, and revision diff — the feature planners are most likely to want next — is a
 * histogram *subtraction*. Adaptive buckets would make it impossible and the damage would
 * not surface until v2, by which time every published object would carry edges of its own.
 * The arrays below are the spec's, transcribed, and they are constants for that reason.
 *
 * The S-curve buckets by **month**: one real fixture spans 6.4 years and produces 77 points,
 * where weekly would be 334 and buys nothing at detail-page scale.
 */

import type { Histogram, SCurve } from '../contracts/derived'
import type { ActivityRow } from './activities'
import { activityFinish, activityStart } from './activities'
import type { DateWindow } from './dates'
import { dayNumber } from './dates'
import type { HoursPerDay } from './float'
import { hoursToDays } from './float'

/**
 * `null` at either end is an open bound; `counts.length` is always `edges.length - 1`, with
 * bucket *i* covering `[edges[i], edges[i+1])`.
 *
 * Float is open at both ends — negative float has no floor and a dormant activity's float
 * has no ceiling. Duration is closed at 0, because there is no such thing as minus four days
 * of work.
 */
export const FLOAT_HISTOGRAM_EDGES: readonly (number | null)[] = [
  null,
  -20,
  0,
  5,
  10,
  20,
  44,
  100,
  200,
  null,
]

export const DURATION_HISTOGRAM_EDGES: readonly (number | null)[] = [
  0,
  1,
  5,
  10,
  20,
  44,
  100,
  200,
  null,
]

/**
 * A century of months. A programme spanning longer than this is data damage rather than a
 * programme, and the arrays are in the size budget (§3.11) — so the curve clamps rather than
 * letting one mistyped year turn a 60 KB object into a megabyte of empty buckets.
 */
export const S_CURVE_MAX_MONTHS = 1200

const MONTH_RE = /^(\d{4})-(\d{2})/

/** Months since year 0, so two dates can be compared and subtracted as whole months. */
function monthIndex(date: string | null | undefined): number | null {
  if (!date) return null
  // Validated through the same civil arithmetic every other date field uses, so a
  // `2026-13-40` cannot open a bucket range nothing will ever fall into.
  if (dayNumber(date) === null) return null
  const m = MONTH_RE.exec(date.trim())
  if (!m) return null
  return Number(m[1]) * 12 + (Number(m[2]) - 1)
}

function monthLabel(index: number): string {
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
}

/**
 * Starts, finishes and cumulative finishes per month over the programme window.
 *
 * The window is passed in rather than derived here, for the same reason
 * `durationWorkingDays` takes one: `time.start_date`, `time.finish_date`, both duration
 * fields and this curve must all be counting **one** window (§3.4).
 *
 * Activities outside the window are clamped into the first or last bucket rather than
 * dropped — a curve whose totals do not add up to the activity count is worse than a curve
 * with a spike at one end, and the spike is itself a true statement about the file.
 */
export function sCurve(rows: readonly ActivityRow[], window: DateWindow | null): SCurve {
  const first = monthIndex(window?.start)
  const last = monthIndex(window?.finish)
  if (first === null || last === null || last < first) {
    return { bucket: 'month', from: null, to: null, starts: [], finishes: [], cumulative: [] }
  }
  const count = Math.min(last - first + 1, S_CURVE_MAX_MONTHS)
  const starts = new Array<number>(count).fill(0)
  const finishes = new Array<number>(count).fill(0)

  const bucket = (date: string | null): number | null => {
    const index = monthIndex(date)
    if (index === null) return null
    return Math.min(Math.max(index - first, 0), count - 1)
  }
  for (const row of rows) {
    const s = bucket(activityStart(row))
    if (s !== null) starts[s] = (starts[s] ?? 0) + 1
    const f = bucket(activityFinish(row))
    if (f !== null) finishes[f] = (finishes[f] ?? 0) + 1
  }

  let running = 0
  const cumulative = finishes.map((n) => (running += n))
  return {
    bucket: 'month',
    from: monthLabel(first),
    to: monthLabel(first + count - 1),
    starts,
    finishes,
    cumulative,
  }
}

/** Which fixed bucket a value in days falls in. Below the first finite edge clamps to 0. */
function bucketOf(days: number, edges: readonly (number | null)[]): number {
  for (let i = 0; i < edges.length - 1; i++) {
    const lower = edges[i] ?? null
    const upper = edges[i + 1] ?? null
    if ((lower === null || days >= lower) && (upper === null || days < upper)) return i
  }
  return 0
}

/**
 * Bucket a column of **hours** into the fixed day-edged buckets.
 *
 * The edges are days and the columns are hours, so something has to divide — and it divides
 * on the programme calendar's day length, the same conversion DCMA 6 and 8 use (§10.10), so
 * the chart and the check cannot disagree about what 44 days is. On a 24-hour elapsed
 * calendar a hard-coded 8 would put everything over a fortnight in the top bucket.
 */
function bucketed(
  values: readonly (number | null)[],
  edges: readonly (number | null)[],
  day: HoursPerDay,
): { counts: number[]; nullCount: number } {
  const counts = new Array<number>(edges.length - 1).fill(0)
  let nullCount = 0
  for (const hours of values) {
    if (hours === null || !Number.isFinite(hours)) {
      nullCount++
      continue
    }
    const i = bucketOf(hoursToDays(hours, day), edges)
    counts[i] = (counts[i] ?? 0) + 1
  }
  return { counts, nullCount }
}

/**
 * The float histogram, with **`null_count` as its own field** (§3.8).
 *
 * Empty float is not zero float. One real fixture has 345 null-float activities and exactly
 * 345 completed ones — float is absent precisely *because* the work is done — so coercing
 * them into the zero bucket would report 345 spurious critical activities. They are counted,
 * named and kept out of every bucket.
 *
 * It stays in the contract because it is what makes revision diff a subtraction, but it is a
 * **stat, not a chart**: it draws as a single spike on every programme that exists, and a
 * different spike each time, so the page renders it as a table (§6.3).
 */
export function floatHistogram(activities: readonly ActivityRow[], day: HoursPerDay): Histogram {
  const { counts, nullCount } = bucketed(
    activities.map((row) => row.total_float_hr_cnt),
    FLOAT_HISTOGRAM_EDGES,
    day,
  )
  return { unit: 'days', edges: [...FLOAT_HISTOGRAM_EDGES], counts, null_count: nullCount }
}

/**
 * The original-duration histogram — `target_drtn_hr_cnt`, the column DCMA 8 reads.
 *
 * An absent duration is counted as zero rather than skipped, because a row with no original
 * duration is a milestone and belongs in the `[0, 1)` bucket with the other milestones. That
 * is the opposite treatment to float, and deliberately so: absent float is *unknown* while
 * absent duration is *none*.
 */
export function durationHistogram(activities: readonly ActivityRow[], day: HoursPerDay): Histogram {
  const { counts } = bucketed(
    activities.map((row) => row.target_drtn_hr_cnt ?? 0),
    DURATION_HISTOGRAM_EDGES,
    day,
  )
  return { unit: 'days', edges: [...DURATION_HISTOGRAM_EDGES], counts }
}

/**
 * Count rows by one of their text columns, in first-seen order.
 *
 * P6 enumerations may never be treated as closed (§2.4), so this counts **what the file
 * says** rather than projecting onto a known list — `unknown-table-and-enum.xer` carries
 * `TT_LOE` and `TT_WBS` and both must appear in the mix rather than vanishing into an
 * "other" bucket that hides them.
 */
export function countBy(
  rows: readonly ActivityRow[],
  key: (row: ActivityRow) => string,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const row of rows) {
    const k = key(row)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

export function activityTypeMix(rows: readonly ActivityRow[]): Record<string, number> {
  return countBy(rows, (row) => row.task_type)
}
