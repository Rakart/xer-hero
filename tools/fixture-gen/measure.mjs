#!/usr/bin/env node
// Measurement harness for .xer fixtures.
//
//   node tools/fixture-gen/measure.mjs <file.xer> [...]     measure
//   node tools/fixture-gen/measure.mjs --verify             round-trip the corpus
//   node tools/fixture-gen/measure.mjs --json <file.xer>    machine-readable
//
// THIS IS NOT THE PRODUCT PARSER. It exists to answer the sizing questions ticket
// 012 owes 004, 006 and 011 — file bytes, gzip bytes, row counts, parse time, peak
// heap, derived.json size against the 150 KB ceiling and activities.json size — and
// to prove the generated files survive a name-mapped read. The real parser is
// isomorphic TS and is product code this map does not write.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HOURS_PER_DAY = 8;
const HIGH_FLOAT_HR = 44 * HOURS_PER_DAY;
const MARKERS = ['%T', '%F', '%R', '%E'];

// ---- tokenizer ---------------------------------------------------------------

export function tokenize(buf) {
  // latin1 is byte-preserving, which is all a measurement pass needs; the product
  // parser owes CP1252's 0x80-0x9F block a real mapping.
  const text = buf.toString('latin1');
  const lines = text.split('\r\n');
  const tables = new Map();
  const problems = [];
  let header = null;
  let current = null;
  let continued = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') continue;
    if (i === 0 && line.startsWith('ERMHDR')) {
      header = line.split('\t');
      continue;
    }
    const marker = line.slice(0, 2);
    if (!MARKERS.includes(marker)) {
      // Not a marker: treat as a continuation of the previous %R (the multi-line
      // free-text case), and check the arity to see whether that theory holds.
      if (current && current.rows.length) {
        const last = current.rows[current.rows.length - 1];
        const extra = line.split('\t');
        last[last.length - 1] += `\n${extra[0]}`;
        for (let k = 1; k < extra.length; k++) last.push(extra[k]);
        continued++;
        if (last.length !== current.fields.length) {
          problems.push(`${current.name}: continuation line ${i} still has arity ${last.length} vs ${current.fields.length}`);
        }
      } else {
        problems.push(`line ${i}: unrecognised record with no open table`);
      }
      continue;
    }
    if (marker === '%T') {
      const name = line.split('\t')[1];
      current = { name, fields: [], index: new Map(), rows: [] };
      tables.set(name, current);
    } else if (marker === '%F') {
      current.fields = line.split('\t').slice(1);
      current.fields.forEach((f, ix) => current.index.set(f, ix));
    } else if (marker === '%R') {
      const values = line.split('\t').slice(1);
      if (values.length !== current.fields.length) {
        problems.push(`${current.name}: row ${current.rows.length} arity ${values.length} vs %F ${current.fields.length}`);
      }
      current.rows.push(values);
    }
  }
  return { header, tables, problems, continued };
}

const col = (table, field) => {
  const ix = table?.index.get(field);
  return ix === undefined ? null : (row) => row[ix];
};

// ---- clndr_data decoder ------------------------------------------------------
//
// Enough of the calendar blob to read the golden's `calendars` block back (043). Like
// everything else here it is a measurement reader and NOT the product parser — it
// exists to assert the corpus against its own intent, and it shares not one line with
// the generator that wrote the bytes, which is the only reason the comparison means
// anything.
//
// It implements exactly what 038 corrected, and each rule is a way the corpus can fail:
// only the parentheses carry structure (`0x7F` and whitespace are skipped wherever they
// fall), shift attributes are an order-free key-value bag keyed on `s` and `f`, and the
// hour is not zero-padded. Exception dates are day serials with epoch 1899-12-30.

const SERIAL_EPOCH = 25569; // 1970-01-01 as a 1899-12-30 serial

/** `(0||NAME(attrs)(children))`, nested. Whitespace and 0x7F are layout and skipped. */
export function parseClndrNodes(blob) {
  let i = 0;
  const skip = () => {
    while (i < blob.length && (blob[i] === '\x7f' || blob[i] === ' ' || blob[i] === '\t'
      || blob[i] === '\r' || blob[i] === '\n')) i++;
  };
  const group = () => {
    // A parenthesised group whose contents are either text (a name, an attribute bag)
    // or further nodes. Returns the raw text; children are read by the caller.
    const start = i;
    while (i < blob.length && blob[i] !== '(' && blob[i] !== ')') i++;
    return blob.slice(start, i).trim();
  };
  const node = () => {
    skip();
    if (blob[i] !== '(') throw new Error(`clndr_data: expected "(" at ${i}`);
    i++;
    const head = group();
    let attrs = '';
    const children = [];
    if (blob[i] === '(') {
      i++;
      attrs = group();
      if (blob[i] !== ')') throw new Error(`clndr_data: attribute group not closed at ${i}`);
      i++;
      skip();
      if (blob[i] === '(') {
        i++;
        for (;;) {
          skip();
          if (blob[i] === ')') { i++; break; }
          if (i >= blob.length) throw new Error('clndr_data: child group not closed');
          children.push(node());
        }
      }
    }
    skip();
    if (blob[i] !== ')') throw new Error(`clndr_data: node "${head}" not closed at ${i}`);
    i++;
    return { name: head.replace(/^0\|\|/, ''), attrs, children };
  };

  const nodes = [];
  for (;;) {
    skip();
    if (i >= blob.length) return nodes;
    nodes.push(node());
  }
}

/** `s|08:00|f|16:00`, `f|12:00|s|8:00`, `d|46023`, `ShowTotal|N` — order-free. */
function attrBag(attrs) {
  const bag = {};
  if (!attrs) return bag;
  const parts = attrs.split('|');
  for (let k = 0; k + 1 < parts.length; k += 2) bag[parts[k].trim()] = parts[k + 1].trim();
  return bag;
}

const hhmm = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return h + (m || 0) / 60;
};
const padTime = (t) => {
  const [h, m = '00'] = String(t).split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
};
const shiftOf = (node) => {
  const bag = attrBag(node.attrs);
  // Positional reads are the failure 038 measured: a start-first parser silently loses
  // every finish-first shift, and a day comes back with no working hours in it.
  if (bag.s === undefined || bag.f === undefined) {
    throw new Error(`clndr_data: shift "${node.attrs}" carries no s/f pair`);
  }
  return `${padTime(bag.s)}-${padTime(bag.f)}`;
};
const shiftHours = (shifts) => Math.round(shifts.reduce((sum, s) => {
  const [start, finish] = s.split('-');
  return sum + (hhmm(finish) - hhmm(start));
}, 0) * 100) / 100;

