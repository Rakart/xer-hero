#!/usr/bin/env node
// Generate the synthetic .xer fixtures.
//
//   node tools/fixture-gen/generate.mjs                 corpus + sparse (committed)
//   node tools/fixture-gen/generate.mjs --only perf-20k  one fixture by name
//   node tools/fixture-gen/generate.mjs --all            everything, perf included
//   node tools/fixture-gen/generate.mjs --list
//
// Every fixture is a pure function of its seed and its catalogue entry, so the
// large files are reproducible rather than committed.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { synthesise } from './lib/programme.mjs';
import { meaningOf } from './lib/calendar.mjs';
import { buildTables } from './lib/tables.mjs';
import { writeXer, orderTables } from './lib/emit.mjs';
import { CATALOGUE } from './catalogue.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SYNTHETIC = path.join(ROOT, 'fixtures/synthetic');
const GENERATED = path.join(ROOT, 'fixtures/generated');

const META_KEYS = new Set([
  'name', 'dir', 'description', 'landmine', 'tableOpts', 'mutate', 'ingest', 'speculative',
  'corrupt', 'noProgramme',
]);

function optsOf(entry) {
  return Object.fromEntries(Object.entries(entry).filter(([k]) => !META_KEYS.has(k)));
}

function outDirOf(entry) {
  if (entry.dir === 'generated') return GENERATED;
  return entry.dir === '.' ? SYNTHETIC : path.join(SYNTHETIC, entry.dir);
}

