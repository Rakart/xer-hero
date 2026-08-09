import { describe, expect, it } from 'vitest'
import type { DecodedCalendar } from './calendar'
import { decodeClndrData } from './calendar'
import {
  anchorKind,
  countWorkingDates,
  dateFromDayNumber,
  dateFromSerial,
  dayNumber,
  durationCalendarDays,
  instantAtWorkingHour,
  isMilestoneType,
  isWorkingDate,
  milestoneAnchor,
  SERIAL_EPOCH_DAYS,
  serialFromDate,
  weekdayOfDate,
  workingDatesIn,
} from './dates'

/** A calendar from a blob rather than a hand-built literal, so the model stays one thing. */
function calendarOf(blob: string): DecodedCalendar {
  const r = decodeClndrData(blob)
  if (r.state !== 'ok') throw new Error(r.reason)
  return r.calendar
}

const weekOf = (days: number[], shifts: string, exceptions = '') =>
  calendarOf(
    '(0||CalendarData()((0||DaysOfWeek()(' +
      [1, 2, 3, 4, 5, 6, 7].map((d) => `(0||${d}()(${days.includes(d) ? shifts : ''}))`).join('') +
      `))${exceptions ? `(0||Exceptions()(${exceptions}))` : ''}))`,
  )

/** Monday–Friday, 08:00–16:00 — the shape 266 of 563 real rows have, minus the weekend. */
const FIVE_DAY = weekOf([2, 3, 4, 5, 6], '(0||0(s|08:00|f|16:00)())')
/** The lunch-break shape: the common real two-shift day. */
const LUNCH = weekOf([2, 3, 4, 5, 6], '(0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())')

// --- the serial epoch --------------------------------------------------------

describe('the 1899-12-30 day serial', () => {
  it('puts 1970-01-01 at 25569', () => {
    expect(SERIAL_EPOCH_DAYS).toBe(25569)
    expect(dateFromSerial(25569)).toBe('1970-01-01')
    expect(serialFromDate('1899-12-30')).toBe(0)
  })

  it('decodes real exception serials onto the holidays they are', () => {
    // The evidence for the epoch (§8.9): all 94 distinct serials in one real file land on
    // 4 July, 25 December, 1 January and a floating late-November Thanksgiving. Under
    // 1899-12-31 they come out a day later — 5 July, 26 December, 2 January — and mean
    // nothing.
    expect(dateFromSerial(39633)).toBe('2008-07-04')
    expect(dateFromSerial(46023)).toBe('2026-01-01')
    expect(dateFromSerial(46381)).toBe('2026-12-25')
    expect(dateFromSerial(46025)).toBe('2026-01-03')
  })

  it('round-trips every serial across a century', () => {
    for (let s = 30000; s < 66000; s += 7) {
      expect(serialFromDate(dateFromSerial(s))).toBe(s)
    }
  })

  it('agrees with a timezone-free reference, which is what "naive" has to mean', () => {
    // A UTC reference carries no local offset, so equality here is a positive statement
    // that nothing in this module reads a host timezone (§3.4).
    for (const serial of [46022, 46023, 46104, 46200, 46381]) {
      const utc = new Date((serial - SERIAL_EPOCH_DAYS) * 86400000).toISOString().slice(0, 10)
      expect(dateFromSerial(serial)).toBe(utc)
    }
  })
})

describe('naive local dates', () => {
  it('reads the date out of a P6 timestamp without applying an offset', () => {
    expect(dayNumber('2026-01-05 08:00')).toBe(dayNumber('2026-01-05'))
    expect(dayNumber('2026-01-05 23:59')).toBe(dayNumber('2026-01-05'))
    expect(dateFromDayNumber(dayNumber('2026-01-05 08:00') as number)).toBe('2026-01-05')
  })

  it('returns null rather than a wrong date for anything unreadable', () => {
    for (const bad of ['', null, undefined, 'not a date', '2026-13-01', '2026-02-30']) {
      expect(dayNumber(bad)).toBeNull()
    }
    expect(dayNumber('2028-02-29')).not.toBeNull()
  })

  it('numbers the weekdays P6s way, 1 = Sunday', () => {
    expect(weekdayOfDate('2026-01-04')).toBe(1) // a Sunday
    expect(weekdayOfDate('2026-01-05')).toBe(2)
    expect(weekdayOfDate('2026-01-10')).toBe(7) // a Saturday
    expect(weekdayOfDate('1970-01-01')).toBe(5) // a Thursday
  })
})