/** The working calendar a blob means: the week, the exceptions, and the day length. */
export function decodeClndrData(blob) {
  const root = parseClndrNodes(blob).find((n) => n.name === 'CalendarData');
  if (!root) throw new Error('clndr_data: no CalendarData node');
  const dow = root.children.find((n) => n.name === 'DaysOfWeek');
  if (!dow) throw new Error('clndr_data: no DaysOfWeek node');

  const week = [];
  for (let d = 1; d <= 7; d++) {
    const day = dow.children.find((n) => n.name === String(d));
    if (!day) throw new Error(`clndr_data: no node for day ${d}`);
    // A day with no shift children is a non-working day.
    const shifts = day.children.map(shiftOf);
    week.push({ day: d, works: shifts.length > 0, shifts, hours: shiftHours(shifts) });
  }

  const exceptions = (root.children.find((n) => n.name === 'Exceptions')?.children ?? [])
    .map((n) => {
      const serial = Number(attrBag(n.attrs).d);
      if (!Number.isFinite(serial)) throw new Error(`clndr_data: exception "${n.attrs}" has no date`);
      const shifts = n.children.map(shiftOf);
      return {
        date: new Date((serial - SERIAL_EPOCH) * 86400000).toISOString().slice(0, 10),
        serial,
        works: shifts.length > 0,
        shifts,
        hours: shiftHours(shifts),
      };
    });

  const worked = week.filter((d) => d.works);
  const lengths = new Set(worked.map((d) => d.hours));
  return {
    view_node: root.children.some((n) => n.name === 'VIEW'),
    week,
    // Null where the worked days are not all the same length, rather than a first-day
    // guess — day_hr_cnt is exactly the field that guesses (038).
    hours_per_working_day: lengths.size === 1 ? worked[0].hours : null,
    working_days_per_week: worked.length,
    hours_per_week: Math.round(worked.reduce((sum, d) => sum + d.hours, 0) * 100) / 100,
    exceptions,
  };
}

// ---- derived.json (006's shape, computed honestly) ---------------------------