async function generate(entry) {
  const dir = outDirOf(entry);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${entry.name}.xer`);

  // A fixture whose landmine is that the bytes are UNREADABLE has no programme behind
  // it. An all-NUL file is not something synthesise() can produce, and a golden full
  // of intent standing in front of bytes that carry none would assert the opposite of
  // the thing the fixture exists to say (040).
  if (entry.noProgramme) {
    const started = process.hrtime.bigint();
    const raw = entry.corrupt(null);
    fs.writeFileSync(file, raw);
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const expected = describeCorrupt(entry, file, raw);
    writeGolden(entry, dir, expected);
    return { file, bytes: raw.length, ms, expected };
  }

  const opts = optsOf(entry);
  const model = synthesise({ seed: hashSeed(entry.name), ...opts });
  const tables = buildTables(model, entry.tableOpts ?? {});
  entry.mutate?.(tables);

  // Only the tables this version actually emits — UMEASURE is 8.3-only, so the 6.0
  // fixture must not promise it in its golden.
  const emitted = orderTables(opts.version, tables);
  const started = process.hrtime.bigint();
  let bytes = await writeXer(file, { version: opts.version, tables: emitted });
  const ms = Number(process.hrtime.bigint() - started) / 1e6;

  // `corrupt` damages the file AFTER it is written, which is the only way to build a
  // fixture whose landmine is the damage rather than the programme. It is the one hook
  // that is allowed to contradict the model, and it is safe for the same reason
  // `mutate` is not: it removes bytes from the END of the file, so every record the
  // damaged file still carries is byte-identical and the golden below stays true of
  // all of them. What the damage costs is recorded separately, in `readability`,
  // measured off the bytes.
  if (entry.corrupt) {
    const raw = entry.corrupt(fs.readFileSync(file));
    fs.writeFileSync(file, raw);
    bytes = raw.length;
  }

  const expected = describe(entry, opts, model, tables, emitted, file, bytes);
  if (entry.corrupt) expected.readability = readability(fs.readFileSync(file));
  writeGolden(entry, dir, expected);
  return { file, bytes, ms, expected };
}

function writeGolden(entry, dir, expected) {
  if (entry.dir === 'generated') return;
  fs.writeFileSync(
    path.join(dir, `${entry.name}.expected.json`),
    `${JSON.stringify(expected, null, 2)}\n`,
  );
}

/**
 * The golden expectation.
 *
 * Written from what the generator INTENDED to emit, never from parsing the result —
 * a golden produced by our own tokenizer would assert nothing. A parser has to agree
 * with this file; the file does not have to agree with a parser.
 */
function describe(entry, opts, model, tables, emitted, file, bytes) {
  const taskRows = tables.TASK?.rows ?? [];
  const num = (v) => (v === '' || v === undefined ? null : Number(v));

  const mix = (rows, field) => rows.reduce((acc, row) => {
    const k = row[field] === '' || row[field] === undefined ? '(empty)' : String(row[field]);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const floats = taskRows.map((t) => num(t.total_float_hr_cnt));
  const projIds = new Set(taskRows.map((t) => t.proj_id));

  const wbsRows = tables.PROJWBS?.rows ?? [];
  const parentOf = new Map(wbsRows.map((n) => [n.wbs_id, n.parent_wbs_id]));
  const depthOf = (id, seen = 0) => {
    const parent = parentOf.get(id);
    return parent === '' || parent === undefined || seen > 64 ? 1 : 1 + depthOf(parent, seen + 1);
  };

  const expected = {
    fixture: entry.name,
    description: entry.description,
    landmine: entry.landmine,
    speculative: entry.speculative ?? false,
    p6_version: opts.version,
    generator: { seed: hashSeed(entry.name), options: opts },
    file: { bytes, sha256: sha256(file) },
    tables: emitted.map((t) => ({ name: t.name, rows: t.rows.length })),
    calendars: calendarBlock(tables),
    assertions: {
      data_date: tables.PROJECT?.rows[0]?.last_recalc_date ?? null,
      project_row_count: tables.PROJECT?.rows.length ?? 0,
      distinct_task_proj_id: projIds.size,
      activity_count: taskRows.length,
      status_mix: mix(taskRows, 'status_code'),
      activity_type_mix: mix(taskRows, 'task_type'),
      relationship_type_mix: mix(tables.TASKPRED?.rows ?? [], 'pred_type'),
      constraint_mix: mix(taskRows, 'cstr_type'),
      float_hr: {
        negative: floats.filter((f) => f !== null && f < 0).length,
        zero: floats.filter((f) => f === 0).length,
        null: floats.filter((f) => f === null).length,
      },
      wbs: {
        node_count: wbsRows.length,
        max_depth: wbsRows.reduce((m, n) => Math.max(m, depthOf(n.wbs_id)), 0),
      },
      calendar_count: tables.CALENDAR?.rows.length ?? 0,
      // How many of the declared calendars anything is actually ON (045). Fixture A
      // declares four and uses one; `calendar_count` is a fact about the file and this is
      // the fact about the programme. Counted off TASK.clndr_id, so `missing-calendar`
      // reports 2 against a `calendar_count` of 0 — it names calendars it does not carry.
      calendars_in_use: new Set(taskRows.map((t) => t.clndr_id)).size,
      duration_working_days: durationWorkingDays(tables),
      resource_count: tables.RSRC?.rows.length ?? 0,
      resource_assignment_count: tables.TASKRSRC?.rows.length ?? 0,
      activity_code_assignment_count: tables.TASKACTV?.rows.length ?? 0,
      external_relationship_count: (tables.TASKPRED?.rows ?? [])
        .filter((rel) => rel.pred_proj_id !== rel.proj_id).length,
      driving_path_flag_count: taskRows.filter((t) => t.driving_path_flag === 'Y').length,
    },
    driving_path: drivingPath(model),
    // Only where the fixture asked for Multiple Float Paths, and built beside the walk
    // that produces it rather than here, because it is a statement about how the two
    // marks RELATE and needs both of them (039).
    ...(model.drivingPath.floatPaths ? { float_paths: model.drivingPath.floatPaths } : {}),
    ingest: entry.ingest ?? { accept: true, reason: 'no ingest rule under test' },
  };

  // Tiny files carry a full name-mapped dump: the strongest golden available, and
  // the one that catches a parser reading the right column by luck.
  if (taskRows.length > 0 && taskRows.length <= 60) {
    expected.tasks = taskRows.map((t) => ({
      task_code: t.task_code,
      task_name: t.task_name,
      task_type: t.task_type,
      status_code: t.status_code,
      target_drtn_hr_cnt: num(t.target_drtn_hr_cnt),
      remain_drtn_hr_cnt: num(t.remain_drtn_hr_cnt),
      total_float_hr_cnt: num(t.total_float_hr_cnt),
      free_float_hr_cnt: num(t.free_float_hr_cnt),
      early_start_date: t.early_start_date || null,
      early_end_date: t.early_end_date || null,
      act_start_date: t.act_start_date || null,
      act_end_date: t.act_end_date || null,
      cstr_type: t.cstr_type || null,
      driving_path_flag: t.driving_path_flag || null,
      float_path: t.float_path === '' ? null : Number(t.float_path),
      float_path_order: t.float_path_order === '' ? null : Number(t.float_path_order),
    }));
  }
  return expected;
}

/**
 * `time.duration_working_days`, from the generator's model (045, built by 047).
 *
 * The programme's span converted on the calendar the file names as the programme's own —
 * `PROJECT.clndr_id`, taken from the row matching the activities' `proj_id` — reported
 * with that calendar beside it and with the share of activities actually sitting on it.
 * `default_flag` is not the field: it marks what new activities inherit, and on a real
 * file it can name a calendar holding none of them.
 *
 * **The expected value comes from the working week `buildClndrData` packed, never from
 * the corpus's own dates.** The two are not the same thing here: this generator lays every
 * activity out on one five-day `WorkCalendar` whatever `TASK.clndr_id` says, so a file's
 * `target_drtn_hr_cnt` and its activity dates disagree with the seven-day calendar half its
 * activities are on — 6 of 19 rows on `wbs-flat`. A golden read off those dates would assert
 * the inconsistency instead of the conversion. So the walk below is the calendar's own: the
 * days between the window's ends, each one worked or not according to the packed week and
 * whatever exception lands on it.
 *
 * **Whole days, not timestamps** — see the ticket's convention note. The window is
 * `time.start_date`..`time.finish_date` as *dates*, both ends counted, which is P6's own
 * duration arithmetic (an activity starting and finishing on one working day is one day,
 * not zero) and which needs no day length — the thing 045 §6 and
 * [048](../../docs/wayfinder/tickets/048-elapsed-calendar-semantics.md) between them make it
 * a hazard to divide by.
 */
function durationWorkingDays(tables) {
  const taskRows = tables.TASK?.rows ?? [];
  const calRows = tables.CALENDAR?.rows ?? [];
  const unavailable = (reason) => ({ state: 'unavailable', reason });

  // 043's reason string, unchanged, so `missing-calendar` keeps its pin and
  // `enc-zeroed-file` passes the same check for free.
  if (calRows.length === 0) {
    return unavailable('no CALENDAR table, so there is no shift pattern to convert on');
  }
  const projIds = [...new Set(taskRows.map((t) => String(t.proj_id)))];
  if (projIds.length !== 1) {
    return unavailable(`activities span ${projIds.length} projects, so there is no`
      + ' single programme calendar');
  }
  const project = (tables.PROJECT?.rows ?? []).find((p) => String(p.proj_id) === projIds[0]);
  const named = project?.clndr_id;
  if (named === undefined || named === '') {
    return unavailable(`the PROJECT row for proj_id ${projIds[0]} names no calendar`);
  }
  const row = calRows.find((c) => String(c.clndr_id) === String(named));
  if (!row) {
    return unavailable(`PROJECT.clndr_id ${named} is not in the file's CALENDAR table`);
  }
  const meaning = meaningOf(row.clndr_data);
  if (!meaning) {
    // A blob this generator did not pack has no recorded working week, so there is no
    // intent to convert on and none is invented. No fixture reaches this today; the
    // matching state in the harness is `error`, whose reason is a decoder diagnostic.
    return { state: 'error', reason: `clndr_data for calendar ${named} was not packed by`
      + ' buildClndrData, so its working week is not recorded' };
  }
  const window = programmeWindow(taskRows);
  if (!window) return unavailable('no activity dates, so there is no window to convert');

  const worked = new Map(meaning.exceptions.map((e) => [e.date, e.works]));
  const cursor = new Date(`${window.start}T00:00:00Z`);
  const end = Date.parse(`${window.finish}T00:00:00Z`);
  let days = 0;
  while (cursor.getTime() <= end) {
    const date = cursor.toISOString().slice(0, 10);
    // An exception overrides the weekday pattern in both directions: a closure on a
    // working day, and a working day bought back on a weekend (021 found both real).
    const works = worked.has(date) ? worked.get(date) : meaning.week[cursor.getUTCDay()].works;
    if (works) days++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const on = taskRows.filter((t) => String(t.clndr_id) === String(named)).length;
  return {
    days,
    calendar: {
      clndr_id: Number(row.clndr_id),
      name: row.clndr_name,
      working_days_per_week: meaning.working_days_per_week,
    },
    // What stops the number quietly claiming the whole programme: 100 on every real file
    // measured, 50 across this corpus.
    activity_share_pct: Math.round((on / (taskRows.length || 1)) * 1000) / 10,
  };
}

