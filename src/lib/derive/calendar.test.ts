import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { XerCell, XerFile, XerTable } from '../contracts/xer'
import {
  decodeClndrData,
  durationWorkingDays,
  programmeCalendar,
  readCalendars,
  sameCalendarMeaning,
} from './calendar'
import type { DateWindow } from './dates'
import { countWorkingDates, durationCalendarDays } from './dates'

/**
 * The corpus is the only test data CI will ever have — real `.xer` files are commercial
 * data and permanently gitignored. Each golden's `calendars` block is written from what the
 * generator **intended to emit**, never from parsing the result, so agreeing with it is a
 * real claim about this decoder rather than a round trip.
 *
 * Reading fixture bytes with `node:fs` happens here and nowhere else: the calendar module
 * itself carries no Node built-ins because the same code runs in the browser.
 */
const CORPUS = fileURLToPath(new URL('../../../fixtures/synthetic/corpus/', import.meta.url))

// --- a fixture reader, deliberately minimal ----------------------------------

/**
 * Just enough `.xer` to reach `CALENDAR`, `TASK` and `PROJECT`. The real parser is another
 * module's; this exists so these tests are independent of it and of its schedule.
 *
 * A record begins at `%`; anything else is a continuation of the value before it, which is
 * what `text-multiline`'s embedded CRLF inside `task_name` needs.
 */
function readFixture(name: string): XerFile {
  const text = readFileSync(`${CORPUS}${name}`, 'latin1')
  const records: string[] = []
  for (const raw of text.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw
    if (line.startsWith('%') || records.length === 0) records.push(line)
    else records[records.length - 1] = `${records[records.length - 1]}\n${line}`
  }

  const tables = new Map<string, XerTable>()
  let name_ = ''
  let fields: string[] = []
  let rows: XerCell[][] = []
  const flush = () => {
    if (!name_) return
    const index = new Map<string, number>()
    for (const [i, f] of fields.entries()) index.set(f, i)
    tables.set(name_, { name: name_, fields, index, rows })
  }
  for (const record of records) {
    const parts = record.split('\t')
    if (parts[0] === '%T') {
      flush()
      name_ = parts[1] ?? ''
      fields = []
      rows = []
    } else if (parts[0] === '%F') {
      fields = parts.slice(1)
    } else if (parts[0] === '%R') {
      rows.push(parts.slice(1))
    }
  }
  flush()
  return { header: null, tables, issues: [], terminated: text.includes('%E') }
}

interface GoldenShift {
  label: string
}
interface Golden {
  calendars?: {
    clndr_id: number
    clndr_name: string
    declared: { day_hr_cnt: number | null; week_hr_cnt: number | null }
    serialisation: Record<string, unknown>
    week: { day: number; name: string; works: boolean; shifts: string[]; hours: number }[]
    hours_per_working_day: number | null
    working_days_per_week: number
    hours_per_week: number
    exceptions: { date: string; serial: number; works: boolean; shifts: string[]; hours: number }[]
    same_meaning_as: number | null
  }[]
  assertions?: { duration_working_days?: Record<string, unknown> }
  tasks?: {
    early_start_date: string | null
    early_end_date: string | null
    act_start_date: string | null
    act_end_date: string | null
  }[]
}

const golden = (fixture: string): Golden =>
  JSON.parse(readFileSync(`${CORPUS}${fixture}.expected.json`, 'utf8'))

const fixtures = readdirSync(CORPUS)
  .filter((f) => f.endsWith('.expected.json'))
  .map((f) => f.replace('.expected.json', ''))
  .sort()

/**
 * `[time.start_date, time.finish_date]` as the golden's own activity dump gives it — the
 * earliest start and the latest finish, actuals first. Derived here rather than imported so
 * these assertions do not wait on whoever owns `derived.time`.
 */
function windowOf(g: Golden): DateWindow | null {
  const starts: string[] = []
  const finishes: string[] = []
  for (const t of g.tasks ?? []) {
    const s = t.act_start_date || t.early_start_date
    const f = t.act_end_date || t.early_end_date
    if (s) starts.push(s)
    if (f) finishes.push(f)
  }
  if (!starts.length || !finishes.length) return null
  starts.sort()
  finishes.sort()
  return {
    start: (starts[0] as string).slice(0, 10),
    finish: (finishes[finishes.length - 1] as string).slice(0, 10),
  }
}

// --- the goldens' `calendars` block ------------------------------------------

