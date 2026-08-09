/**
 * Number, date and size formatting for the programme page (§6.7).
 *
 * Two rules here are not cosmetic.
 *
 * **Dates are naive local wall-clock and are never round-tripped through a `Date`** (§3.4).
 * The `.xer` records no timezone anywhere, so `new Date('2017-04-24')` — which parses as
 * midnight UTC and prints as the 23rd west of Greenwich — would move a programme's start by
 * a day for half the planet. Every date on this page is formatted by string surgery.
 *
 * `uploaded_at` is the exception and is deliberately handled separately: it is a
 * `timestamptz` written by the server, a real instant, and `formatAge` may use a `Date`.
 */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/** The em dash every missing value renders as. A slot is kept; a claim is not invented. */
export const EMPTY = '—'

import { formatCount as sharedFormatCount } from '@/components/shelf/shelf-format'

/**
 * Re-exported, not restated. The shelf's version is written out rather than taken from
 * `Intl` because a grid of counts must not change shape with the server's locale data — and
 * the same is true of a headline number on this page. Two spellings of one grouping rule is
 * how a count reads `1,751` in one place and `1 751` in another on the same deploy.
 */
export { formatCount } from '@/components/shelf/shelf-format'

/** One decimal by default, trailing `.0` kept so a column of percentages stays aligned. */
export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY
  return value.toFixed(digits)
}

/**
 * The gzipped size printed on the download control — that is what the user waits for
 * (§6.7). Binary units, one decimal below 10 units, because `0.9 MB` reads worse than
 * `911 KB` on the one number the button exists to disclose.
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return EMPTY
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const label = units[unit] ?? 'KB'
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${label}`
}

/** `2017-04-24` or `2017-09-29 16:00` or `2017-09-29T16:00` → `24 Apr 2017`. */
export function formatDate(value: string | null | undefined): string {
  const parts = parseNaiveDate(value)
  if (!parts) return EMPTY
  return `${parts.day} ${MONTHS[parts.month - 1]} ${parts.year}`
}

/** The year alone, for the Window tile's `{start}–{finish}`. */
export function formatYear(value: string | null | undefined): string {
  const parts = parseNaiveDate(value)
  return parts ? String(parts.year) : EMPTY
}

/** `2017-04` → `Apr 2017`, for the S-curve's axis and hover layer. */
export function formatMonth(year: number, monthIndex0: number): string {
  const y = year + Math.floor(monthIndex0 / 12)
  const m = ((monthIndex0 % 12) + 12) % 12
  return `${MONTHS[m]} ${y}`
}

export interface NaiveDateParts {
  year: number
  /** 1-based, as written in the file. */
  month: number
  day: number
}

/**
 * String surgery, never `Date.parse`. Accepts the two shapes the contract carries: a bare
 * `YYYY-MM-DD` and a `YYYY-MM-DD` followed by a space or `T` and a wall-clock time.
 */
export function parseNaiveDate(value: string | null | undefined): NaiveDateParts | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!month || month > 12 || !day || day > 31) return null
  return { year, month, day }
}

/** `2017-04` → `{year, month}`. The S-curve's `from` bound. */
export function parseNaiveMonth(
  value: string | null | undefined,
): { year: number; month: number } | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})/.exec(value)
  if (!match) return null
  const month = Number(match[2])
  if (!month || month > 12) return null
  return { year: Number(match[1]), month }
}

/**
 * `3mo`, `2y`, `4d` — the byline's age. Also re-exported rather than restated: the byline and
 * the shelf's slot 12 print the same fact about the same row, and a reader who arrives here
 * from a row that said `3mo` must not be told `2mo`. The comment this replaced claimed the
 * two shapes already matched, and they did not — the scales differed at every boundary.
 */
export { formatAge } from '@/components/shelf/shelf-format'

/**
 * DCMA checks 6 and 8 convert at the hours-per-day the check itself recorded (§10.10), and
 * exemplar values arrive in hours. Eight is the documented fallback: of 54 real `CALENDAR`
 * rows, 44 decode to an eight-hour day.
 */
export const FALLBACK_HOURS_PER_DAY = 8

export function hoursToDays(hours: number, hoursPerDay = FALLBACK_HOURS_PER_DAY): number {
  if (!hoursPerDay) return hours
  return hours / hoursPerDay
}

/** `-240` hours at 8h/day → `-30d`; a fractional result keeps one decimal rather than lying. */
export function formatHoursAsDays(
  hours: number | null | undefined,
  hoursPerDay = FALLBACK_HOURS_PER_DAY,
): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return EMPTY
  const days = hoursToDays(hours, hoursPerDay)
  return `${Number.isInteger(days) ? days : days.toFixed(1)}d`
}

/** `1 revision` / `23 revisions`, without a library and without a `1(s)`. */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${sharedFormatCount(count)} ${count === 1 ? singular : pluralForm}`
}