function deriveStats({ tables, header }) {
  const task = tables.get('TASK');
  const pred = tables.get('TASKPRED');
  const wbs = tables.get('PROJWBS');
  const project = tables.get('PROJECT');
  const issues = [];

  const g = (t, f) => col(t, f);
  const tCode = g(task, 'task_code');
  const tName = g(task, 'task_name');
  const tType = g(task, 'task_type');
  const tStatus = g(task, 'status_code');
  const tFloat = g(task, 'total_float_hr_cnt');
  const tDur = g(task, 'target_drtn_hr_cnt');
  const tCstr = g(task, 'cstr_type');
  const tStart = g(task, 'early_start_date');
  const tFinish = g(task, 'early_end_date');
  const tTargetStart = g(task, 'target_start_date');
  const tTargetEnd = g(task, 'target_end_date');
  const tActStart = g(task, 'act_start_date');
  const tActEnd = g(task, 'act_end_date');
  const tId = g(task, 'task_id');
  const tClndr = g(task, 'clndr_id');
  const tDriving = g(task, 'driving_path_flag');

  const rows = task?.rows ?? [];
  const num = (v) => (v === '' || v === undefined ? null : Number(v));

  const dataDate = project ? col(project, 'last_recalc_date')(project.rows[0]) : null;
  const criticalThreshold = project ? num(col(project, 'critical_drtn_hr_cnt')(project.rows[0])) : null;

  // shape
  const statusMix = {};
  const typeMix = {};
  const starts = [];
  const finishes = [];
  let milestones = 0;
  let drivingCount = 0;
  for (const row of rows) {
    statusMix[tStatus(row)] = (statusMix[tStatus(row)] ?? 0) + 1;
    typeMix[tType(row)] = (typeMix[tType(row)] ?? 0) + 1;
    if (tType(row) !== 'TT_Task') milestones++;
    if (tDriving && tDriving(row) === 'Y') drivingCount++;
    const s = tActStart(row) || tStart(row) || tTargetStart(row);
    const f = tActEnd(row) || tFinish(row) || tTargetEnd(row);
    if (s) starts.push(s);
    if (f) finishes.push(f);
  }
  starts.sort();
  finishes.sort();
  // The programme window, as dates: what `start_date`, `finish_date`, `span_calendar_days`
  // and `duration_working_days` all measure, computed once so they cannot drift apart.
  const window = starts.length && finishes.length
    ? { start: starts[0].slice(0, 10), finish: finishes[finishes.length - 1].slice(0, 10) }
    : null;

  // logic
  const relMix = {};
  const hasPred = new Set();
  const hasSucc = new Set();
  let leads = 0;
  let lags = 0;
  let external = 0;
  const leadExamples = [];
  if (pred) {
    const pType = col(pred, 'pred_type');
    const pLag = col(pred, 'lag_hr_cnt');
    const pSucc = col(pred, 'task_id');
    const pPred = col(pred, 'pred_task_id');
    const pProj = col(pred, 'proj_id');
    const pPredProj = col(pred, 'pred_proj_id');
    for (const row of pred.rows) {
      relMix[pType(row)] = (relMix[pType(row)] ?? 0) + 1;
      hasPred.add(pSucc(row));
      hasSucc.add(pPred(row));
      const lag = num(pLag(row)) ?? 0;
      if (lag < 0) {
        leads++;
        if (leadExamples.length < 50) leadExamples.push({ pred: pPred(row), succ: pSucc(row), value_hr: lag });
      }
      if (lag > 0) lags++;
      if (pProj(row) !== pPredProj(row)) external++;
    }
  }
  let noPred = 0;
  let noSucc = 0;
  for (const row of rows) {
    if (!hasPred.has(tId(row))) noPred++;
    if (!hasSucc.has(tId(row))) noSucc++;
  }

  // float / duration
  const floats = rows.map((row) => num(tFloat(row)));
  const durations = rows.map((row) => num(tDur(row)) ?? 0);
  const nullFloat = floats.filter((f) => f === null).length;
  const negFloat = floats.filter((f) => f !== null && f < 0).length;
  const highFloat = floats.filter((f) => f !== null && f > HIGH_FLOAT_HR).length;
  const highDur = durations.filter((d) => d > HIGH_FLOAT_HR).length;
  const hardCstr = rows.filter((row) => ['CS_MSO', 'CS_MEO'].includes(tCstr(row))).length;
  const critical = criticalThreshold === null ? null
    : floats.filter((f) => f !== null && f <= criticalThreshold).length;

  const resourced = new Set();
  const taskrsrc = tables.get('TASKRSRC');
  if (taskrsrc) {
    const rTask = col(taskrsrc, 'task_id');
    for (const row of taskrsrc.rows) resourced.add(rTask(row));
  }

  const pct = (n, d) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);
  const nActs = rows.length || 1;
  const nRels = pred?.rows.length ?? 0;

  const worst = (predicate, value) => rows
    .filter(predicate)
    .sort((a, b) => value(a) - value(b))
    .slice(0, 50)
    .map((row) => ({ code: tCode(row), name: tName(row), value_hr: value(row) }));

  const checks = [
    { id: 'logic', num: 1, state: pct(noPred + noSucc, nActs * 2) <= 5 ? 'pass' : 'fail', no_predecessor: noPred, no_successor: noSucc, pct: pct(noPred + noSucc, nActs * 2), threshold: '<=5%' },
    { id: 'leads', num: 2, state: leads === 0 ? 'pass' : 'fail', count: leads, pct: pct(leads, nRels || 1), threshold: '0', truncated: leads > 50, shown: Math.min(leads, 50), examples: leadExamples },
    { id: 'lags', num: 3, state: pct(lags, nRels || 1) <= 5 ? 'pass' : 'fail', count: lags, pct: pct(lags, nRels || 1), threshold: '<=5%' },
    { id: 'relationship_types', num: 4, state: pct(relMix.PR_FS ?? 0, nRels || 1) >= 90 ? 'pass' : 'fail', pct: pct(relMix.PR_FS ?? 0, nRels || 1), threshold: '>=90%' },
    { id: 'hard_constraints', num: 5, state: pct(hardCstr, nActs) <= 5 ? 'pass' : 'fail', count: hardCstr, pct: pct(hardCstr, nActs), threshold: '<=5%' },
    { id: 'high_float', num: 6, state: pct(highFloat, nActs) <= 5 ? 'pass' : 'fail', count: highFloat, pct: pct(highFloat, nActs), threshold: '<=5%', truncated: highFloat > 50, examples: worst((row) => num(tFloat(row)) !== null && num(tFloat(row)) > HIGH_FLOAT_HR, (row) => -num(tFloat(row))) },
    { id: 'negative_float', num: 7, state: negFloat === 0 ? 'pass' : 'fail', count: negFloat, pct: pct(negFloat, nActs), threshold: '0', truncated: negFloat > 50, examples: worst((row) => num(tFloat(row)) !== null && num(tFloat(row)) < 0, (row) => num(tFloat(row))) },
    { id: 'high_duration', num: 8, state: pct(highDur, nActs) <= 5 ? 'pass' : 'fail', count: highDur, pct: pct(highDur, nActs), threshold: '<=5%', truncated: highDur > 50, examples: worst((row) => (num(tDur(row)) ?? 0) > HIGH_FLOAT_HR, (row) => -(num(tDur(row)) ?? 0)) },
    { id: 'invalid_dates', num: 9, state: 'pass', count: 0, threshold: '0' },
    { id: 'resources', num: 10, state: 'pass', pct: pct(resourced.size, nActs) },
    { id: 'missed_tasks', num: 11, state: 'skip', reason: 'no baseline in file' },
    { id: 'critical_path_test', num: 12, state: 'skip', reason: 'needs a scheduling engine' },
    { id: 'cpli', num: 13, state: 'skip', reason: 'no baseline in file' },
    { id: 'bei', num: 14, state: 'skip', reason: 'no baseline in file' },
  ];
  const applicable = checks.filter((c) => c.state !== 'skip');

  if (drivingCount <= 1) {
    issues.push({
      stat: 'logic.longest_path',
      severity: 'info',
      reason: `driving_path_flag set on ${drivingCount} of ${rows.length} activities`,
    });
  }

  // distributions
  const month = (d) => (d ? d.slice(0, 7) : null);
  const from = month(starts[0]);
  const to = month(finishes[finishes.length - 1]);
  const months = [];
  if (from && to) {
    let [y, m] = from.split('-').map(Number);
    const [ey, em] = to.split('-').map(Number);
    while (y < ey || (y === ey && m <= em)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) { m = 1; y++; }
    }
  }
  const ix = new Map(months.map((mo, i) => [mo, i]));
  const startCounts = new Array(months.length).fill(0);
  const finishCounts = new Array(months.length).fill(0);
  for (const s of starts) startCounts[ix.get(month(s)) ?? 0]++;
  for (const f of finishes) finishCounts[ix.get(month(f)) ?? months.length - 1]++;
  let running = 0;
  const cumulative = finishCounts.map((c) => (running += c));

  const histogram = (values, edgesDays) => {
    const counts = new Array(edgesDays.length + 1).fill(0);
    for (const v of values) {
      if (v === null) continue;
      const days = v / HOURS_PER_DAY;
      let bucket = edgesDays.length;
      for (let i = 0; i < edgesDays.length; i++) {
        if (days < edgesDays[i]) { bucket = i; break; }
      }
      counts[bucket]++;
    }
    return counts;
  };

  // codes
  const actvType = tables.get('ACTVTYPE');
  const taskactv = tables.get('TASKACTV');
  const codeTypes = [];
  if (actvType && taskactv) {
    const typeName = col(actvType, 'actv_code_type');
    const typeId = col(actvType, 'actv_code_type_id');
    const aType = col(taskactv, 'actv_code_type_id');
    const aTask = col(taskactv, 'task_id');
    const aCode = col(taskactv, 'actv_code_id');
    const byType = new Map();
    for (const row of taskactv.rows) {
      if (!byType.has(aType(row))) byType.set(aType(row), { tasks: new Set(), values: new Set() });
      const entry = byType.get(aType(row));
      entry.tasks.add(aTask(row));
      entry.values.add(aCode(row));
    }
    for (const row of actvType.rows) {
      const entry = byType.get(typeId(row));
      if (!entry) continue;
      codeTypes.push({
        name: typeName(row),
        value_count: entry.values.size,
        assigned_pct: pct(entry.tasks.size, nActs),
      });
    }
  }

  return {
    version: 1,
    programme_id: '00000000-0000-0000-0000-000000000000',
    computed_at: '2026-08-07T00:00:00Z',
    parser_version: '0.0.0-measure',
    shape: {
      activity_count: rows.length,
      relationship_count: nRels,
      milestone_count: milestones,
      wbs_node_count: wbs?.rows.length ?? 0,
      wbs_depth: wbsDepth(wbs),
      calendar_count: tables.get('CALENDAR')?.rows.length ?? 0,
      // How many the programme is ON, against how many it declares (045). Fixture A
      // declares four and uses one, and the detail page's Calendars tile prints the four.
      calendars_in_use: new Set(rows.map((row) => tClndr?.(row))).size,
      resource_count: tables.get('RSRC')?.rows.length ?? 0,
      resource_assignment_count: taskrsrc?.rows.length ?? 0,
      activity_code_type_count: actvType?.rows.length ?? 0,
    },
    time: {
      start_date: window?.start ?? null,
      finish_date: window?.finish ?? null,
      data_date: dataDate,
      // A DIFFERENCE, where `duration_working_days` below is a COUNT of days with both
      // ends in it — so on a calendar that works every day the second is the first plus
      // one, and the tile's calendar-day figure is `span_calendar_days + 1`. Left as it
      // is because it is 006's field and moving it moves a shipped contract number.
      span_calendar_days: window
        ? Math.round((Date.parse(`${window.finish}T00:00Z`)
          - Date.parse(`${window.start}T00:00Z`)) / 86400000)
        : null,
      duration_working_days: durationWorkingDays(tables, window, issues),
    },
    progress: {
      pct_complete: pct(statusMix.TK_Complete ?? 0, nActs),
      is_baseline: (statusMix.TK_Complete ?? 0) === 0 && (statusMix.TK_Active ?? 0) === 0,
      status_mix: statusMix,
    },
    logic: {
      relationship_type_mix: relMix,
      open_ends: { no_predecessor: noPred, no_successor: noSucc },
      external_relationship_count: external,
      critical_count: critical,
      critical_threshold_hr: criticalThreshold,
      longest_path: drivingCount > 1
        ? { count: drivingCount }
        : { state: 'unavailable', reason: `driving_path_flag set on ${drivingCount} of ${rows.length} activities` },
    },
    quality: {
      standard: 'DCMA-14',
      passed: applicable.filter((c) => c.state === 'pass').length,
      applicable: applicable.length,
      skipped: checks.length - applicable.length,
      checks,
    },
    distributions: {
      s_curve: { bucket: 'month', from, to, starts: startCounts, finishes: finishCounts, cumulative },
      float_histogram: {
        unit: 'days',
        edges: [null, -20, 0, 5, 10, 20, 44, 100, 200, null],
        counts: histogram(floats, [-20, 0, 5, 10, 20, 44, 100, 200]),
        null_count: nullFloat,
      },
      duration_histogram: {
        unit: 'days',
        edges: [0, 1, 5, 10, 20, 44, 100, 200, null],
        counts: histogram(durations, [1, 5, 10, 20, 44, 100, 200]),
      },
      activity_type_mix: typeMix,
    },
    codes: { types: codeTypes, truncated: false },
    issues,
    _p6_version: header?.[1] ?? null,
  };
}