describe('the corpus `calendars` block, day by day and hour by hour', () => {
  const withCalendars = fixtures.filter((f) => (golden(f).calendars ?? []).length > 0)

  it('covers every calendar-bearing fixture', () => {
    expect(withCalendars.length).toBe(27)
  })

  for (const fixture of withCalendars) {
    it(fixture, () => {
      const file = readFixture(`${fixture}.xer`)
      const records = readCalendars(file)
      const want = golden(fixture).calendars ?? []
      expect(records.length).toBe(want.length)

      records.forEach((record, i) => {
        const w = want[i] as NonNullable<Golden['calendars']>[number]
        expect(record.clndr_id).toBe(w.clndr_id)
        expect(record.clndr_name).toBe(w.clndr_name)
        expect(record.declared).toEqual(w.declared)
        if (record.decoded.state !== 'ok') throw new Error(record.decoded.reason)
        const c = record.decoded.calendar

        // Serialisation is a fact about the bytes and never about the meaning, which is
        // exactly why the golden records it: every combination must decode alike (§8.9).
        expect(c.serialisation).toEqual(w.serialisation)

        expect(c.week.length).toBe(7)
        c.week.forEach((day, d) => {
          const wd = w.week[d] as NonNullable<Golden['calendars']>[number]['week'][number]
          expect({ day: day.day, name: day.name, works: day.works }).toEqual({
            day: wd.day,
            name: wd.name,
            works: wd.works,
          })
          expect(day.shifts.map((s: GoldenShift) => s.label)).toEqual(wd.shifts)
          expect(day.hours).toBe(wd.hours)
        })

        expect(c.hours_per_working_day).toBe(w.hours_per_working_day)
        expect(c.working_days_per_week).toBe(w.working_days_per_week)
        expect(c.hours_per_week).toBe(w.hours_per_week)

        // Emission order, not date order: one real fixture lists 46023, 46381, 46025.
        expect(c.exceptions.length).toBe(w.exceptions.length)
        c.exceptions.forEach((e, j) => {
          const we = w.exceptions[j] as NonNullable<
            Golden['calendars']
          >[number]['exceptions'][number]
          expect({ date: e.date, serial: e.serial, works: e.works, hours: e.hours }).toEqual({
            date: we.date,
            serial: we.serial,
            works: we.works,
            hours: we.hours,
          })
          expect(e.shifts.map((s: GoldenShift) => s.label)).toEqual(we.shifts)
        })
      })

      // `same_meaning_as` is the one claim no per-row comparison against intent can make.
      want.forEach((w, i) => {
        if (w.same_meaning_as === null) return
        const j = want.findIndex((other) => other.clndr_id === w.same_meaning_as)
        const a = records[i]?.decoded
        const b = records[j]?.decoded
        if (a?.state !== 'ok' || b?.state !== 'ok') throw new Error('a pair did not decode')
        expect(sameCalendarMeaning(a.calendar, b.calendar)).toBe(true)
      })
    })
  }
})

// --- what the calendars are for ----------------------------------------------

describe('duration_working_days over the whole corpus', () => {
  for (const fixture of fixtures) {
    it(fixture, () => {
      const g = golden(fixture)
      const want = g.assertions?.duration_working_days
      if (!want) return
      const file = readFixture(`${fixture}.xer`)
      const { value, issues } = durationWorkingDays(file, windowOf(g))
      if (want.state) {
        expect(value).toEqual(want)
      } else {
        expect(value).toEqual({ state: 'ok', ...want })
      }
      // Only `error` raises an issue; `unavailable` is absent-from-source (§8.13).
      expect(issues).toEqual([])

      // §3.4's invariants, which the two window fields only satisfy on one convention:
      // both are counts of `[start, finish]` with both ends in them.
      if (!('days' in value)) return
      const window = windowOf(g) as DateWindow
      const span = durationCalendarDays(window.start, window.finish) as number
      expect(span).toBeGreaterThanOrEqual(1)
      expect(value.days).toBeGreaterThanOrEqual(0)
      expect(value.days).toBeLessThanOrEqual(span)
      const selected = programmeCalendar(file)
      if (selected.state !== 'ok') throw new Error('the calendar decoded a moment ago')
      // Equality **exactly when** the programme calendar has no non-working date inside it.
      expect(value.days === span).toBe(countWorkingDates(selected.calendar, window) === span)
    })
  }
})