/**
 * The window the conversion runs over: `time.start_date`..`time.finish_date`, which is the
 * window `span_calendar_days` measures — earliest actual-or-early-or-target start to latest
 * actual-or-early-or-target finish, as dates. `YYYY-MM-DD HH:MM` is fixed width, so a
 * lexical min and max over the emitted strings is a chronological one.
 */
function programmeWindow(taskRows) {
  let start = null;
  let finish = null;
  for (const t of taskRows) {
    const s = t.act_start_date || t.early_start_date || t.target_start_date;
    const f = t.act_end_date || t.early_end_date || t.target_end_date;
    if (s && (start === null || s < start)) start = s;
    if (f && (finish === null || f > finish)) finish = f;
  }
  return start && finish ? { start: start.slice(0, 10), finish: finish.slice(0, 10) } : null;
}

/**
 * What every `CALENDAR` row MEANS, beside what it claims.
 *
 * The meaning comes from `meaningOf` — the working-time model `lib/calendar.mjs` packed
 * into `clndr_data`, recorded as it packed it — so this block is intent like every other
 * one, not a read-back of our own bytes. A `mutate` hook that swaps a calendar's blob is
 * followed correctly for the same reason: the lookup is on the blob that ends up in the
 * row, not on the model the programme was built with.
 *
 * `declared` is the untrustworthy half (038): `day_hr_cnt` and `week_hr_cnt` are empty on
 * some real calendars and contradict the day pattern on others, and neither is ever the
 * source of a day length. Recorded so the contradiction is a fixed assertion rather than
 * a remark — on `cal-flat-no-0x7f` row 2 it is empty and 56 against a pattern working 40.
 *
 * `same_meaning_as` is the pair claim: this row decodes to the calendar that row decodes
 * to, and `identical_bytes` says whether it does so in different bytes. That is
 * `cal-flat-no-0x7f`'s whole reason for existing, and it is the one assertion no
 * per-row comparison against intent can produce.
 */