// --- duration_calendar_days --------------------------------------------------

describe('duration_calendar_days is an inclusive count (§3.4)', () => {
  it('is 1 for a programme that starts and finishes on one date, never 0', () => {
    expect(durationCalendarDays('2026-01-05', '2026-01-05')).toBe(1)
  })

  it('is (finish - start)/86400000 + 1', () => {
    expect(durationCalendarDays('2026-01-05', '2026-01-06')).toBe(2)
    expect(durationCalendarDays('2017-04-24', '2023-08-11')).toBe(2301)
  })

  it('counts across a leap day and across a year boundary', () => {
    expect(durationCalendarDays('2028-02-28', '2028-03-01')).toBe(3)
    expect(durationCalendarDays('2026-12-31', '2027-01-01')).toBe(2)
  })

  it('is null where either date is absent, and only then', () => {
    expect(durationCalendarDays(null, '2026-01-05')).toBeNull()
    expect(durationCalendarDays('2026-01-05', null)).toBeNull()
    expect(durationCalendarDays(null, null)).toBeNull()
  })
})

// --- working-day walks -------------------------------------------------------

describe('the working-day walk', () => {
  it('counts both ends of the window', () => {
    // Monday to Friday inclusive is five, not four. Counting exclusive of the finish
    // leaves all 25 reporting corpus files low by one (§8.13).
    expect(countWorkingDates(FIVE_DAY, { start: '2026-01-05', finish: '2026-01-09' })).toBe(5)
    expect(countWorkingDates(FIVE_DAY, { start: '2026-01-05', finish: '2026-01-05' })).toBe(1)
  })

  it('reaches 0 on a window falling entirely on non-working dates', () => {
    // `days = 0` is reachable and correct (§3.4).
    expect(countWorkingDates(FIVE_DAY, { start: '2026-01-10', finish: '2026-01-11' })).toBe(0)
  })

  it('skips the weekend and lands 10 working days in a fortnight', () => {
    expect(countWorkingDates(FIVE_DAY, { start: '2026-01-05', finish: '2026-01-18' })).toBe(10)
  })

  it('lets an exception override the weekday pattern in both directions', () => {
    // 46023 is Thursday 2026-01-01, a working weekday made non-working; 46025 is Saturday
    // 2026-01-03, a non-working weekday bought back (§8.11).
    const cal = weekOf(
      [2, 3, 4, 5, 6],
      '(0||0(s|08:00|f|16:00)())',
      '(0||0(d|46023)())(0||1(d|46025)((0||0(s|08:00|f|12:00)())))',
    )
    expect(isWorkingDate(cal, '2026-01-01')).toBe(false)
    expect(isWorkingDate(cal, '2026-01-03')).toBe(true)
    expect(isWorkingDate(cal, '2026-01-02')).toBe(true)
    expect(workingDatesIn(cal, { start: '2026-01-01', finish: '2026-01-04' })).toEqual([
      '2026-01-02',
      '2026-01-03',
    ])
  })

  it('equals the calendar-day count exactly where nothing in the window is non-working', () => {
    const sevenDay = weekOf([1, 2, 3, 4, 5, 6, 7], '(0||0(s|08:00|f|16:00)())')
    const window = { start: '2026-01-05', finish: '2026-02-15' }
    expect(countWorkingDates(sevenDay, window)).toBe(
      durationCalendarDays(window.start, window.finish),
    )
  })

  it('returns 0 for an absent window rather than guessing one', () => {
    expect(countWorkingDates(FIVE_DAY, null)).toBe(0)
  })
})

// --- milestones and anchor instants (§8.14) ----------------------------------