describe('the programme calendar is PROJECT.clndr_id', () => {
  it('is not default_flag: cal-default-unused declares three and uses one', () => {
    const file = readFixture('cal-default-unused.xer')
    const selected = programmeCalendar(file)
    if (selected.state !== 'ok') throw new Error(selected.reason)
    // `default_flag = Y` sits on a seven-day calendar nothing uses; reading it converts the
    // span to 100% of itself instead of 71% (§8.13).
    expect(selected.record.default_flag).toBe('N')
    expect(selected.calendar.working_days_per_week).toBe(5)
    expect(selected.activity_share_pct).toBe(100)
    const flagged = readCalendars(file).filter((c) => c.default_flag === 'Y')
    expect(flagged.length).toBe(1)
    expect(flagged[0]?.clndr_id).not.toBe(selected.record.clndr_id)
  })

  it('does not fall back to the first CALENDAR row when the named one is absent', () => {
    const selected = programmeCalendar(readFixture('cal-project-clndr-absent.xer'))
    expect(selected).toEqual({
      state: 'unavailable',
      reason: "PROJECT.clndr_id 841 is not in the file's CALENDAR table",
    })
  })

  it('reports unavailable where activities span more than one project', () => {
    const selected = programmeCalendar(readFixture('multiproj-two-proj-id.xer'))
    expect(selected).toEqual({
      state: 'unavailable',
      reason: 'activities span 2 projects, so there is no single programme calendar',
    })
  })

  it('reports unavailable where there is no CALENDAR table', () => {
    for (const fixture of ['missing-calendar', 'enc-zeroed-file']) {
      expect(programmeCalendar(readFixture(`${fixture}.xer`))).toEqual({
        state: 'unavailable',
        reason: 'no CALENDAR table, so there is no shift pattern to convert on',
      })
    }
  })
})

// --- the rules, each one on its own -------------------------------------------

const ok = (blob: string) => {
  const r = decodeClndrData(blob)
  if (r.state !== 'ok') throw new Error(r.reason)
  return r.calendar
}

/**
 * One weekday's worth of `clndr_data`: day 2 carries `shifts`, the rest are empty, and
 * `extra` is any sibling of `DaysOfWeek` — a `VIEW` or an `Exceptions` node.
 */
const week = (shifts: string, extra = '') =>
  '(0||CalendarData()((0||DaysOfWeek()(' +
  `(0||1()())(0||2()(${shifts}))(0||3()())(0||4()())(0||5()())(0||6()())(0||7()())` +
  `))${extra}))`

describe('§8.10 the end-of-day rule', () => {
  it('reads a finish of 00:00 as the end of the day, keyed on the finish', () => {
    expect(ok(week('(0||0(s|00:00|f|00:00)())')).week[1]?.hours).toBe(24)
    expect(ok(week('(0||0(s|08:00|f|00:00)())')).week[1]?.hours).toBe(16)
  })

  it('is not `finish == start`: a degenerate zero-length shift is a decode error', () => {
    const r = decodeClndrData(week('(0||0(s|08:00|f|08:00)())'))
    expect(r.state).toBe('error')
    expect(r.state === 'error' && r.reason).toContain('08:00-08:00')
  })

  it('keeps the written clock in the label, and 24 in the arithmetic', () => {
    const shift = ok(week('(0||0(s|08:00|f|00:00)())')).week[1]?.shifts[0]
    expect(shift?.label).toBe('08:00-00:00')
    expect(shift?.finish).toBe(24)
  })

  it('makes `f < s` after the transform an error, not a wrap to a night shift', () => {
    const r = decodeClndrData(week('(0||0(s|17:00|f|09:00)())'))
    expect(r.state).toBe('error')
  })
})

describe('§8.9 only the parentheses carry structure', () => {
  it('decodes the indented and flat serialisations of one calendar alike', () => {
    const flat = ok(week('(0||0(s|08:00|f|16:00)())'))
    const indented = ok(week('(0||0(s|08:00|f|16:00)())').replace(/\)\(/g, ')\x7f\x7f  ('))
    expect(sameCalendarMeaning(flat, indented)).toBe(true)
    expect(flat.serialisation.layout).toBe('flat')
    expect(indented.serialisation.layout).toBe('indented')
    expect(indented.serialisation.has_0x7f).toBe(true)
  })

  it('reads shift attributes by key, in either order', () => {
    const startFirst = ok(week('(0||0(s|08:00|f|12:00)())'))
    const finishFirst = ok(week('(0||0(f|12:00|s|08:00)())'))
    expect(finishFirst.week[1]?.hours).toBe(4)
    expect(sameCalendarMeaning(startFirst, finishFirst)).toBe(true)
    expect(finishFirst.serialisation.shift_attrs).toBe('finish-first')
  })

  it('tolerates an unpadded hour', () => {
    const c = ok(week('(0||0(f|12:00|s|8:00)())'))
    expect(c.week[1]?.hours).toBe(4)
    expect(c.week[1]?.shifts[0]?.label).toBe('08:00-12:00')
    expect(c.serialisation.pad_hours).toBe(false)
  })

  it('takes more than one shift a day', () => {
    const c = ok(week('(0||0(s|08:00|f|12:00)())(0||1(s|13:00|f|17:00)())'))
    expect(c.week[1]?.hours).toBe(8)
    expect(c.week[1]?.shifts.length).toBe(2)
  })

  it('ignores VIEW, in both spellings, and does not require Exceptions', () => {
    for (const total of ['N', 'Y']) {
      const c = ok(week('(0||0(s|08:00|f|16:00)())', `(0||VIEW(ShowTotal|${total})())`))
      expect(c.serialisation.view_node).toBe(true)
      // 271 of 563 real calendars carry no `Exceptions` node at all. Do not require it.
      expect(c.exceptions).toEqual([])
      expect(c.working_days_per_week).toBe(1)
    }
    expect(ok(week('(0||0(s|08:00|f|16:00)())')).serialisation.view_node).toBe(false)
  })

  it('reads an exception with shift children as a working day bought back', () => {
    const c = ok(
      week(
        '(0||0(s|08:00|f|16:00)())',
        '(0||Exceptions()((0||0(d|46023)())(0||33(d|39633)((0||0(s|08:00|f|16:00)())))))',
      ),
    )
    expect(c.exceptions.map((e) => ({ date: e.date, works: e.works, hours: e.hours }))).toEqual([
      { date: '2026-01-01', works: false, hours: 0 },
      { date: '2008-07-04', works: true, hours: 8 },
    ])
  })
})