function calendarBlock(tables) {
  const rows = tables.CALENDAR?.rows ?? [];
  const meanings = rows.map((row) => meaningOf(row.clndr_data));
  const key = (m) => (m ? JSON.stringify([m.week, m.exceptions]) : null);
  const declared = (v) => (v === '' || v === undefined || v === null ? null : Number(v));

  return rows.map((row, i) => {
    const m = meanings[i];
    const twin = m === null ? -1
      : meanings.findIndex((other, j) => j < i && other !== null && key(other) === key(m));
    return {
      clndr_id: Number(row.clndr_id),
      clndr_name: row.clndr_name,
      clndr_type: row.clndr_type,
      default_flag: row.default_flag,
      declared: { day_hr_cnt: declared(row.day_hr_cnt), week_hr_cnt: declared(row.week_hr_cnt) },
      // A blob this generator did not pack has no recorded intent, and a golden written
      // by reading it back would assert nothing — so it says so instead.
      ...(m ?? { meaning: null, reason: 'clndr_data was not packed by buildClndrData' }),
      same_meaning_as: twin === -1 ? null : Number(rows[twin].clndr_id),
      ...(twin === -1 ? {} : { identical_bytes: rows[twin].clndr_data === row.clndr_data }),
    };
  });
}

/**
 * The Longest Path this file is FOR, recorded from the walk the generator ran over
 * its own logic — never by parsing the `.xer` back in.
 *
 * `members` is the assertion. Everything else is context a tracer can be judged
 * against: where the path branches, where it leaves the file, whether it reaches the
 * data date, and — stated rather than hidden — the two places a date-reading tracer
 * built to 014 decision 4 is expected to disagree.
 */
