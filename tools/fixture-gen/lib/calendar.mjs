// Working-time model + the packed clndr_data blob.
//
// clndr_data layout is OBSERVED, not documented (xer-format.md). Nodes look like
// (0||<name>(<attrs>)(<children>)) and exception dates are day serials with epoch
// 1899-12-30.
//
// ONLY THE PARENTHESES CARRY STRUCTURE. 0x7F and whitespace are layout and carry
// nothing: real CA_Base calendars are indented and separated by 0x7F pairs, real
// CA_Project calendars in the same file contain zero 0x7F bytes and sit on one flat
// line, and the two forms decode to the same tree. Two further degrees of freedom
// travel with the flat form: shift attributes are order-free (`f|12:00|s|8:00`
// occurs alongside `s|08:00|f|16:00`), and the hour is not zero-padded (`s|8:00`).
// All of it measured off real exports — see
// docs/wayfinder/tickets/assets/p6-substitute-validation.md §2.
//
// `layout`, `shiftAttrs` and `padHours` exist so the corpus can emit both
// serialisations of one calendar. A generator that could only emit the indented,
// 0x7F-separated, start-first, zero-padded form emitted precisely the form a parser
// implementing the old (wrong) 0x7F rule still reads correctly, so the corpus could
// not fail one.
//
// Multi-shift days, exception *working* days and the VIEW node were guesses when this
// file was written; all three were confirmed against real exports by 021 and are now
// assertions rather than survival tests.

const SEP = '\x7f\x7f';
const DAY_MS = 86400000;
const EPOCH_OFFSET = 25569; // 1970-01-01 as a 1899-12-30 serial

// P6's DaysOfWeek keys, 1=Sunday. Named so a golden reads by eye.
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const serialOf = (date) => Math.round(date.getTime() / DAY_MS) + EPOCH_OFFSET;

export function pad(n, w = 2) {
  return String(n).padStart(w, '0');
}

export function fmtDateTime(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function fmtDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * A working calendar: which weekdays work, which dates are excepted, and the shift
 * pattern. Dates are handled in UTC throughout because a .xer records no timezone
 * and naive wall-clock is the contract (xer-format.md, gotcha 9).
 */
export class WorkCalendar {
  /**
   * @param {object} opts
   * @param {number[]} opts.workDays  1=Sunday .. 7=Saturday, per P6's DaysOfWeek keys
   * @param {string[]} opts.holidays  'YYYY-MM-DD' non-working exceptions
   * @param {[string,string][]} opts.shifts  [[start,finish], ...] per working day
   */
  constructor({ workDays = [2, 3, 4, 5, 6], holidays = [], shifts = [['08:00', '16:00']] } = {}) {
    this.workDays = workDays;
    this.holidays = new Set(holidays);
    this.shifts = shifts;
    this.hoursPerDay = shifts.reduce((sum, [s, f]) => sum + (hhmm(f) - hhmm(s)), 0);
    this.dayStart = hhmm(shifts[0][0]);
    this._index = null;
  }

  isWorking(date) {
    const dow = date.getUTCDay() + 1; // JS 0=Sunday -> P6 1=Sunday
    return this.workDays.includes(dow) && !this.holidays.has(fmtDate(date));
  }

  /**
   * Build an index of working days around `start`. `before` working days are
   * indexed ahead of it so that hour 0 is the project start and negative offsets —
   * which a late date on a negative-float path really does produce — still resolve.
   */
  buildIndex(start, count, before = 0) {
    const back = [];
    const cursor = new Date(Date.UTC(
      start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(),
    ));
    const rewind = new Date(cursor.getTime());
    while (back.length < before) {
      rewind.setUTCDate(rewind.getUTCDate() - 1);
      if (this.isWorking(rewind)) back.push(new Date(rewind.getTime()));
    }
    back.reverse();

    const fwd = [];
    while (fwd.length < count) {
      if (this.isWorking(cursor)) fwd.push(new Date(cursor.getTime()));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    this._index = [...back, ...fwd];
    this._offset = back.length;
    return this._index;
  }

  _dayAt(h) {
    const day = this._index[this._offset + Math.floor(h / this.hoursPerDay)];
    if (!day) throw new Error(`working-day index does not cover hour ${h}`);
    return day;
  }

  /** Wall-clock instant at working-hour offset `h` treated as a start. */
  startAt(h) {
    const rem = ((h % this.hoursPerDay) + this.hoursPerDay) % this.hoursPerDay;
    return withHour(this._dayAt(h), this.dayStart + rem);
  }

  /** Wall-clock instant at working-hour offset `h` treated as a finish (end of hour h-1). */
  finishAt(h) {
    const back = h - 1;
    const rem = ((back % this.hoursPerDay) + this.hoursPerDay) % this.hoursPerDay;
    return withHour(this._dayAt(back), this.dayStart + rem + 1);
  }

  spanDays() {
    return this._index.length;
  }
}

/**
 * The wall-clock instants a TASK row writes for a working-hour offset — one rule, used
 * by the emitter and by the readable walk, so the two cannot drift apart again.
 *
 * A **finish** is the end of working hour `h - 1` on every row, zero-duration or not.
 * That is the correction [049](../../../docs/wayfinder/tickets/049-generator-milestone-instant.md)
 * made: this generator used to write a zero-duration row's finish as the *start* of hour
 * `h`, so a finish milestone landed at the next morning's `08:00` while the task it
 * finished with sat at the previous afternoon's `16:00`. P6 does the opposite. Measured
 * over 28,695 real milestone rows, **96.4% sit at gap 0** from their latest zero-lag
 * `PR_FS` predecessor's `early_end_date` against 0.8% one shift later, and it is the
 * *task's start* that a non-working gap displaces — 54.1% of 77,853 non-milestone rows
 * ([044](../../../docs/wayfinder/tickets/assets/seed-tie-break.md) §4). So a milestone
 * and the tasks that finish with it write the **same** `early_end_date`, and the tie
 * between them is exact rather than broken by 16 elapsed hours the milestone does not own.
 *
 * A **zero-duration row has no working time in it**, so its start is that same instant:
 * `early_start_date == early_end_date` is what a finish milestone carries in a real
 * export, it is the signal 044's measurement selected those 28,695 rows by, and it is
 * what the readable walk's milestone guard keys on. Splitting them would emit a row whose
 * finish precedes its own start.
 *
 * At `h = 0` there is no preceding working hour to end. A milestone there is held by the
 * project start rather than by a predecessor, so it is written at the project start —
 * the one place where the finish form would date a row before `plan_start_date`, in the
 * backfilled working days that exist only so a negative late date resolves.
 *
 * Positive-duration rows are untouched by all of it: their starts are starts and their
 * finishes are finishes, exactly as before.
 */
const instantOf = (cal, h) => (h === 0 ? cal.startAt(0) : cal.finishAt(h));
export const rowStart = (cal, dur, h) => (dur === 0 ? instantOf(cal, h) : cal.startAt(h));
export const rowFinish = (cal, dur, h) => (dur === 0 ? instantOf(cal, h) : cal.finishAt(h));

function hhmm(s) {
  const [h, m] = s.split(':').map(Number);
  return h + m / 60;
}

function withHour(day, hourFloat) {
  const h = Math.floor(hourFloat);
  const m = Math.round((hourFloat - h) * 60);
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, m));
}

