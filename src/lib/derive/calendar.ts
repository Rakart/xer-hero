/**
 * `CALENDAR.clndr_data`, decoded — and the calendar model everything downstream reads
 * (§2.6, §8.9–§8.13).
 *
 * Oracle documents nothing beyond the field name "Data", so every rule here was settled
 * against 563 real `CALENDAR` rows, and each one has a measured cost when it is dropped
 * (§8.10). Four are load-bearing enough to restate at the top:
 *
 * - **Only the parentheses carry structure.** `0x7F` and whitespace are layout and are
 *   stripped before parsing. Base calendars carry 34–352 DEL bytes; the project calendars
 *   beside them in the same file carry zero and sit on one flat line. Treating `0x7F 0x7F`
 *   as a record separator leaves 2 of 27 corpus files decoding at all.
 * - **Shift attributes are an order-free key-value bag, not a tuple.** `s|08:00|f|16:00`
 *   and `f|12:00|s|8:00` occur in the same file. A positional read does not throw — it
 *   reports a −8 hour working day, which reaches a user as a duration.
 * - **Hours are not zero-padded.** `s|8:00` occurs. A `\d\d:\d\d` pattern silently drops
 *   most of a day's shifts and reports a four-hour day.
 * - **A shift whose *finish* is `00:00` runs to the end of the day**, keyed on the finish
 *   and never on `finish == start`. 137 of 563 real rows carry it in three serialisations.
 *
 * The primary entry point takes the **raw string**, not a parsed file, and returns
 * `{state: 'error', reason}` rather than throwing: §8.12 lists four real shapes a decoder
 * is expected to *report* on, and §8.13 already has somewhere for the report to go.
 *
 * No Node built-ins anywhere — the same code runs in the browser.
 */

import type { DerivedIssue, DurationWorkingDays, WorkingDayCalendar } from '../contracts/derived'
import type { XerFile, XerTable } from '../contracts/xer'
import { cell, reader } from '../contracts/xer'
import type { DateWindow } from './dates'
import { countWorkingDates, DAY_NAMES, dateFromSerial } from './dates'

// --- the model ---------------------------------------------------------------

/** One shift of one day. `hours` is decimal and always positive — §8.10 makes 0 a failure. */
export interface WorkShift {
  /**
   * Canonical `HH:MM-HH:MM`, hour zero-padded — the form the goldens print, and the form
   * an unpadded or twelve-hour source is normalised into. The *written* clock, so an
   * end-of-day finish still reads `00:00`; `finish` below carries what it means.
   */
  readonly label: string
  /** Decimal hours from midnight. */
  readonly start: number
  /** Decimal hours from midnight, **24 where the shift runs to the end of the day**. */
  readonly finish: number
  /** `finish − start`, rounded to two places. */
  readonly hours: number
}

/** One of the seven `DaysOfWeek` children. */
export interface CalendarDay {
  /** P6's key, 1–7. **Day 1 is Sunday** (§2.6). */
  readonly day: number
  /** `Sunday` … `Saturday`, so a golden reads by eye. */
  readonly name: string
  /** **Has at least one populated shift** — not merely *has children* (§8.12). */
  readonly works: boolean
  readonly shifts: readonly WorkShift[]
  readonly hours: number
}

/** One `Exceptions` entry: a date the weekday pattern does not describe. */
export interface CalendarException {
  /** Decoded from the serial on the 1899-12-30 epoch. */
  readonly date: string
  /** The `d|<serial>` attribute as written. */
  readonly serial: number
  /** Shift children present — a **working day bought back** (§8.11). */
  readonly works: boolean
  readonly shifts: readonly WorkShift[]
  readonly hours: number
}

/**
 * How the meaning was written down. **None of it is meaning; all of it is a parser trap**
 * (§8.9) — reported so a fixture can assert that two serialisations decode alike.
 */