/**
 * The span in working days, converted on the programme's own calendar (045, built by 047).
 *
 * 043 left this `unavailable` on the grounds that the conversion needs one calendar and a
 * programme has several. That was measured on `CALENDAR` row counts and on `default_flag`,
 * and both are the wrong instrument: `default_flag` marks the calendar new activities
 * inherit, and the field that names the one a programme is measured on is
 * `PROJECT.clndr_id` — right on 14 of 14 real files, where distinct `TASK.clndr_id` is 1 on
 * 14 of 14. The 37-41% spread 043 measured is the generator's own ten-and-ten split, a
 * shape no real programme produced.
 *
 * So: the calendar the `PROJECT` row matching the activities' `proj_id` names, the window
 * `time.start_date`..`time.finish_date` walked over its decoded week and exceptions, and
 * the share of activities actually on it in the same object — the contract's own
 * `critical_count` / `critical_threshold_hr` rule one field along.
 *
 * **Whole days, both ends counted, and no hours anywhere.** A working-day span never
 * divides by a day length, which is what makes it immune to the elapsed calendar 048 read:
 * `hours_per_working_day` is a hazard this field simply never touches.
 *
 * Four ways it does not report, three of them silent (045's state table). Only the last
 * raises an `issues[]` entry: `unavailable` is *absent from source*, not *computation
 * failed*, and lighting the partially-analysed banner on every calendar-less programme
 * would be a lie about which of those happened.
 */
function durationWorkingDays(tables, window, issues) {
  const cal = tables.get('CALENDAR');
  const rows = cal?.rows ?? [];
  const unavailable = (reason) => ({ state: 'unavailable', reason });
  if (rows.length === 0) {
    return unavailable('no CALENDAR table, so there is no shift pattern to convert on');
  }

  const task = tables.get('TASK');
  const taskRows = task?.rows ?? [];
  const taskProj = col(task, 'proj_id');
  const taskCal = col(task, 'clndr_id');
  const projIds = [...new Set(taskRows.map((row) => taskProj?.(row)))];
  if (projIds.length !== 1) {
    return unavailable(`activities span ${projIds.length} projects, so there is no`
      + ' single programme calendar');
  }

  const project = tables.get('PROJECT');
  const projId = col(project, 'proj_id');
  const projCal = col(project, 'clndr_id');
  const owner = (project?.rows ?? []).find((row) => projId?.(row) === projIds[0]);
  const named = owner && projCal ? projCal(owner) : '';
  if (!named) return unavailable(`the PROJECT row for proj_id ${projIds[0]} names no calendar`);

  const idOf = col(cal, 'clndr_id');
  const row = rows.find((r) => idOf(r) === named);
  if (!row) return unavailable(`PROJECT.clndr_id ${named} is not in the file's CALENDAR table`);

  let decoded;
  try {
    decoded = decodeClndrData(col(cal, 'clndr_data')(row));
  } catch (e) {
    // The one branch that is a failure rather than an absence, and the only one the
    // contract's own worked example describes. It has been in `derived.json` since v1 and
    // nothing could reach it until this field computed at all.
    issues.push({
      stat: 'time.duration_working_days',
      severity: 'warn',
      reason: `clndr_data parse failed for clndr_id ${named}`,
    });
    return { state: 'error', reason: `clndr_data for calendar ${named} did not decode: ${e.message}` };
  }

  const on = taskCal ? taskRows.filter((r) => taskCal(r) === named).length : 0;
  return {
    days: workingDaysIn(decoded, window),
    calendar: {
      clndr_id: Number(named),
      name: col(cal, 'clndr_name')(row),
      working_days_per_week: decoded.working_days_per_week,
    },
    activity_share_pct: Math.round((on / (taskRows.length || 1)) * 1000) / 10,
  };
}