function drivingPath(model) {
  const dp = model.drivingPath;
  const flagRun = model.opts.longestPathFlag;   // model.opts carries the DEFAULTS merge
  const codes = (list) => list.map((t) => t.task_code).sort();
  const walk = (w) => {
    const members = [...w.memberIdx].map((i) => model.tasks[i]).filter((t) => !t.external);
    return {
      state: w.state,
      ...(w.reason ? { reason: w.reason } : {}),
      seeds: codes(w.seeds.filter((t) => !t.external)),
      member_count: members.length,
      members: codes(members),
      branch_count: w.branches.length,
      branches: w.branches
        .map((b) => ({
          task_code: b.task.task_code,
          driving_predecessors: b.drivers.map((t) => t.task_code).sort(),
        }))
        .sort((a, b) => a.task_code.localeCompare(b.task_code)),
      truncated: w.truncated,
      cycle_count: w.cycles.length,
      cycles: w.cycles.map((ring) => ring.map((t) => t.task_code)),
      path_continuous: w.continuous,
      open_chain_tails: codes(w.tails),
    };
  };

  const truth = walk(dp.truth);
  const readable = walk(dp.readable);
  const added = readable.members.filter((c) => !truth.members.includes(c));
  const removed = truth.members.filter((c) => !readable.members.includes(c));
  // 042: each walk already recorded its own `seeds` and nothing ever put the two lists
  // side by side, so the walks could start in different places with no field saying so.
  const seedsOnlyInTruth = truth.seeds.filter((c) => !readable.seeds.includes(c));
  const seedsOnlyInRead = readable.seeds.filter((c) => !truth.seeds.includes(c));

  return {
    definition: 'remaining work as of the data date, walked back from the latest '
      + 'remaining finish; driving predecessors are those that set the successor\'s '
      + 'constraining date, ties all kept (014 decisions 3 and 4, as amended by 028)',
    computed_from: 'the generator\'s own logic network, not total float',
    longest_path_run: flagRun,
    ...truth,
    // driving_path_flag is written from `members` above, so it is the oracle a tracer
    // is scored against — exactly the role 014 decision 2 gives P6's own flag.
    flagged: flagRun ? truth.members : [],
    external_predecessors: dp.truth.external.map((t) => ({
      task_id: t.task_id,
      proj_id: t.proj_id,
      drives: t.succs.map((rel) => model.tasks[rel.succ])
        .filter((s) => dp.truth.memberIdx.has(s.idx)).map((s) => s.task_code).sort(),
    })),
    // What the corpus exists to catch: a `tf <= 0` tracer marks THESE instead.
    float_based_tracer: {
      note: 'total_float_hr_cnt <= 0 is not the Longest Path (xer-format.md, 014 decision 4)',
      count: dp.floatBased.count,
      marks_in_error: codes(dp.floatBased.extra),
      misses: codes(dp.floatBased.missing),
    },
    // What a CORRECT tracer — 014 decision 4, reading only this file's bytes — can
    // arrive at. Where it differs from `members` above, that IS the approximation 014
    // accepted, and this is where the corpus states it instead of hiding it.
    as_read_from_the_file: {
      note: 'per relationship type on the emitted timestamps — FS pred.early_end_date '
        + '+ lag vs succ.early_start_date, SS pred.early_start_date + lag vs '
        + 'succ.early_start_date, FF pred.early_end_date + lag vs succ.early_end_date, '
        + 'SF pred.early_start_date + lag vs succ.early_end_date; argmax of '
        + 'demand - reference, ties all kept, plus the same-kind zero-lag floor '
        + '(014 decision 4 as amended by 028). Lag is elapsed hours; relationships '
        + 'absent from the file are absent from the walk; predecessors outside the '
        + 'file are unresolvable and make the chain truncated',
      differs: added.length > 0 || removed.length > 0
        || readable.branch_count !== truth.branch_count
        || readable.truncated !== truth.truncated || readable.state !== truth.state
        || readable.path_continuous !== truth.path_continuous,
      ...readable,
      marks_in_error: added,
      misses: removed,
      why: dp.causes,
      // Where each walk STARTS, compared rather than merely listed twice (042). Both
      // walks span remaining work back from the latest remaining finish (014 decision
      // 3); the truth reads "latest" in working hours and a file-reader can only read it
      // in elapsed time. Those were different orderings while a zero-duration row wrote
      // its finish as a START instant — it outranked the tasks it finished with by a
      // non-working gap it did not own — and 049 corrected that against P6, so a
      // milestone and the tasks that finish with it now write the same `early_end_date`
      // and the two orderings coincide. `agree` is true on every corpus file; the block
      // stays because it is the only field that would say so if it stopped being.
      seed_agreement: {
        note: 'the truth seeds on the latest remaining finish measured in working '
          + 'hours; this walk seeds on the latest finish instant among the emitted '
          + 'timestamps. Every row writes its finish at the end of the working hour it '
          + 'occupies, zero-duration or not (049), so the two orderings coincide and '
          + 'these sets agree — including where the seed set TIES between a finish '
          + 'milestone and the task it finishes with, which is the shape 044 measured on '
          + '47 of 47 real ties',
        agree: seedsOnlyInTruth.length === 0 && seedsOnlyInRead.length === 0,
        truth: truth.seeds,
        as_read: readable.seeds,
        only_in_truth: seedsOnlyInTruth,
        only_in_read: seedsOnlyInRead,
      },
      recall_pct: truth.member_count === 0 ? null
        : Math.round(((truth.member_count - removed.length) / truth.member_count) * 1000) / 10,
      precision_pct: readable.member_count === 0 ? null
        : Math.round(((readable.member_count - added.length) / readable.member_count) * 1000) / 10,
    },
  };
}