describe('§8.12 the shapes known not to decode', () => {
  it('1. finds the week under an anonymous root wrapper', () => {
    const blob =
      '(0||()((0||CalendarData()())(0||DaysOfWeek()((0||1()())(0||2()(' +
      '(0||0(s|08:00|f|16:00)())))(0||3()())(0||4()())(0||5()())(0||6()())(0||7()())))' +
      '(0||Exceptions()())))'
    const c = ok(blob)
    expect(c.working_days_per_week).toBe(1)
    expect(c.hours_per_working_day).toBe(8)
  })

  it('2. reads twelve-hour clock times on the space, as MPXJ does', () => {
    const c = ok(week('(0||0(s|8:00 AM|f|12:00 PM)())(0||1(s|1:00 PM|f|5:00 PM)())'))
    expect(c.week[1]?.shifts.map((s) => s.label)).toEqual(['08:00-12:00', '13:00-17:00'])
    expect(c.week[1]?.hours).toBe(8)
    // The silent failure the naive `Number('00 PM')` read hides: this pair is 9 hours, and
    // reading `5:00 PM` as `05:00` makes it a decode error instead.
    expect(ok(week('(0||0(s|8:00 AM|f|5:00 PM)())')).week[1]?.hours).toBe(9)
    expect(ok(week('(0||0(s|12:00 AM|f|12:00 PM)())')).week[1]?.hours).toBe(12)
  })

  it('3. skips empty shift nodes, so `works` means has a populated shift', () => {
    const blob =
      '(0||CalendarData()((0||DaysOfWeek()((0||1()((0||0()())(0||1()())(0||2()())))' +
      '(0||2()((0||0(s|08:00|f|16:00)())))(0||3()())(0||4()())(0||5()())(0||6()())' +
      '(0||7()((0||0()())(0||1()())(0||2()())))))))'
    const c = ok(blob)
    expect(c.week[0]?.works).toBe(false)
    expect(c.week[6]?.works).toBe(false)
    expect(c.working_days_per_week).toBe(1)
  })

  it('reports rather than throws when a blob will not decode', () => {
    for (const blob of ['', '(0||CalendarData()())', 'not a calendar at all']) {
      const r = decodeClndrData(blob)
      expect(r.state).toBe('error')
      expect(r.state === 'error' && r.reason.length).toBeGreaterThan(0)
    }
  })
})

describe('§8.11 hours per day', () => {
  it('is null on a ragged week rather than a first-day guess', () => {
    const blob =
      '(0||CalendarData()((0||DaysOfWeek()((0||1()())(0||2()((0||0(s|08:00|f|00:00)())))' +
      '(0||3()((0||0(s|08:00|f|16:00)())))(0||4()())(0||5()())(0||6()())(0||7()())))))'
    const c = ok(blob)
    expect(c.week[1]?.hours).toBe(16)
    expect(c.week[2]?.hours).toBe(8)
    expect(c.hours_per_working_day).toBeNull()
    expect(c.hours_per_week).toBe(24)
  })

  it('is null where no day works at all', () => {
    const c = ok(week(''))
    expect(c.hours_per_working_day).toBeNull()
    expect(c.working_days_per_week).toBe(0)
  })

  it('reads the elapsed calendar as 24 hours a day, in all three serialisations', () => {
    const days = (attrs: string) =>
      `(0||CalendarData()((0||DaysOfWeek()(${[1, 2, 3, 4, 5, 6, 7]
        .map((d) => `(0||${d}()((0||0(${attrs})())))`)
        .join('')}))))`
    for (const attrs of ['f|00:00|s|00:00', 's|00:00|f|00:00']) {
      const c = ok(days(attrs))
      expect(c.hours_per_working_day).toBe(24)
      expect(c.working_days_per_week).toBe(7)
      expect(c.hours_per_week).toBe(168)
    }
  })
})