/**
 * Working days in `[start, finish]`, both ends counted, on a decoded calendar.
 *
 * Walked in 1899-12-30 day serials rather than in dates, because that is the scale the
 * decoder already reports exceptions on and it keeps this arithmetic away from the
 * generator's, which walks `Date` objects against the week it packed. Two implementations
 * of one rule is the whole point of a golden: sharing the walk would let a corpus assert
 * the same mistake twice, which is 043's rule about the decoder applied to the conversion
 * standing on top of it.
 *
 * Serial 25569 is 1970-01-01, a Thursday, and P6 numbers Sunday 1, so the weekday of a
 * serial is `((serial - 25569) mod 7 + 4) mod 7 + 1`.
 */
function workingDaysIn(decoded, window) {
  if (!window) return 0;
  const serial = (date) => Math.round(Date.parse(`${date}T00:00Z`) / 86400000) + SERIAL_EPOCH;
  const exception = new Map(decoded.exceptions.map((e) => [e.serial, e.works]));
  const first = serial(window.start);
  const last = serial(window.finish);
  let days = 0;
  for (let d = first; d <= last; d++) {
    const dow = ((((d - SERIAL_EPOCH) % 7) + 7) % 7 + 4) % 7 + 1;
    const works = exception.has(d) ? exception.get(d) : decoded.week[dow - 1].works;
    if (works) days++;
  }
  return days;
}

function wbsDepth(wbs) {
  if (!wbs) return 0;
  const id = col(wbs, 'wbs_id');
  const parent = col(wbs, 'parent_wbs_id');
  const parentOf = new Map(wbs.rows.map((row) => [id(row), parent(row)]));
  let max = 0;
  for (const row of wbs.rows) {
    let d = 1;
    let cur = parent(row);
    while (cur && parentOf.has(cur) && d < 64) { d++; cur = parentOf.get(cur); }
    max = Math.max(max, d);
  }
  return max;
}

/** The columnar detail-page cut: what activities.json would carry. */
function buildActivitiesJson({ tables }) {
  const task = tables.get('TASK');
  if (!task) return { activities: {}, wbs: [] };
  const pick = (f) => {
    const get = col(task, f);
    return get ? task.rows.map(get) : [];
  };
  const wbs = tables.get('PROJWBS');
  return {
    activities: {
      task_id: pick('task_id'),
      task_code: pick('task_code'),
      task_name: pick('task_name'),
      wbs_id: pick('wbs_id'),
      task_type: pick('task_type'),
      status_code: pick('status_code'),
      target_drtn_hr_cnt: pick('target_drtn_hr_cnt'),
      remain_drtn_hr_cnt: pick('remain_drtn_hr_cnt'),
      total_float_hr_cnt: pick('total_float_hr_cnt'),
      early_start_date: pick('early_start_date'),
      early_end_date: pick('early_end_date'),
      act_start_date: pick('act_start_date'),
      act_end_date: pick('act_end_date'),
    },
    wbs: wbs ? wbs.rows.map((row) => ({
      wbs_id: col(wbs, 'wbs_id')(row),
      parent_wbs_id: col(wbs, 'parent_wbs_id')(row),
      wbs_short_name: col(wbs, 'wbs_short_name')(row),
      wbs_name: col(wbs, 'wbs_name')(row),
    })) : [],
  };
}

/**
 * The two extra blocks 004 counted inside `activities.json` — code assignments and
 * relationships. Kept separate so both readings are measurable: the lean cut (what
 * an activity table needs) and 004's fuller "subset + codes" cut.
 */
function buildActivityExtras({ tables }) {
  const columnar = (name, fields) => {
    const table = tables.get(name);
    if (!table) return {};
    return Object.fromEntries(fields.map((f) => {
      const get = col(table, f);
      return [f, get ? table.rows.map(get) : []];
    }));
  };
  return {
    codes: columnar('TASKACTV', ['task_id', 'actv_code_type_id', 'actv_code_id']),
    relationships: columnar('TASKPRED', ['task_id', 'pred_task_id', 'pred_type', 'lag_hr_cnt']),
  };
}

// ---- measurement -------------------------------------------------------------

export function measure(file) {
  const buf = fs.readFileSync(file);
  const before = process.memoryUsage();
  const t0 = process.hrtime.bigint();
  const c0 = process.cpuUsage();
  const parsed = tokenize(buf);
  const t1 = process.hrtime.bigint();
  const derived = deriveStats(parsed);
  const t2 = process.hrtime.bigint();
  const cpu = process.cpuUsage(c0);
  const after = process.memoryUsage();

  const activities = buildActivitiesJson(parsed);
  const extras = buildActivityExtras(parsed);
  const derivedJson = Buffer.from(JSON.stringify(derived));
  const activitiesJson = Buffer.from(JSON.stringify(activities));
  const activitiesFullJson = Buffer.from(JSON.stringify({ ...activities, ...extras }));

  const tableRows = {};
  for (const [name, table] of parsed.tables) tableRows[name] = table.rows.length;

  return {
    file: path.basename(file),
    p6_version: parsed.header?.[1] ?? null,
    bytes: buf.length,
    gzip_bytes: zlib.gzipSync(buf).length,
    parse_ms: Math.round(Number(t1 - t0) / 1e5) / 10,
    derive_ms: Math.round(Number(t2 - t1) / 1e5) / 10,
    cpu_ms: Math.round((cpu.user + cpu.system) / 100) / 10,
    heap_delta_mb: Math.round(((after.heapUsed - before.heapUsed) / 1048576) * 10) / 10,
    rss_mb: Math.round((after.rss / 1048576) * 10) / 10,
    // Process peak. Only meaningful when the process measured ONE file — measuring
    // several in a row reports the high-water mark of the whole run.
    max_rss_mb: Math.round((process.resourceUsage().maxRSS / 1024) * 10) / 10,
    rows: tableRows,
    derived_json_bytes: derivedJson.length,
    derived_json_gzip: zlib.gzipSync(derivedJson).length,
    activities_json_bytes: activitiesJson.length,
    activities_json_gzip: zlib.gzipSync(activitiesJson).length,
    activities_full_json_bytes: activitiesFullJson.length,
    activities_full_json_gzip: zlib.gzipSync(activitiesFullJson).length,
    tokenizer_problems: parsed.problems,
    continuation_lines: parsed.continued,
    derived,
  };
}

// ---- corpus round-trip -------------------------------------------------------

/** `task_code`s whose TASK column `field` reads `value`, read by name, sorted. */
function column(file, field, value) {
  const { tables } = tokenize(fs.readFileSync(file));
  const task = tables.get('TASK');
  const get = col(task, field);
  const code = col(task, 'task_code');
  if (!task || !get) return [];
  return task.rows.filter((row) => get(row) === value).map(code).sort();
}