/**
 * Pack a calendar into the clndr_data blob.
 *
 * The first five options describe the calendar's MEANING; the last three describe how
 * that meaning is written down. Every combination of the last three must decode to the
 * same tree — that is the property `cal-flat-no-0x7f` exists to assert.
 *
 * @param {object} opts
 * @param {number[]} opts.workDays
 * @param {[string,string][]} opts.shifts        shifts on a normal working day
 * @param {string[]} opts.holidays               non-working exception dates
 * @param {{date:string, shifts:[string,string][]}[]} opts.workingExceptions
 *        exception days that DO work — confirmed real, and heavily used (021)
 * @param {boolean} opts.view                    emit the VIEW node seen in Fixture B
 * @param {'indented'|'flat'} opts.layout        CA_Base form (0x7F pairs and indents)
 *        or CA_Project form (one line, not one 0x7F byte)
 * @param {'start-first'|'finish-first'} opts.shiftAttrs  `s|..|f|..` or `f|..|s|..`
 * @param {boolean} opts.padHours                `08:00` or `8:00`
 */
export function buildClndrData({
  workDays = [2, 3, 4, 5, 6],
  shifts = [['08:00', '16:00']],
  holidays = [],
  workingExceptions = [],
  view = true,
  layout = 'indented',
  shiftAttrs = 'start-first',
  padHours = true,
} = {}) {
  if (layout !== 'indented' && layout !== 'flat') {
    throw new Error(`clndr_data: unknown layout "${layout}"`);
  }
  if (shiftAttrs !== 'start-first' && shiftAttrs !== 'finish-first') {
    throw new Error(`clndr_data: unknown shiftAttrs "${shiftAttrs}"`);
  }

  // A shift's attributes are a key-value bag, so both orders are legal and a parser
  // must key on `s` and `f` rather than on position. The hour loses its leading zero
  // in the unpadded form; the minutes never do.
  const hhmmOut = (t) => (padHours ? t : t.replace(/^0/, ''));
  const shiftAttr = ([s, f]) => (shiftAttrs === 'finish-first'
    ? `f|${hhmmOut(f)}|s|${hhmmOut(s)}`
    : `s|${hhmmOut(s)}|f|${hhmmOut(f)}`);

  const lines = [];
  // Append `n` closing parens to the line most recently pushed. Every node below is
  // emitted fully closed, so a group only ever has to close itself and its parent.
  const close = (n) => { lines[lines.length - 1] += ')'.repeat(n); };

  lines.push('(0||CalendarData()(');
  lines.push('  (0||DaysOfWeek()(');

  for (let d = 1; d <= 7; d++) {
    if (!workDays.includes(d)) {
      // A day with no shift children is a non-working day.
      lines.push(`    (0||${d}()())`);
      continue;
    }
    lines.push(`    (0||${d}()(`);
    shifts.forEach((shift, i) => lines.push(`      (0||${i}(${shiftAttr(shift)})())`));
    close(2); // day children, day node
  }
  close(2); // DaysOfWeek children, DaysOfWeek node

  if (view) lines.push('  (0||VIEW(ShowTotal|N)())');

  const exceptions = [
    ...holidays.map((date) => ({ date, shifts: [] })),
    ...workingExceptions,
  ];
  if (exceptions.length === 0) {
    lines.push('  (0||Exceptions()())');
  } else {
    lines.push('  (0||Exceptions()(');
    exceptions.forEach((ex, i) => {
      const serial = serialOf(new Date(`${ex.date}T00:00:00Z`));
      if (ex.shifts.length === 0) {
        lines.push(`    (0||${i}(d|${serial})())`);
      } else {
        lines.push(`    (0||${i}(d|${serial})(`);
        ex.shifts.forEach((shift, j) => lines.push(`      (0||${j}(${shiftAttr(shift)})())`));
        close(2); // exception children, exception node
      }
    });
    close(2); // Exceptions children, Exceptions node
  }
  close(2); // CalendarData children, CalendarData node

  // The only difference between the two forms: the indented one keeps its indents and
  // joins on a 0x7F pair, the flat one throws both away. Same nodes, same order, same
  // tree — a parser that reads different calendars out of the two has read the layout.
  const blob = layout === 'flat'
    ? lines.map((line) => line.trimStart()).join('')
    : lines.join(SEP);
  assertBalanced(blob);
  recordMeaning(blob, {
    workDays, shifts, holidays, workingExceptions, view, layout, shiftAttrs, padHours,
  });
  return blob;
}