/**
 * The `unreadable` guard (040), measured off the bytes.
 *
 * A `.xer` is READABLE when the file's last record is the format's own `%E` end
 * marker AND the file carries no `NUL` byte. Failing either makes it unreadable —
 * an incomplete or corrupt copy — rather than an empty programme.
 *
 * Both halves are byte facts a scan already has in hand, and both were measured
 * against the 139 real exports: **138 end with `%E\r\n` and contain not one NUL
 * byte between them**; the 139th satisfies neither and is 397,781 bytes of pure NUL.
 * Nothing here is a parse result — a prefix test, a marker test and a counter — which
 * is what lets a corrupt fixture have a golden at all, since there is nothing in it
 * to parse and a golden written from our own tokenizer would assert nothing.
 */
function readability(raw) {
  let nulCount = 0;
  for (let i = 0; i < raw.length; i++) if (raw[i] === 0) nulCount++;
  let trailingNul = 0;
  for (let i = raw.length - 1; i >= 0 && raw[i] === 0; i--) trailingNul++;

  // Measured on the content BEFORE any zero padding, so the two halves of the guard
  // stay independent: a file that ends properly and is then zero-padded fails on the
  // NUL count alone, and this field says so rather than hiding it.
  const complete = raw.length - trailingNul;
  const reachesEnd = raw.subarray(Math.max(0, complete - 16), complete)
    .toString('latin1').replace(/[\r\n\t ]+$/, '').endsWith('%E');

  return {
    starts_with_ermhdr: raw.subarray(0, 7).toString('latin1') === 'ERMHDR\t',
    reaches_end_marker: reachesEnd,
    nul_byte_count: nulCount,
    trailing_nul_run: trailingNul,
    // The prefix that is still a well-formed .xer minus its end marker — take the
    // file's first `complete_bytes` and you have the clean-truncation variant, with
    // no NUL in it, which is what an interrupted download leaves.
    complete_bytes: complete,
    verdict: reachesEnd && nulCount === 0 ? 'readable' : 'unreadable',
  };
}