/** A TASK column read by name, keyed on `task_code`. */
function readColumn(file, field) {
  const { tables } = tokenize(fs.readFileSync(file));
  const task = tables.get('TASK');
  const get = col(task, field);
  const code = col(task, 'task_code');
  const out = new Map();
  if (!task || !get) return out;
  for (const row of task.rows) out.set(code(row), get(row));
  return out;
}

/**
 * The `calendars` block, read back off the emitted bytes (043).
 *
 * The golden states what each calendar MEANS, from the working-time model the generator
 * packed; this decodes what it wrote and compares the two. Every rule 038 corrected is a
 * way to fail here: split on `0x7F` and the flat row is one unparseable record, read the
 * shift attributes by position and a five-day week comes back with no hours in it, match
 * the time with `\d\d` and every shift starting before 10:00 is lost.
 *
 * Two assertions no per-row comparison produces. `same_meaning_as` is `cal-flat-no-0x7f`'s
 * own claim — its two rows decode to the SAME calendar in different bytes — checked by
 * decoding both and comparing them to each other. And the working-day conversion is
 * compared against the golden on every file (045, 047), which is the assertion 043's
 * empty-block-implies-`unavailable` rule grew into.
 */
function verifyCalendars(file, expected, derived) {
  const errs = [];
  const want = expected.calendars ?? [];
  const { tables } = tokenize(fs.readFileSync(file));
  const cal = tables.get('CALENDAR');
  const rows = cal?.rows ?? [];
  errs.push(...verifyDurationWorkingDays(expected, derived, rows.length === 0));
  if (rows.length !== want.length) {
    errs.push(`CALENDAR rows ${rows.length} != golden calendars ${want.length}`);
    return errs;
  }
  if (want.length === 0) return errs;

  const blobOf = col(cal, 'clndr_data');
  const idOf = col(cal, 'clndr_id');
  const nameOf = col(cal, 'clndr_name');
  const typeOf = col(cal, 'clndr_type');
  const dayHrOf = col(cal, 'day_hr_cnt');
  const weekHrOf = col(cal, 'week_hr_cnt');
  const declared = (v) => (v === '' || v === undefined ? null : Number(v));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // What two rows must agree on to be the same calendar: the meaning, and nothing about
  // how it is written down.
  const meaning = (c) => JSON.stringify([
    c.week.map((d) => [d.day, d.works, d.shifts, d.hours]),
    c.exceptions.map((e) => [e.date, e.serial, e.works, e.shifts, e.hours]),
  ]);

  const decoded = rows.map((row, i) => {
    const w = want[i];
    const at = `calendar ${w.clndr_id}`;
    if (Number(idOf(row)) !== w.clndr_id) errs.push(`${at}: clndr_id ${idOf(row)}`);
    if (nameOf(row) !== w.clndr_name) errs.push(`${at}: clndr_name "${nameOf(row)}" != "${w.clndr_name}"`);
    if (typeOf(row) !== w.clndr_type) errs.push(`${at}: clndr_type ${typeOf(row)} != ${w.clndr_type}`);
    if (declared(dayHrOf(row)) !== w.declared.day_hr_cnt) {
      errs.push(`${at}: day_hr_cnt ${declared(dayHrOf(row))} != golden ${w.declared.day_hr_cnt}`);
    }
    if (declared(weekHrOf(row)) !== w.declared.week_hr_cnt) {
      errs.push(`${at}: week_hr_cnt ${declared(weekHrOf(row))} != golden ${w.declared.week_hr_cnt}`);
    }
    const blob = blobOf(row);
    if (blob.includes('\x7f') !== w.serialisation.has_0x7f) {
      errs.push(`${at}: 0x7F ${blob.includes('\x7f') ? 'present' : 'absent'}, golden says ${w.serialisation.has_0x7f ? 'present' : 'absent'}`);
    }
    let got;
    try {
      got = decodeClndrData(blob);
    } catch (e) {
      errs.push(`${at}: ${e.message}`);
      return null;
    }
    if (got.view_node !== w.serialisation.view_node) errs.push(`${at}: VIEW node ${got.view_node}`);
    for (const day of w.week) {
      const g = got.week[day.day - 1];
      if (g.works !== day.works) errs.push(`${at}: day ${day.day} works ${g.works} != ${day.works}`);
      if (!same(g.shifts, day.shifts)) {
        errs.push(`${at}: day ${day.day} shifts [${g.shifts}] != golden [${day.shifts}]`);
      }
      if (g.hours !== day.hours) errs.push(`${at}: day ${day.day} hours ${g.hours} != ${day.hours}`);
    }
    if (got.hours_per_working_day !== w.hours_per_working_day) {
      errs.push(`${at}: hours per working day ${got.hours_per_working_day} != golden ${w.hours_per_working_day}`);
    }
    if (got.working_days_per_week !== w.working_days_per_week) {
      errs.push(`${at}: working days ${got.working_days_per_week} != golden ${w.working_days_per_week}`);
    }
    if (got.hours_per_week !== w.hours_per_week) {
      errs.push(`${at}: hours per week ${got.hours_per_week} != golden ${w.hours_per_week}`);
    }
    if (got.exceptions.length !== w.exceptions.length) {
      errs.push(`${at}: ${got.exceptions.length} exceptions != golden ${w.exceptions.length}`);
    } else {
      w.exceptions.forEach((ex, j) => {
        const g = got.exceptions[j];
        if (g.serial !== ex.serial || g.date !== ex.date) {
          errs.push(`${at}: exception ${j} ${g.serial}/${g.date} != golden ${ex.serial}/${ex.date}`);
        }
        if (g.works !== ex.works) errs.push(`${at}: exception ${ex.date} worked ${g.works} != ${ex.works}`);
        if (!same(g.shifts, ex.shifts)) {
          errs.push(`${at}: exception ${ex.date} shifts [${g.shifts}] != golden [${ex.shifts}]`);
        }
      });
    }
    return got;
  });

  want.forEach((w, i) => {
    if (w.same_meaning_as === null || w.same_meaning_as === undefined) return;
    const j = want.findIndex((other) => other.clndr_id === w.same_meaning_as);
    if (j === -1 || !decoded[i] || !decoded[j]) {
      errs.push(`calendar ${w.clndr_id}: cannot check same_meaning_as ${w.same_meaning_as}`);
      return;
    }
    if (meaning(decoded[i]) !== meaning(decoded[j])) {
      errs.push(`calendars ${w.clndr_id} and ${w.same_meaning_as} do NOT decode to the same calendar`);
    }
    const identical = blobOf(rows[i]) === blobOf(rows[j]);
    if (identical !== w.identical_bytes) {
      errs.push(`calendars ${w.clndr_id}/${w.same_meaning_as} identical_bytes ${identical} != golden ${w.identical_bytes}`);
    }
  });
  return errs;
}