export interface CalendarSerialisation {
  /** `indented` where any layout byte separates nodes, `flat` where none does. */
  readonly layout: 'indented' | 'flat'
  /** The order the shift bag was written in. `mixed` where one calendar uses both. */
  readonly shift_attrs: 'start-first' | 'finish-first' | 'mixed' | null
  /** False where any hour was written unpadded (`s|8:00`). `null` where there is no clock. */
  readonly pad_hours: boolean | null
  /** A `VIEW` node was present. A display setting; 273 of 563 real calendars carry none. */
  readonly view_node: boolean
  readonly has_0x7f: boolean
}

/** What a `clndr_data` blob means. The **only** trustworthy statement of it (§2.6). */
export interface DecodedCalendar {
  /** All seven days in key order, so `week[weekday - 1]` is the day. Index 0 is Sunday. */
  readonly week: readonly CalendarDay[]
  /**
   * The common day length, or `null` where no day works **or** the worked days are not all
   * the same length — a ragged week (§8.11). `null` rather than a first-day guess, because
   * guessing is exactly what `day_hr_cnt` does. After the end-of-day rule it can no longer
   * be `0`, so the `null` check is the only guard a consumer needs.
   */
  readonly hours_per_working_day: number | null
  readonly working_days_per_week: number
  /** Sum over the worked days, exceptions excluded — the number `week_hr_cnt` can contradict. */
  readonly hours_per_week: number
  /** **In emission order. Exceptions are not sorted** (§8.9). */
  readonly exceptions: readonly CalendarException[]
  readonly serialisation: CalendarSerialisation
}

/**
 * The decoder's result. `error` rather than a thrown exception because two of 563 real rows
 * genuinely do not decode and §8.13 routes them to `{state, reason}` plus an `issues[]`
 * warn (§8.12).
 */
export type CalendarDecode =
  | { readonly state: 'ok'; readonly calendar: DecodedCalendar }
  | { readonly state: 'error'; readonly reason: string }

// --- the grammar -------------------------------------------------------------

interface RawNode {
  readonly name: string
  readonly attrs: string
  readonly children: readonly RawNode[]
}

class ClndrDecodeError extends Error {}

/** Annotated on the binding, not just the arrow, so a call narrows the code after it. */
const fail: (message: string) => never = (message) => {
  throw new ClndrDecodeError(`clndr_data: ${message}`)
}

/**
 * `0x7F` (DEL), space, tab, CR, LF. **Layout, everywhere and always** — this is the rule
 * that was stated backwards for a long time and cost a parser every project calendar in
 * every file (§8.9).
 */
const isLayout = (ch: string) =>
  ch === '\x7f' || ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n'

/**
 * `node ::= '(' head [ '(' attrs ')' [ '(' children ')' ] ] ')'`, nested, with `0||`
 * stripped off the head (§8.10).
 *
 * Returns the layout bytes it skipped as well as the tree, because `serialisation.layout` is
 * a fact about the bytes and this is the only place that sees them.
 */
function parseNodes(blob: string): { nodes: RawNode[]; layoutChars: number } {
  let i = 0
  let layoutChars = 0

  const skip = () => {
    while (i < blob.length) {
      const ch = blob[i]
      if (ch === undefined || !isLayout(ch)) break
      i++
      layoutChars++
    }
  }

  // A parenthesised group's raw text: a head, or an attribute bag. Children are read by
  // the caller. Trimmed at the ends only — `8:00 AM` carries a space that is not layout.
  const group = () => {
    const start = i
    while (i < blob.length && blob[i] !== '(' && blob[i] !== ')') i++
    return blob.slice(start, i).trim()
  }

  const node = (): RawNode => {
    skip()
    if (blob[i] !== '(') fail(`expected "(" at ${i}`)
    i++
    const head = group()
    let attrs = ''
    const children: RawNode[] = []
    if (blob[i] === '(') {
      i++
      attrs = group()
      if (blob[i] !== ')') fail(`attribute group not closed at ${i}`)
      i++
      skip()
      if (blob[i] === '(') {
        i++
        for (;;) {
          skip()
          if (blob[i] === ')') {
            i++
            break
          }
          if (i >= blob.length) fail('child group not closed')
          children.push(node())
        }
      }
    }
    skip()
    if (blob[i] !== ')') fail(`node "${head}" not closed at ${i}`)
    i++
    return { name: head.replace(/^0\|\|/, ''), attrs, children }
  }

  const nodes: RawNode[] = []
  for (;;) {
    skip()
    if (i >= blob.length) return { nodes, layoutChars }
    nodes.push(node())
  }
}

