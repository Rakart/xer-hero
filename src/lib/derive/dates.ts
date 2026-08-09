/**
 * Dates, day serials, and working-day walks — the arithmetic every calendar-shaped stat
 * stands on (§2.6, §3.4, §8.11, §8.13, §8.14).
 *
 * **Dates are naive local wall-clock.** The `.xer` records no timezone anywhere, so
 * converting to UTC would invent information (§3.4). Nothing here calls `new Date(string)`
 * or reads a host offset: dates are handled as civil `YYYY-MM-DD` text and as integer day
 * numbers, and the two conversions are pure arithmetic. That is also why the module carries
 * no Node built-ins — the same code runs in the browser.
 *
 * **The serial epoch is 1899-12-30**, the Excel/OLE serial, verified by decoding all 94
 * distinct exception serials in a real file: they land on 4 July, 25 December, 1 January and
 * a floating late-November Thanksgiving. The 1899-12-31 epoch puts them a day off and
 * meaningless (§8.9).
 */

import type { DecodedCalendar } from './calendar'

/** `1970-01-01` as an 1899-12-30 day serial. The only place the epoch is written down. */
export const SERIAL_EPOCH_DAYS = 25569

/** P6's `DaysOfWeek` keys, 1-based, **1 = Sunday** (§2.6). Indexable by `weekday - 1`. */
export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

/** A wall-clock instant with no timezone in it, exactly as a `.xer` writes one. */
export interface NaiveInstant {
  /** `YYYY-MM-DD`. */
  readonly date: string
  /** `HH:MM`, 24-hour, zero-padded. */
  readonly time: string
}

// --- civil arithmetic --------------------------------------------------------

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