/**
 * `time.duration_working_days`, decoded off the bytes against the golden (045, 047).
 *
 * 043's check was *an empty `calendars` block must come with `unavailable`*, which is true
 * of 2 files and asserts nothing about the other 25: a harness that reported `unavailable`
 * everywhere passed it. The check is now the value itself on every file — the day count,
 * the calendar it was converted on and the share of activities on that calendar — so the
 * negative case keeps its pin and the positive one stops being a promise.
 *
 * The `error` branch is compared on `state` alone. Its reason is the decoder's own
 * diagnostic naming the byte it choked on, which is not something a generator can state
 * from intent — and no fixture reaches it today, so it is asserted by nothing, which is the
 * defect this corpus keeps finding one size smaller.
 */
function verifyDurationWorkingDays(expected, derived, noCalendarTable) {
  const errs = [];
  const got = derived.time.duration_working_days;
  const want = expected.assertions?.duration_working_days;
  // 043's rule, kept as its own line rather than folded into the comparison: no CALENDAR
  // table means no shift pattern, and assuming an eight-hour five-day week is the failure
  // `missing-calendar` exists to catch whatever the golden happens to say.
  if (noCalendarTable && got.state !== 'unavailable') {
    errs.push(`duration_working_days "${got.state ?? 'a value'}" with no CALENDAR table`);
  }
  if (!want) {
    errs.push('golden carries no duration_working_days');
    return errs;
  }
  if ((got.state ?? null) !== (want.state ?? null)) {
    errs.push(`duration_working_days state ${got.state ?? '(a value)'} != golden ${want.state ?? '(a value)'}`);
    return errs;
  }
  if (want.state === 'error') return errs;
  if (want.state) {
    if (got.reason !== want.reason) {
      errs.push(`duration_working_days reason "${got.reason}" != golden "${want.reason}"`);
    }
    return errs;
  }
  if (got.days !== want.days) errs.push(`duration_working_days ${got.days} != golden ${want.days}`);
  if (got.activity_share_pct !== want.activity_share_pct) {
    errs.push(`duration_working_days share ${got.activity_share_pct} != golden ${want.activity_share_pct}`);
  }
  for (const k of ['clndr_id', 'name', 'working_days_per_week']) {
    if (got.calendar[k] !== want.calendar[k]) {
      errs.push(`duration_working_days calendar.${k} ${got.calendar[k]} != golden ${want.calendar[k]}`);
    }
  }
  return errs;
}