/**
 * `s|08:00|f|16:00`, `f|12:00|s|8:00`, `d|46023`, `ShowTotal|N` — all the same shape.
 *
 * **Order-free. Never read by position.** The key order comes back beside the bag only so
 * `serialisation.shift_attrs` can report which way round the bytes were written.
 */
function attrBag(attrs: string): { bag: Map<string, string>; keys: string[] } {
  const bag = new Map<string, string>()
  const keys: string[] = []
  if (!attrs) return { bag, keys }
  const parts = attrs.split('|')
  for (let k = 0; k + 1 < parts.length; k += 2) {
    const key = (parts[k] ?? '').trim()
    keys.push(key)
    bag.set(key, (parts[k + 1] ?? '').trim())
  }
  return { bag, keys }
}

/** What the decoder learned about the bytes on its way through them. */
interface Trace {
  padded: boolean
  sawClock: boolean
  attrOrders: Set<'start-first' | 'finish-first'>
}

/**
 * A clock value as decimal hours from midnight.
 *
 * **Two formats, discriminated on the space**, which is how MPXJ tells them apart (§8.12):
 * `8:00` is 24-hour and `8:00 AM` is twelve-hour. The twelve-hour form appears in one real
 * calendar, and a naive `split(':')` + `Number` reads `1:00 PM` as `01:00` *silently* —
 * `Number('00 PM')` is `NaN` and `m || 0` swallows it. It happens to give the right answer
 * for that file's morning/afternoon pair and would not for `s|8:00 AM|f|5:00 PM`.
 *
 * **The hour is not zero-padded** in the 24-hour form (§2.6): `s|8:00` occurs, six of 24
 * time values in one real calendar, and a `\d\d:\d\d` pattern drops them all.
 */
function parseClock(text: string, trace: Trace): number {
  const raw = text.trim()
  if (!raw) fail('a shift carries an empty clock value')
  const space = raw.indexOf(' ')
  let clock = raw
  let meridiem: 'AM' | 'PM' | null = null
  if (space >= 0) {
    clock = raw.slice(0, space)
    const suffix = raw
      .slice(space + 1)
      .trim()
      .toUpperCase()
    if (suffix !== 'AM' && suffix !== 'PM') fail(`clock "${raw}" has an unreadable meridiem`)
    meridiem = suffix as 'AM' | 'PM'
  }
  const parts = clock.split(':')
  if (parts.length !== 2) fail(`clock "${raw}" is not HH:MM`)
  const hourText = parts[0] ?? ''
  const minuteText = parts[1] ?? ''
  if (!/^\d{1,2}$/.test(hourText) || !/^\d{1,2}$/.test(minuteText)) {
    fail(`clock "${raw}" is not HH:MM`)
  }
  trace.sawClock = true
  if (hourText.length !== 2) trace.padded = false
  const minutes = Number(minuteText)
  if (minutes > 59) fail(`clock "${raw}" has ${minutes} minutes`)
  let hours = Number(hourText)
  if (meridiem) {
    if (hours < 1 || hours > 12) fail(`clock "${raw}" is not a twelve-hour time`)
    hours = (hours % 12) + (meridiem === 'PM' ? 12 : 0)
  } else if (hours > 23) {
    // `24:00` is not representable: every clock value in 563 real calendars is one of ten,
    // and `00:00` is the format's only spelling of end-of-day (§8.10).
    fail(`clock "${raw}" is not a 24-hour time`)
  }
  return hours + minutes / 60
}