describe('milestones are selected on task_type', () => {
  it('takes TT_Mile and TT_FinMile and nothing else', () => {
    expect(isMilestoneType('TT_Mile')).toBe(true)
    expect(isMilestoneType('TT_FinMile')).toBe(true)
    for (const t of ['TT_Task', 'TT_LOE', 'TT_WBS', '', null, undefined]) {
      expect(isMilestoneType(t)).toBe(false)
    }
  })

  it('does not read equal early dates as a milestone test', () => {
    // A completed activity has no remaining span, so P6 collapses its early dates to a
    // point: 26,325 of one real programme's 105,028 `TT_Task` rows carry equal early dates
    // and 26,307 of those are `TK_Complete` (§8.14).
    expect(milestoneAnchor('TT_Task', '2026-03-25 16:00', '2026-03-25 16:00')).toBeNull()
  })

  it('gives a finish milestone a finish instant and a start milestone a start instant', () => {
    expect(anchorKind('TT_FinMile')).toBe('finish')
    expect(anchorKind('TT_Mile')).toBe('start')
    expect(milestoneAnchor('TT_FinMile', '2026-03-25 16:00', '2026-03-25 16:00')).toEqual({
      instant: '2026-03-25 16:00',
      kind: 'finish',
    })
    expect(milestoneAnchor('TT_Mile', '2026-03-26 08:00', '2026-03-26 08:00')).toEqual({
      instant: '2026-03-26 08:00',
      kind: 'start',
    })
  })
})

describe('working-hour instants', () => {
  it('writes one working moment two ways, 16 elapsed hours apart', () => {
    // §8.14's own example. 2026-03-23 is a Monday, so working hour 24 falls on the day
    // boundary the section names: the END of hour 23 is `2026-03-25 16:00` and the
    // BEGINNING of hour 24 is `2026-03-26 08:00` — one working moment, 16 elapsed hours
    // apart. Getting these backwards makes a finish milestone rank strictly later than the
    // tasks it finishes with.
    expect(instantAtWorkingHour(FIVE_DAY, '2026-03-23', 24, 'finish')).toEqual({
      date: '2026-03-25',
      time: '16:00',
    })
    expect(instantAtWorkingHour(FIVE_DAY, '2026-03-23', 24, 'start')).toEqual({
      date: '2026-03-26',
      time: '08:00',
    })
  })

  it('starts at the first working date on or after the origin', () => {
    // 2026-01-03 is a Saturday; hour 0 is Monday morning.
    expect(instantAtWorkingHour(FIVE_DAY, '2026-01-03', 0, 'start')).toEqual({
      date: '2026-01-05',
      time: '08:00',
    })
  })

  it('steps over the lunch break rather than through it', () => {
    expect(instantAtWorkingHour(LUNCH, '2026-01-05', 3, 'start')).toEqual({
      date: '2026-01-05',
      time: '11:00',
    })
    expect(instantAtWorkingHour(LUNCH, '2026-01-05', 4, 'start')).toEqual({
      date: '2026-01-05',
      time: '13:00',
    })
    expect(instantAtWorkingHour(LUNCH, '2026-01-05', 4, 'finish')).toEqual({
      date: '2026-01-05',
      time: '12:00',
    })
  })

  it('has no preceding working hour to end at hour 0', () => {
    expect(instantAtWorkingHour(FIVE_DAY, '2026-01-05', 0, 'finish')).toBeNull()
  })

  it('rolls midnight onto the next date on a 24-hour calendar', () => {
    const elapsed = weekOf([1, 2, 3, 4, 5, 6, 7], '(0||0(s|00:00|f|00:00)())')
    expect(instantAtWorkingHour(elapsed, '2026-01-05', 24, 'finish')).toEqual({
      date: '2026-01-06',
      time: '00:00',
    })
    expect(instantAtWorkingHour(elapsed, '2026-01-05', 24, 'start')).toEqual({
      date: '2026-01-06',
      time: '00:00',
    })
  })

  it('returns null on a calendar with no working day at all', () => {
    expect(instantAtWorkingHour(weekOf([], ''), '2026-01-05', 0, 'start')).toBeNull()
  })
})