/**
 * What each packed blob MEANS, recorded as it is packed and looked up by the blob
 * itself. This is the generator's own record, not a parse of its output — the corpus's
 * standing rule is that a golden is written from intent, and a `mutate` hook hands
 * `tables.CALENDAR` a finished string with the model that produced it nowhere in reach.
 * Keying on the blob is safe because packing is injective: same bytes, same meaning.
 *
 * Shaped ready for the golden's `calendars` block (043) — worked days, the shifts on
 * each, hours per working day, and the exceptions with their decoded dates and whether
 * each is worked. A shift is `HH:MM-HH:MM` with the hour padded, which is the CANONICAL
 * form: `padHours: false` is a fact about the bytes and never about the meaning.
 */
const MEANINGS = new Map();

export function meaningOf(blob) {
  return MEANINGS.get(blob) ?? null;
}

function recordMeaning(blob, {
  workDays, shifts, holidays, workingExceptions, view, layout, shiftAttrs, padHours,
}) {
  const round2 = (n) => Math.round(n * 100) / 100;
  const canon = (list) => list.map(([s, f]) => `${padTime(s)}-${padTime(f)}`);
  const hoursOf = (list) => round2(list.reduce((sum, [s, f]) => sum + (hhmm(f) - hhmm(s)), 0));

  const week = [];
  for (let d = 1; d <= 7; d++) {
    const works = workDays.includes(d);
    week.push({
      day: d,
      name: DAY_NAMES[d - 1],
      works,
      shifts: works ? canon(shifts) : [],
      hours: works ? hoursOf(shifts) : 0,
    });
  }

  // Emission order: the non-working exceptions first, then the working ones, exactly
  // as the Exceptions node above is built, so a decoder can compare positionally.
  const exceptions = [
    ...holidays.map((date) => ({ date, shifts: [] })),
    ...workingExceptions,
  ].map((ex) => ({
    date: ex.date,
    serial: serialOf(new Date(`${ex.date}T00:00:00Z`)),
    works: ex.shifts.length > 0,
    shifts: canon(ex.shifts),
    hours: hoursOf(ex.shifts),
  }));

  MEANINGS.set(blob, {
    // How it is written down. None of this is meaning; all of it is a parser trap.
    serialisation: {
      layout,
      shift_attrs: shiftAttrs,
      pad_hours: padHours,
      view_node: view,
      has_0x7f: layout === 'indented',
    },
    week,
    hours_per_working_day: hoursOf(shifts),
    working_days_per_week: workDays.length,
    // A week with no exception in it — the number `week_hr_cnt` claims and can contradict.
    hours_per_week: round2(hoursOf(shifts) * workDays.length),
    exceptions,
  });
}

function padTime(t) {
  const [h, m = '00'] = String(t).split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

function assertBalanced(blob) {
  let depth = 0;
  for (const ch of blob) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth < 0) throw new Error('clndr_data: unbalanced parentheses');
  }
  if (depth !== 0) throw new Error(`clndr_data: ${depth} unclosed parentheses`);
}