const round2 = (n: number) => Math.round(n * 100) / 100
const clockLabel = (hours: number) => {
  const minutes = Math.round(hours * 60)
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/**
 * One shift child, or `null` where the node is an **empty slot**.
 *
 * `(0||2()())` — a shift node with an empty attribute group — is how one real file writes a
 * non-working day, eleven times, three slots each on days 1 and 7 of a five-day calendar.
 * The old rule made it an error; **it must be a skip**, and a day's `works` therefore means
 * *has at least one populated shift* (§8.12).
 */
function shiftOf(node: RawNode, trace: Trace): WorkShift | null {
  const { bag, keys } = attrBag(node.attrs)
  if (keys.length === 0) return null
  const s = bag.get('s')
  const f = bag.get('f')
  if (s === undefined || f === undefined) {
    fail(`shift "${node.attrs}" carries no s/f pair`)
  }
  for (const key of keys) {
    if (key === 's') {
      trace.attrOrders.add('start-first')
      break
    }
    if (key === 'f') {
      trace.attrOrders.add('finish-first')
      break
    }
  }
  const start = parseClock(s, trace)
  const written = parseClock(f, trace)
  // §8.10: a **finish** of 00:00 runs to the end of the day. Keyed on the finish, never on
  // `finish == start` — `s|08:00|f|08:00` is zero hours and `s|08:00|f|00:00` is sixteen.
  const finish = written === 0 ? 24 : written
  const hours = round2(finish - start)
  const label = `${clockLabel(start)}-${clockLabel(written)}`
  if (hours <= 0) {
    // A zero or negative day is the signature of a positional read rather than a night
    // shift, and is unobserved in 563 calendars. §8.10, §8.12(4), marked overturnable.
    fail(`shift ${label} is ${hours} hours long`)
  }
  return { label, start, finish, hours }
}

const sumHours = (shifts: readonly WorkShift[]) =>
  round2(shifts.reduce((total, s) => total + s.hours, 0))

/**
 * The sibling list `DaysOfWeek` lives in.
 *
 * Not "the children of `CalendarData`": two real `CA_Project` calendars are written
 * `(0||()( (0||CalendarData()()) (0||DaysOfWeek()(…)) (0||Exceptions()()) ))`, where
 * `CalendarData` is an **empty sibling marker** and not the parent of anything. A decoder
 * that takes `CalendarData`'s children finds the unnamed wrapper and throws — those are the
 * only 2 of 563 real rows that fail to decode outright (§8.12). Keying on `DaysOfWeek`,
 * which is the node that actually carries the week, decodes both shapes and needs no branch.
 */
function scopeOf(nodes: readonly RawNode[]): readonly RawNode[] | null {
  if (nodes.some((n) => n.name === 'DaysOfWeek')) return nodes
  for (const n of nodes) {
    const found = scopeOf(n.children)
    if (found) return found
  }
  return null
}

/**
 * Decode a raw `clndr_data` string.
 *
 * Takes the string rather than a parsed file so it stays independently testable, and so
 * §8.12's undecodable shapes can be **reported** rather than thrown.
 */
export function decodeClndrData(blob: string): CalendarDecode {
  try {
    return { state: 'ok', calendar: decode(blob) }
  } catch (e) {
    return { state: 'error', reason: e instanceof Error ? e.message : String(e) }
  }
}

function decode(blob: string): DecodedCalendar {
  const trace: Trace = { padded: true, sawClock: false, attrOrders: new Set() }
  const { nodes, layoutChars } = parseNodes(blob)
  const scope = scopeOf(nodes)
  if (!scope) fail('no DaysOfWeek node')
  const daysOfWeek = scope.find((n) => n.name === 'DaysOfWeek')
  if (!daysOfWeek) fail('no DaysOfWeek node')

  const week: CalendarDay[] = []
  for (let d = 1; d <= 7; d++) {
    const dayNode = daysOfWeek.children.find((n) => n.name === String(d))
    if (!dayNode) fail(`no node for day ${d}`)
    const shifts: WorkShift[] = []
    for (const child of dayNode.children) {
      const shift = shiftOf(child, trace)
      if (shift) shifts.push(shift)
    }
    week.push({
      day: d,
      name: DAY_NAMES[d - 1] ?? String(d),
      works: shifts.length > 0,
      shifts,
      hours: sumHours(shifts),
    })
  }

  // The `Exceptions` node is **optional** — 271 of 563 real calendars carry none (§8.9).
  const exceptionNodes = scope.find((n) => n.name === 'Exceptions')?.children ?? []
  const exceptions: CalendarException[] = exceptionNodes.map((n) => {
    const { bag } = attrBag(n.attrs)
    const text = bag.get('d')
    const serial = text === undefined ? Number.NaN : Number(text)
    if (!Number.isFinite(serial)) fail(`exception "${n.attrs}" has no date`)
    const shifts: WorkShift[] = []
    for (const child of n.children) {
      const shift = shiftOf(child, trace)
      if (shift) shifts.push(shift)
    }
    return {
      date: dateFromSerial(serial),
      serial,
      works: shifts.length > 0,
      shifts,
      hours: sumHours(shifts),
    }
  })

  const worked = week.filter((d) => d.works)
  const lengths = new Set(worked.map((d) => d.hours))
  const orders = [...trace.attrOrders]
  return {
    week,
    // `null` where no day works or the week is ragged, never a first-day guess (§8.11).
    hours_per_working_day: lengths.size === 1 ? (worked[0]?.hours ?? null) : null,
    working_days_per_week: worked.length,
    hours_per_week: round2(worked.reduce((total, d) => total + d.hours, 0)),
    exceptions,
    serialisation: {
      layout: layoutChars > 0 ? 'indented' : 'flat',
      shift_attrs: orders.length === 1 ? (orders[0] ?? null) : orders.length === 0 ? null : 'mixed',
      pad_hours: trace.sawClock ? trace.padded : null,
      // `(0||VIEW(ShowTotal|N)())` is a display setting, and `ShowTotal|Y` occurs too.
      // Ignore it; do not choke on it (§2.6).
      view_node: scope.some((n) => n.name === 'VIEW'),
      has_0x7f: blob.includes('\x7f'),
    },
  }
}

/**
 * Do two blobs decode to the same calendar?
 *
 * The claim `cal-flat-no-0x7f` exists to make: one calendar written twice, indented and
 * flat, start-first and finish-first, padded and not — and both must mean the same thing.
 * Serialisation is deliberately excluded; it is precisely what must *not* count.
 */
export function sameCalendarMeaning(a: DecodedCalendar, b: DecodedCalendar): boolean {
  return meaningKey(a) === meaningKey(b)
}

function meaningKey(c: DecodedCalendar): string {
  const week = c.week.map((d) => `${d.day}:${d.shifts.map((s) => s.label).join(',')}`).join('|')
  const exceptions = [...c.exceptions]
    .sort((x, y) => x.serial - y.serial)
    .map((e) => `${e.serial}:${e.shifts.map((s) => s.label).join(',')}`)
    .join('|')
  return `${week}//${exceptions}`
}

// --- reading calendars out of a parsed file ----------------------------------

/** One `CALENDAR` row, with what it declares kept beside what it means. */
export interface CalendarRecord {
  readonly clndr_id: number
  readonly clndr_name: string
  readonly clndr_type: string | null
  readonly default_flag: string | null
  /**
   * What the row *claims*. **Neither column may feed a computed figure and neither may
   * sanity-check the other** (§8.11): Oracle documents them as units-conversion factors for
   * entering and displaying durations, never validated against the shifts, and
   * `week_hr_cnt` contradicts the decoded pattern on 290 of 561 populated real rows. Both
   * can also be absent from the `%F` list entirely, which is `null` here.
   */
  readonly declared: { readonly day_hr_cnt: number | null; readonly week_hr_cnt: number | null }
  readonly clndr_data: string
  readonly decoded: CalendarDecode
}

const numberOrNull = (v: string | undefined) => {
  if (v === undefined || v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Every `CALENDAR` row in the file, decoded. Empty where the file carries no such table. */
export function readCalendars(file: XerFile): CalendarRecord[] {
  const table = file.tables.get('CALENDAR')
  if (!table) return []
  const id = reader(table, 'clndr_id')
  const name = reader(table, 'clndr_name')
  const data = reader(table, 'clndr_data')
  return table.rows.map((row) => ({
    clndr_id: Number(id?.(row) ?? Number.NaN),
    clndr_name: name?.(row) ?? '',
    clndr_type: cell(table, row, 'clndr_type') ?? null,
    default_flag: cell(table, row, 'default_flag') ?? null,
    declared: {
      day_hr_cnt: numberOrNull(cell(table, row, 'day_hr_cnt')),
      week_hr_cnt: numberOrNull(cell(table, row, 'week_hr_cnt')),
    },
    clndr_data: data?.(row) ?? '',
    decoded: decodeClndrData(data?.(row) ?? ''),
  }))
}

/**
 * The programme calendar, selected and decoded — or the reason there is none.
 *
 * **`PROJECT.clndr_id`, not `default_flag` and not the first `CALENDAR` row** (§8.13).
 * Measured over 14 real files carrying 3–5 calendars apiece: distinct `TASK.clndr_id` is 1
 * on 14 of 14 and is the calendar `PROJECT.clndr_id` names on 14 of 14. `default_flag` is
 * absent from 12 of the 14, and on one of the two that carry it names a calendar holding 0
 * of 1,746 activities — it marks what *new activities inherit*, not what a programme is
 * measured on. Reading `default_flag` instead scores 27/29 on the corpus; falling back to
 * the first `CALENDAR` row scores 28/29.
 */
export type ProgrammeCalendar =
  | {
      readonly state: 'ok'
      readonly record: CalendarRecord
      readonly calendar: DecodedCalendar
      /** Share of `TASK` rows actually on it, to one place. */
      readonly activity_share_pct: number
    }
  | { readonly state: 'unavailable'; readonly reason: string }
  /** `clndr_id` as the file wrote it, so the caller can name it in its `issues[]` entry. */
  | { readonly state: 'error'; readonly reason: string; readonly clndr_id: string }

const unavailable = (reason: string) => ({ state: 'unavailable', reason }) as const

const distinct = (table: XerTable | undefined, field: string): string[] => {
  if (!table) return []
  const read = reader(table, field)
  if (!read) return []
  return [...new Set(table.rows.map((row) => read(row)))]
}

export function programmeCalendar(file: XerFile): ProgrammeCalendar {
  const calendars = file.tables.get('CALENDAR')
  const rows = calendars?.rows ?? []
  // Checked in §8.13's order: an absent table is absent from source, not a failed
  // computation, so it is `unavailable` and raises no `issues[]` entry.
  if (!calendars || rows.length === 0) {
    return unavailable('no CALENDAR table, so there is no shift pattern to convert on')
  }

  const task = file.tables.get('TASK')
  const projIds = distinct(task, 'proj_id')
  if (projIds.length !== 1) {
    return unavailable(
      `activities span ${projIds.length} projects, so there is no single programme calendar`,
    )
  }
  const projId = projIds[0] ?? ''

  const project = file.tables.get('PROJECT')
  const projRowId = project ? reader(project, 'proj_id') : null
  const owner = project?.rows.find((row) => projRowId?.(row) === projId)
  const named = project && owner ? (cell(project, owner, 'clndr_id') ?? '') : ''
  if (!named) return unavailable(`the PROJECT row for proj_id ${projId} names no calendar`)

  const calId = reader(calendars, 'clndr_id')
  const index = rows.findIndex((row) => calId?.(row) === named)
  if (index < 0) {
    // Two perfectly good calendars may sit beside it and **neither may be substituted**.
    return unavailable(`PROJECT.clndr_id ${named} is not in the file's CALENDAR table`)
  }

  const record = readCalendars(file)[index]
  if (!record) return unavailable(`PROJECT.clndr_id ${named} is not in the file's CALENDAR table`)
  if (record.decoded.state === 'error') {
    return {
      state: 'error',
      reason: `clndr_data for calendar ${named} did not decode: ${record.decoded.reason}`,
      clndr_id: named,
    }
  }

  const taskCal = task ? reader(task, 'clndr_id') : null
  const taskRows = task?.rows ?? []
  const on = taskCal ? taskRows.filter((row) => taskCal(row) === named).length : 0
  return {
    state: 'ok',
    record,
    calendar: record.decoded.calendar,
    activity_share_pct: Math.round((on / (taskRows.length || 1)) * 1000) / 10,
  }
}

/** The `{clndr_id, name, working_days_per_week}` that rides inside the number (§3.4). */
export function workingDayCalendarOf(
  record: CalendarRecord,
  calendar: DecodedCalendar,
): WorkingDayCalendar {
  return {
    clndr_id: record.clndr_id,
    name: record.clndr_name,
    working_days_per_week: calendar.working_days_per_week,
  }
}

/**
 * `time.duration_working_days` (§3.4, §8.13) — the programme's span converted on the
 * calendar the file names as the programme's own, reported **with that calendar inside the
 * same object** and with the share of activities actually on it.
 *
 * The calendar rides beside the number for the same reason `critical_count` never ships
 * without `critical_threshold_hr`: a working-day count without its calendar is the same
 * species of lie. The figure carries **no hours** — a working-day span never divides by a
 * day length, which is what makes it immune to the elapsed calendar of §8.11.
 *
 * `window` is `[time.start_date, time.finish_date]`, both ends counted. It is passed in
 * rather than derived here so this and `duration_calendar_days` cannot count two different
 * windows.
 *
 * The returned `issues` is empty except on `error`, which is the one branch that is a
 * *computation failure* rather than an absence.
 */
export function durationWorkingDays(
  file: XerFile,
  window: DateWindow | null,
): { value: DurationWorkingDays; issues: DerivedIssue[] } {
  const selected = programmeCalendar(file)
  if (selected.state === 'unavailable') {
    return { value: { state: 'unavailable', reason: selected.reason }, issues: [] }
  }
  if (selected.state === 'error') {
    return {
      value: { state: 'error', reason: selected.reason },
      issues: [clndrDecodeIssue(selected.clndr_id)],
    }
  }
  return {
    value: {
      state: 'ok',
      days: countWorkingDates(selected.calendar, window),
      calendar: workingDayCalendarOf(selected.record, selected.calendar),
      activity_share_pct: selected.activity_share_pct,
    },
    issues: [],
  }
}

/**
 * The `issues[]` entry an `error` state owes.
 *
 * **Only `error` raises one** (§8.13): `unavailable` is *absent from source* and `error` is
 * *computation failed*, and lighting the "partially analysed" banner on every calendar-less
 * programme would be a lie about which happened.
 */
export function clndrDecodeIssue(clndrId: string | number): DerivedIssue {
  return {
    stat: 'time.duration_working_days',
    severity: 'warn',
    reason: `clndr_data parse failed for clndr_id ${clndrId}`,
  }
}