/**
 * The golden for a fixture with no programme behind it.
 *
 * Same shape as `describe()`, so the round-trip harness reads it the same way and
 * every count it checks is a zero it can check. The zeros are the point: a file that
 * parses to nothing produces a scan result indistinguishable from a very small
 * programme, so none of these counts can be the discriminator. `readability` is.
 */
function describeCorrupt(entry, file, raw) {
  return {
    fixture: entry.name,
    description: entry.description,
    landmine: entry.landmine,
    speculative: entry.speculative ?? false,
    p6_version: null,
    generator: { seed: hashSeed(entry.name), options: { noProgramme: true } },
    file: { bytes: raw.length, sha256: sha256(file) },
    tables: [],
    calendars: [],
    assertions: {
      data_date: null,
      project_row_count: 0,
      distinct_task_proj_id: 0,
      activity_count: 0,
      status_mix: {},
      activity_type_mix: {},
      relationship_type_mix: {},
      constraint_mix: {},
      float_hr: { negative: 0, zero: 0, null: 0 },
      wbs: { node_count: 0, max_depth: 0 },
      calendar_count: 0,
      calendars_in_use: 0,
      // Not a zero, because absent-from-source is not zero — and it is the one assertion
      // in this golden that is not a count, so it is the one a scan of all zeros cannot
      // satisfy by accident. 043's string, which a file with no CALENDAR table earns
      // whether it is a sparse programme or 397,781 NUL bytes.
      duration_working_days: {
        state: 'unavailable',
        reason: 'no CALENDAR table, so there is no shift pattern to convert on',
      },
      resource_count: 0,
      resource_assignment_count: 0,
      activity_code_assignment_count: 0,
      external_relationship_count: 0,
      driving_path_flag_count: 0,
    },
    // No walk — there is no logic network to walk. `flagged` is present and empty
    // rather than absent, so the round-trip harness compares an empty set against an
    // empty column and passes, instead of reading `undefined` and taking the whole
    // corpus run down with it.
    driving_path: {
      definition: 'no programme in this file — there is nothing to walk',
      state: 'skip',
      reason: 'the file carries no records',
      member_count: 0,
      members: [],
      flagged: [],
    },
    ingest: entry.ingest ?? { accept: true, reason: 'no ingest rule under test' },
    readability: readability(raw),
  };
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Seed from the fixture name, so adding a fixture never reshuffles another. */
function hashSeed(name) {
  return crypto.createHash('sha256').update(name).digest().readUInt32BE(0);
}

// ---- CLI --------------------------------------------------------------------

const argv = process.argv.slice(2);
const arg = (flag) => {
  const i = argv.indexOf(flag);
  return i === -1 ? null : argv[i + 1];
};

if (argv.includes('--list')) {
  for (const e of CATALOGUE) console.log(`${e.dir === 'generated' ? '[perf] ' : '       '}${e.name}  — ${e.description}`);
  process.exit(0);
}

const only = arg('--only');
const wanted = only
  ? CATALOGUE.filter((e) => e.name === only)
  : CATALOGUE.filter((e) => argv.includes('--all') || e.dir !== 'generated');

if (wanted.length === 0) {
  console.error(only ? `no fixture named "${only}"` : 'nothing to generate');
  process.exit(1);
}

const rows = [];
for (const entry of wanted) {
  const { file, bytes, ms } = await generate(entry);
  rows.push({ fixture: entry.name, bytes, ms: Math.round(ms), file: path.relative(ROOT, file) });
  console.log(`${entry.name.padEnd(26)} ${String(bytes).padStart(12)} bytes  ${String(Math.round(ms)).padStart(6)} ms  ${path.relative(ROOT, file)}`);
}