/** Days since 1970-01-01 for a proleptic Gregorian date. Hinnant's `days_from_civil`. */
function daysFromCivil(y: number, m: number, d: number): number {
  const shifted = m <= 2 ? y - 1 : y
  const era = Math.floor(shifted / 400)
  const yoe = shifted - era * 400
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

/** The inverse. Hinnant's `civil_from_days`. */
function civilFromDays(dayNumber: number): [number, number, number] {
  const z = dayNumber + 719468
  const era = Math.floor(z / 146097)
  const doe = z - era * 146097
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  )
  const y = yoe + era * 400
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp + (mp < 10 ? 3 : -9)
  return [m <= 2 ? y + 1 : y, m, d]
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * Days since 1970-01-01 for a `.xer` date, or `null` where there is no readable date.
 *
 * Accepts the bare `YYYY-MM-DD` and P6's `YYYY-MM-DD HH:MM` alike, because every consumer
 * here measures whole days and a timestamp's date part is the same date.
 */
export function dayNumber(date: string | null | undefined): number | null {
  if (!date) return null
  const m = DATE_RE.exec(date.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12) return null
  const last = mo === 2 && isLeap(y) ? 29 : (DAYS_IN_MONTH[mo - 1] ?? 0)
  if (d < 1 || d > last) return null
  return daysFromCivil(y, mo, d)
}

/** `YYYY-MM-DD` for a day number. */
export function dateFromDayNumber(days: number): string {
  const [y, m, d] = civilFromDays(days)
  return `${String(y).padStart(4, '0')}-${pad2(m)}-${pad2(d)}`
}

/** The 1899-12-30 day serial for a `.xer` date, or `null` where it is unreadable. */
export function serialFromDate(date: string | null | undefined): number | null {
  const days = dayNumber(date)
  return days === null ? null : days + SERIAL_EPOCH_DAYS
}

/** `YYYY-MM-DD` for an 1899-12-30 day serial — the form `Exceptions` writes (§8.9). */
export function dateFromSerial(serial: number): string {
  return dateFromDayNumber(serial - SERIAL_EPOCH_DAYS)
}

/**
 * P6's weekday key for a day number: **1 = Sunday** … 7 = Saturday (§2.6).
 *
 * 1970-01-01 is a Thursday, which is key 5, so the offset is 4.
 */
export function weekdayOfDayNumber(days: number): number {
  return ((((days + 4) % 7) + 7) % 7) + 1
}

/** The same, for a `.xer` date. `null` where the date is unreadable. */
export function weekdayOfDate(date: string | null | undefined): number | null {
  const days = dayNumber(date)
  return days === null ? null : weekdayOfDayNumber(days)
}

// --- the window --------------------------------------------------------------

/** The programme's span, as two naive local dates. Both ends are inside it (§3.4). */
export interface DateWindow {
  readonly start: string
  readonly finish: string
}

/**
 * `duration_calendar_days` — an **inclusive count**, `(finish − start) / 86400000 + 1`
 * (§3.4). A programme starting and finishing on one date is `1`, never `0`.
 *
 * `null` where either date is absent, and only then. This was a v4 correction: the earlier
 * difference convention was false on 14 of 14 real files, where a seven-day programme's
 * working-day count came out one *above* its own calendar-day span.
 */
export function durationCalendarDays(
  start: string | null | undefined,
  finish: string | null | undefined,
): number | null {
  const a = dayNumber(start)
  const b = dayNumber(finish)
  if (a === null || b === null) return null
  return b - a + 1
}

// --- working-day walks -------------------------------------------------------

/** An exception lookup keyed by serial: `true` where the date works, `false` where it does not. */
function exceptionIndex(calendar: DecodedCalendar): Map<number, boolean> {
  const index = new Map<number, boolean>()
  for (const e of calendar.exceptions) index.set(e.serial, e.works)
  return index
}

/**
 * Does this calendar work on this date?
 *
 * **An exception overrides the weekday pattern in both directions** (§8.11): a childless
 * exception makes a working weekday non-working, and an exception carrying shifts makes a
 * non-working weekday work. 306 of the real set's 10,584 exception entries are worked ones,
 * so the second direction is not exotic.
 */
export function isWorkingDate(calendar: DecodedCalendar, date: string): boolean {
  const days = dayNumber(date)
  if (days === null) return false
  return isWorkingDayNumber(calendar, exceptionIndex(calendar), days)
}

function isWorkingDayNumber(
  calendar: DecodedCalendar,
  exceptions: Map<number, boolean>,
  days: number,
): boolean {
  const excepted = exceptions.get(days + SERIAL_EPOCH_DAYS)
  if (excepted !== undefined) return excepted
  return calendar.week[weekdayOfDayNumber(days) - 1]?.works ?? false
}

/**
 * Working dates in `[start, finish]`, **both ends counted** (§8.13).
 *
 * ```
 * days := count of dates d in [time.start_date, time.finish_date]
 *         where (d is in exceptions ? exceptions[d].works : week[weekday(d)].works)
 * ```
 *
 * Whole days, and no hours anywhere. The alternative — working-hour arithmetic between the
 * earliest start instant and the latest finish instant — has to divide by a day length,
 * which is the one operation this figure exists to avoid: a stock calendar in 136 of 138
 * real files decoded to zero hours a day until §8.10's end-of-day rule fixed it. A
 * whole-day counter reproduces P6's own duration arithmetic on 1,685 of 1,685 not-started
 * activities in one real baseline and 3,110 of 3,111 in the other.
 *
 * Counting exclusive of the finish leaves every reporting corpus file low by one (4/29).
 */
export function countWorkingDates(calendar: DecodedCalendar, window: DateWindow | null): number {
  if (!window) return 0
  const first = dayNumber(window.start)
  const last = dayNumber(window.finish)
  if (first === null || last === null) return 0
  const exceptions = exceptionIndex(calendar)
  let days = 0
  for (let d = first; d <= last; d++) {
    if (isWorkingDayNumber(calendar, exceptions, d)) days++
  }
  return days
}

/** The working dates themselves, in order. The same walk, where a caller wants the dates. */
export function workingDatesIn(calendar: DecodedCalendar, window: DateWindow | null): string[] {
  if (!window) return []
  const first = dayNumber(window.start)
  const last = dayNumber(window.finish)
  if (first === null || last === null) return []
  const exceptions = exceptionIndex(calendar)
  const out: string[] = []
  for (let d = first; d <= last; d++) {
    if (isWorkingDayNumber(calendar, exceptions, d)) out.push(dateFromDayNumber(d))
  }
  return out
}

// --- milestones and anchor instants (§8.14) ----------------------------------

/** The two `task_type` values that are milestones. `TT_LOE` and `TT_WBS` are not. */
export const MILESTONE_TASK_TYPES = ['TT_Mile', 'TT_FinMile'] as const

/**
 * **`early_start_date == early_end_date` is not a milestone test** on a progressed
 * programme — use `task_type` (§8.14).
 *
 * A completed activity has no remaining span, so P6 collapses its early dates to a point:
 * 26,325 of one real programme's 105,028 `TT_Task` rows carry equal early dates and 26,307
 * of those are `TK_Complete`. Over the live rows a walk can reach the date-equality test
 * disagrees with `task_type` on 18; over all rows, on 26,325.
 */
export function isMilestoneType(taskType: string | null | undefined): boolean {
  return taskType === 'TT_Mile' || taskType === 'TT_FinMile'
}

/**
 * Which kind of instant a row's date columns hold (§8.14).
 *
 * ```
 * a TT_FinMile writes a FINISH instant into both columns
 * a TT_Mile    writes a START  instant into both columns
 * a TT_Task    writes startAt(es) and finishAt(ef)
 * ```
 *
 * The two differ by one working-hour boundary, and at a day boundary they are
 * `2026-03-25 16:00` and `2026-03-26 08:00` — one working moment written two ways, 16
 * elapsed hours apart. Getting it backwards makes a finish milestone rank strictly later
 * than the tasks it finishes with, which breaks the seed tie of §8.3. P6 writes a finish
 * milestone at its driver's finish instant on 98.3% and 100% of typed live rows in the two
 * real fixtures; a start milestone behaves like a task's start.
 */
export function anchorKind(taskType: string | null | undefined): 'start' | 'finish' {
  return taskType === 'TT_FinMile' ? 'finish' : 'start'
}

/**
 * The single instant a zero-duration row records, with the kind of instant it is.
 *
 * Returns `null` for a row that is not a milestone by `task_type`, because a positive-span
 * row's two dates are two different instants and neither is an anchor.
 */
export function milestoneAnchor(
  taskType: string | null | undefined,
  earlyStartDate: string | null | undefined,
  earlyEndDate: string | null | undefined,
): { instant: string; kind: 'start' | 'finish' } | null {
  if (!isMilestoneType(taskType)) return null
  const kind = anchorKind(taskType)
  // The row writes ONE instant into both columns, so the other column carries the same
  // value — fall back to it rather than report nothing where one of the two is empty.
  const instant =
    (kind === 'finish' ? earlyEndDate : earlyStartDate) || earlyEndDate || earlyStartDate
  if (!instant) return null
  return { instant, kind }
}

// --- working-hour instants ---------------------------------------------------

const HOUR_WALK_LIMIT = 20_000

/** `HH:MM` for decimal hours, rolling a whole day forward where the value reaches 24. */
function splitClock(hours: number): { dayCarry: number; time: string } {
  const minutes = Math.round(hours * 60)
  const dayCarry = Math.floor(minutes / 1440)
  const within = minutes - dayCarry * 1440
  return { dayCarry, time: `${pad2(Math.floor(within / 60))}:${pad2(within % 60)}` }
}

/**
 * The wall-clock instant at a working-hour offset from a date, on a calendar's own shifts.
 *
 * ```
 * startAt(h)  := the BEGINNING of working hour h
 * finishAt(h) := the END of working hour h-1        # a finish instant
 * ```
 *
 * `origin` is the date working hour 0 begins on; the walk skips forward to the first
 * working date on or after it. `finishAt(0)` has **no preceding working hour to end** and
 * returns `null` rather than inventing one — a row held by the project start rather than by
 * a predecessor is written at the project start, which is a scheduling decision and not a
 * date conversion.
 *
 * Returns `null` on a calendar with no working day at all, and where the offset runs past
 * the walk limit.
 */
export function instantAtWorkingHour(
  calendar: DecodedCalendar,
  origin: string,
  hour: number,
  kind: 'start' | 'finish',
): NaiveInstant | null {
  if (kind === 'finish' && hour <= 0) return null
  const target = kind === 'finish' ? hour - 1 : hour
  if (target < 0) return null
  const first = dayNumber(origin)
  if (first === null) return null
  const exceptions = exceptionIndex(calendar)

  let remaining = target
  for (let step = 0; step < HOUR_WALK_LIMIT; step++) {
    const d = first + step
    if (!isWorkingDayNumber(calendar, exceptions, d)) continue
    const shifts = shiftsOn(calendar, exceptions, d)
    for (const shift of shifts) {
      // `<` on a start and `<=` nowhere: hour h begins inside the shift that still has
      // hours left, and the end of hour h-1 is one hour on from that beginning.
      if (remaining < shift.hours) {
        const at = shift.start + remaining + (kind === 'finish' ? 1 : 0)
        const { dayCarry, time } = splitClock(at)
        return { date: dateFromDayNumber(d + dayCarry), time }
      }
      remaining -= shift.hours
    }
  }
  return null
}

/** The shifts worked on one date — the exception's own where it is a bought-back working day. */
function shiftsOn(
  calendar: DecodedCalendar,
  exceptions: Map<number, boolean>,
  days: number,
): readonly { start: number; hours: number }[] {
  const serial = days + SERIAL_EPOCH_DAYS
  if (exceptions.has(serial)) {
    const e = calendar.exceptions.find((x) => x.serial === serial)
    return e?.shifts ?? []
  }
  return calendar.week[weekdayOfDayNumber(days) - 1]?.shifts ?? []
}