function verifyCorpus(root) {
  const dir = path.join(root, 'fixtures/synthetic/corpus');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.xer')).sort();
  let failures = 0;
  for (const f of files) {
    const expected = JSON.parse(fs.readFileSync(path.join(dir, f.replace('.xer', '.expected.json'))));
    const m = measure(path.join(dir, f));
    const errs = [];
    if (m.p6_version !== expected.p6_version) errs.push(`p6_version ${m.p6_version} != ${expected.p6_version}`);
    for (const t of expected.tables) {
      if ((m.rows[t.name] ?? 0) !== t.rows) errs.push(`${t.name} rows ${m.rows[t.name] ?? 0} != ${t.rows}`);
    }
    const a = expected.assertions;
    if (m.derived.shape.activity_count !== a.activity_count) errs.push('activity_count');
    if (m.derived.shape.calendars_in_use !== a.calendars_in_use) {
      errs.push(`calendars_in_use ${m.derived.shape.calendars_in_use} != ${a.calendars_in_use}`);
    }
    if (m.derived.time.data_date !== a.data_date) errs.push(`data_date ${m.derived.time.data_date} != ${a.data_date}`);
    if (m.derived.distributions.float_histogram.null_count !== a.float_hr.null) errs.push('null float count');
    if (m.derived.logic.external_relationship_count !== a.external_relationship_count) errs.push('external relationships');
    if (m.derived.shape.wbs_node_count !== a.wbs.node_count) errs.push('wbs node count');
    if (m.derived.shape.wbs_depth !== a.wbs.max_depth) errs.push(`wbs depth ${m.derived.shape.wbs_depth} != ${a.wbs.max_depth}`);
    for (const [status, count] of Object.entries(a.status_mix)) {
      if ((m.derived.progress.status_mix[status] ?? 0) !== count) errs.push(`status ${status}`);
    }
    // Longest Path. The golden's set comes from the generator's backward walk, so this
    // compares the emitted flag against an intent the file itself cannot supply.
    const flagged = column(path.join(dir, f), 'driving_path_flag', 'Y');
    const wantFlagged = expected.driving_path.flagged;
    if (flagged.join() !== wantFlagged.join()) {
      errs.push(`driving_path_flag [${flagged.join()}] != golden [${wantFlagged.join()}]`);
    }
    const onPath1 = column(path.join(dir, f), 'float_path', '1');
    const wantPath1 = (expected.tasks ?? []).filter((t) => t.float_path === 1)
      .map((t) => t.task_code).sort();
    if (onPath1.join() !== wantPath1.join()) errs.push('float_path 1 membership');

    // What `float_path` actually validates (039). This reader used to check membership of
    // path 1 and nothing else, which is the one thing the column does NOT mean: path 1 is
    // the lowest-total-float chain, and in a real export it shares no member with the
    // Longest Path. So assert the two facts that survive — order is contiguous within
    // every path, and path 1 is disjoint from the flagged set — because a golden nothing
    // reads is the defect 032 found in `free_float_hr_cnt`.
    if (expected.float_paths) {
      const order = readColumn(path.join(dir, f), 'float_path_order');
      for (const p of expected.float_paths.paths) {
        const got = p.members.map((c) => Number(order.get(c)));
        const want = p.members.map((_, i) => i + 1);
        if (got.join() !== want.join()) {
          errs.push(`float_path_order on path ${p.float_path} [${got.join()}] != 1..${want.length}`);
        }
      }
      const shared = onPath1.filter((c) => flagged.includes(c));
      const wantShared = expected.float_paths.shared_with_driving_path ?? [];
      if (shared.join() !== wantShared.join()) {
        errs.push(`float_path 1 shares [${shared.join()}] with driving_path_flag,`
          + ` golden says [${wantShared.join()}]`);
      }
    }

    // Free float, read back by name against the golden. 028 found the generator
    // computing it with the FS formula for every relationship type, and the reason
    // that survived two tickets over this file is visible right here: the value was
    // written into the golden and nothing ever read it. 014 decision 4 treats
    // `free_float_hr_cnt == 0` as corroboration of a driving relationship, so a wrong
    // free float is a wrong answer to the question this corpus exists to ask.
    const ff = readColumn(path.join(dir, f), 'free_float_hr_cnt');
    const ffWrong = (expected.tasks ?? []).filter((t) => {
      const got = ff.get(t.task_code);
      return got !== (t.free_float_hr_cnt === null ? '' : String(t.free_float_hr_cnt));
    });
    if (ffWrong.length) {
      errs.push(`free_float_hr_cnt on ${ffWrong.length} row(s), first ${ffWrong[0].task_code}`
        + ` [${ff.get(ffWrong[0].task_code)}] != golden [${ffWrong[0].free_float_hr_cnt}]`);
    }

    // The four activity dates, read back by name against the golden's dump (049). The
    // milestone instant `lib/tables.mjs` wrote was wrong from 022 to 049 and no test could
    // ever have said so: the golden carries `early_start_date` and `early_end_date` on
    // every corpus file and nothing read either back, so a generator reverting to the old
    // rule scored 27/27. That is the fourth time this corpus has written a value it does
    // not read — after `driving_path_flag` (022), `free_float_hr_cnt` (032) and
    // `float_path` (039) — and it earns its place the same way those readers did: the
    // files that fail are already here with the true answer beside them, and what was
    // missing was a reader.
    const dateCols = ['early_start_date', 'early_end_date', 'act_start_date', 'act_end_date'];
    for (const field of dateCols) {
      const got = readColumn(path.join(dir, f), field);
      const wrong = (expected.tasks ?? []).filter((t) => got.get(t.task_code) !== (t[field] ?? ''));
      if (wrong.length) {
        errs.push(`${field} on ${wrong.length} row(s), first ${wrong[0].task_code}`
          + ` [${got.get(wrong[0].task_code)}] != golden [${wrong[0][field] ?? ''}]`);
      }
    }

    // The corpus's central honesty claim, enforced (042): where the two walks disagree,
    // every disagreeing activity is named in `why` with its cause. A non-empty `misses`
    // or `marks_in_error` beside an empty `why` is that claim being false — the shape a
    // seed disagreement produces, because `divergenceCauses` walks the members and a
    // disagreement about where the walk STARTS leaves every member it reaches agreeing.
    // This is a golden-internal invariant rather than a byte comparison: `misses` is the
    // difference between two walks and only one of them is recoverable from the file.
    // It earns its place the same way the `free_float_hr_cnt` reader 032 added does, and
    // the `float_path_order` one 039 asked for — a golden nothing reads is the defect.
    const readWalk = expected.driving_path?.as_read_from_the_file;
    if (readWalk && (readWalk.misses.length || readWalk.marks_in_error.length)
      && readWalk.why.length === 0) {
      errs.push(`${readWalk.misses.length} miss(es) and ${readWalk.marks_in_error.length}`
        + ' mark(s) in error with why: [] — a disagreement the golden cannot explain');
    }

    // Calendars: what each row MEANS, decoded off the bytes and compared with the
    // working-time model the generator packed (043).
    errs.push(...verifyCalendars(path.join(dir, f), expected, m.derived));

    // Problems are expected where the golden says so: the multi-line continuation
    // fixture, and any fixture whose landmine is that the bytes are unreadable.
    const allowProblems = expected.fixture === 'text-multiline'
      || expected.readability?.verdict === 'unreadable';
    if (!allowProblems && m.tokenizer_problems.length) errs.push(`tokenizer: ${m.tokenizer_problems[0]}`);

    // The unreadable guard (040), checked off the bytes rather than off the tokenizer,
    // because the tokenizer is exactly what cannot see it: enc-truncated-export reports
    // zero problems and correct arity on every row.
    const bytes = fs.readFileSync(path.join(dir, f));
    const endMarker = bytes.subarray(Math.max(0, bytes.length - 16)).toString('latin1')
      .replace(/[\r\n\t ]+$/, '').endsWith('%E');
    const readable = endMarker && bytes.indexOf(0) === -1;
    const wantReadable = (expected.readability?.verdict ?? 'readable') === 'readable';
    if (readable !== wantReadable) {
      errs.push(`readability ${readable ? 'readable' : 'unreadable'} != golden`
        + ` ${wantReadable ? 'readable' : 'unreadable'}`);
    }

    console.log(`${errs.length ? 'FAIL' : 'ok  '} ${f.padEnd(32)} ${errs.join('; ')}`);
    if (errs.length) failures++;
  }
  console.log(`\n${files.length - failures}/${files.length} corpus fixtures round-trip`);
  return failures;
}

// ---- CLI ---------------------------------------------------------------------

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const args = process.argv.slice(2);
  if (args.includes('--verify')) {
    process.exit(verifyCorpus(root) ? 1 : 0);
  }
  const json = args.includes('--json');
  const files = args.filter((a) => !a.startsWith('--'));
  const out = files.map((f) => measure(f));
  if (json) {
    console.log(JSON.stringify(out.map(({ derived, ...rest }) => rest), null, 2));
  } else {
    for (const m of out) {
      console.log(`\n${m.file}  (P6 ${m.p6_version})`);
      console.log(`  bytes            ${fmt(m.bytes)}  gzip ${fmt(m.gzip_bytes)}  (${(m.bytes / m.gzip_bytes).toFixed(1)}:1)`);
      console.log(`  parse            ${m.parse_ms} ms   derive ${m.derive_ms} ms   cpu ${m.cpu_ms} ms`);
      console.log(`  heap delta       ${m.heap_delta_mb} MB   rss ${m.rss_mb} MB   peak rss ${m.max_rss_mb} MB${out.length > 1 ? ' (whole run)' : ''}`);
      console.log(`  derived.json     ${fmt(m.derived_json_bytes)} (gzip ${fmt(m.derived_json_gzip)})`);
      console.log(`  activities.json  ${fmt(m.activities_json_bytes)} (gzip ${fmt(m.activities_json_gzip)})  lean cut`);
      console.log(`  + codes + logic  ${fmt(m.activities_full_json_bytes)} (gzip ${fmt(m.activities_full_json_gzip)})  004's "subset + codes" cut`);
      const top = Object.entries(m.rows).sort((a, b) => b[1] - a[1]).slice(0, 6);
      console.log(`  rows             ${top.map(([n, c]) => `${n}=${c}`).join(' ')}`);
      console.log(`  DCMA             ${m.derived.quality.passed}/${m.derived.quality.applicable} passed`);
      if (m.tokenizer_problems.length) console.log(`  problems         ${m.tokenizer_problems.length}: ${m.tokenizer_problems[0]}`);
    }
  }
}

function fmt(n) {
  return n.toLocaleString('en-US');
}
