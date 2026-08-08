// Synthesise a programme: WBS tree, activities, a logic network, a real CPM pass,
// progress, codes, resources and UDFs.
//
// The point of the CPM pass is that float and the critical path have to MEAN
// something. Random dates give a meaningless critical path, a nonsense float
// histogram and a DCMA score that measures nothing — which would make the file
// useless for the detail page and worse than useless for the quality checks.

import { rng } from './rng.mjs';
import { WorkCalendar, buildClndrData, fmtDate, fmtDateTime, rowStart, rowFinish } from './calendar.mjs';

const HOURS_PER_DAY = 8;

const DURATION_DAYS = [
  [1, 12], [2, 10], [3, 10], [5, 16], [10, 16], [15, 10],
  [20, 8], [30, 6], [44, 4], [60, 3], [90, 2], [120, 1],
];

const REL_TYPES = [['PR_FS', 92], ['PR_SS', 6], ['PR_FF', 1.5], ['PR_SF', 0.5]];

// An activity that is deliberately left OUT of the emitted file: the chain walks back
// into another project's logic, which is a legitimate export, not corruption.
const EXTERNAL_PROJ_ID = 90099;
const EXTERNAL_TASK_ID = 999001;

const HARD_CONSTRAINTS = ['CS_MSO', 'CS_MEO'];
const SOFT_CONSTRAINTS = ['CS_MSOA', 'CS_MEOA', 'CS_MSOB', 'CS_MEOB'];

const WBS_WORDS = ['Enabling Works', 'Site Establishment', 'Piling', 'Substructure',
  'Superstructure', 'Architectural', 'MEP Services', 'Tunnelling', 'Trackwork',
  'Systems Installation', 'Testing and Commissioning', 'Handover', 'Utilities Diversion',
  'Temporary Traffic', 'Station Fitout', 'Depot Works'];

const VERB = ['Excavate', 'Install', 'Construct', 'Cast', 'Erect', 'Survey', 'Test',
  'Commission', 'Deliver', 'Fabricate', 'Inspect', 'Approve', 'Backfill', 'Demolish',
  'Divert', 'Waterproof', 'Reinstate', 'Mobilise'];
const NOUN = ['Pile Cap', 'Retaining Wall', 'Base Slab', 'Roof Slab', 'Cable Tray',
  'Switchgear', 'Drainage', 'Formwork', 'Rebar Cage', 'Access Road', 'Hoarding',
  'Ventilation Duct', 'Fire Main', 'Platform Screen Door', 'Escalator', 'Track Slab'];

const CODE_TYPES = [
  { name: 'Discipline', values: ['CIVIL', 'STRUCT', 'ARCH', 'MECH', 'ELEC', 'SYS', 'TRACK'] },
  { name: 'Area', values: ['A1', 'A2', 'A3', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'E1'] },
  { name: 'Phase', values: ['DESIGN', 'PROCR', 'CN', 'TS', 'HANDOVER'] },
  { name: 'Contractor', values: ['MAIN', 'SUB-CIV', 'SUB-MEP', 'SUB-SYS'] },
  { name: 'Work Package', values: ['WP01', 'WP02', 'WP03', 'WP04', 'WP05', 'WP06', 'WP07'] },
  { name: 'Location', values: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL'] },
  { name: 'Milestone Type', values: ['KEY', 'INTERFACE', 'CONTRACT'] },
  { name: 'Responsibility', values: ['ENG', 'PM', 'QS', 'HSE'] },
  { name: 'Level', values: ['L1', 'L2', 'L3', 'L4'] },
  { name: 'Shift Pattern', values: ['DAY', 'NIGHT', 'DAYNIGHT'] },
  { name: 'Risk', values: ['LOW', 'MED', 'HIGH'] },
  { name: 'Reporting Group', values: ['RG-A', 'RG-B', 'RG-C', 'RG-D'] },
];

export const DEFAULTS = {
  seed: 1,
  version: '8.3',
  activities: 200,
  wbsNodes: 20,
  wbsDepth: 4,
  predPerActivity: 1.7,
  codesPerActivity: 10,
  rsrcPerActivity: 1.8,
  udfPerActivity: 4,
  resources: 20,
  calendars: 3,
  // Which declared CALENDAR row carries default_flag = Y, and whether the activities are
  // split across the declared calendars or all sit on the programme's own (045). The
  // corpus default — ten and ten across two calendars, default_flag on the one half the
  // activities use — is a shape no real programme produced, and it is the only thing
  // exercising `activity_share_pct`, so it stays. `oneCalendar` with `defaultFlagIdx`
  // pointing elsewhere is the shape both real sets actually have.
  oneCalendar: false,
  defaultFlagIdx: 0,
  progress: 'none',          // 'none' | 'partial' | 'full'
  deadlineSlipDays: 0,       // >0 pulls the project deadline in, creating negative float
  startDate: '2026-01-05',   // a Monday
  projects: 1,               // >1 puts activities under a second proj_id (011 rejects it)
  extraProjectRows: 0,       // baseline-bearing exports carry several PROJECT rows
  openEndPct: 0.02,
  leadPct: 0.02,
  lagPct: 0.04,
  hardConstraintPct: 0.03,
  softConstraintPct: 0.01,
  longestPathFlag: true,     // P6 only populates driving_path_flag when asked to
  relTypes: REL_TYPES,       // a tracer landmine may force an all-FS network
  forceDrivingBranch: 0,     // guarantee N activities with two driving predecessors
  injectCycle: 0,            // add N back edges — a network P6 could never have scheduled
  externalDrivingPred: false,// move the chain's tail out of the file entirely
  floatPaths: 0,             // N = calculate N Multiple Float Paths, ranked by total float
  interimDeadlineDays: 0,    // Finish On or Before on a chain that does NOT drive the finish
  externalRels: 0,           // N relationships whose predecessor sits in another project
  hideRelationships: false,  // schedule with logic, then export without TASKPRED
};

export function synthesise(opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const r = rng(o.seed);

  const projId = 90001;
  const holidays = holidaysBetween(o.startDate, 12);
  const cal = new WorkCalendar({ holidays });

  // ---- calendars ------------------------------------------------------------
  const calendars = [];
  for (let i = 0; i < o.calendars; i++) {
    const sevenDay = i === 1;
    calendars.push({
      clndr_id: 6600 + i,
      clndr_name: sevenDay ? '7 Days Work / Week' : i === 0 ? '5 Day Working Week' : `Shift Calendar ${i}`,
      clndr_type: i === 0 ? 'CA_Base' : 'CA_Project',
      // What NEW activities inherit, which is not what a programme is measured on —
      // `PROJECT.clndr_id` is (045). On one real file the flagged calendar holds 0 of
      // 1,746 activities, so the two are severable and `defaultFlagIdx` severs them.
      default_flag: i === o.defaultFlagIdx ? 'Y' : 'N',
      day_hr_cnt: HOURS_PER_DAY,
      week_hr_cnt: sevenDay ? 56 : 40,
      month_hr_cnt: 172,
      year_hr_cnt: 2000,
      clndr_data: buildClndrData({
        workDays: sevenDay ? [1, 2, 3, 4, 5, 6, 7] : [2, 3, 4, 5, 6],
        holidays: sevenDay ? [] : holidays,
        view: true,
      }),
    });
  }

  // ---- WBS ------------------------------------------------------------------
  const wbs = buildWbs(o, projId, r);
  const leaves = wbs.filter((n) => !wbs.some((c) => c.parent_wbs_id === n.wbs_id));

  // ---- activities -----------------------------------------------------------
  const tasks = [];
  for (let i = 0; i < o.activities; i++) {
    const leaf = leaves[i % leaves.length];
    const roll = r.next();
    const type = roll < 0.006 ? 'TT_Mile' : roll < 0.07 ? 'TT_FinMile' : 'TT_Task';
    const durDays = type === 'TT_Task' ? r.weighted(DURATION_DAYS) : 0;
    tasks.push({
      idx: i,
      task_id: 200000 + i,
      proj_id: o.projects > 1 && i % 2 === 1 ? projId + 1 : projId,
      wbs_id: leaf.wbs_id,
      // Round-robin across the declared calendars, or all on calendars[0] — which is the
      // one `PROJECT.clndr_id` names, so `oneCalendar` is the real single-calendar shape
      // rather than merely a smaller split.
      clndr_id: (o.oneCalendar ? calendars[0] : calendars[i % calendars.length]).clndr_id,
      task_code: `A${String(1000 + i * 10).padStart(6, '0')}`,
      // Plain ASCII by default: each corpus file is meant to carry ONE landmine, so
      // stray high bytes here would make an encoding failure point at the wrong file.
      task_name: `${r.pick(VERB)} ${r.pick(NOUN)} - ${leaf.wbs_short_name}`,
      task_type: type,
      dur: durDays * HOURS_PER_DAY,
      leafSeq: Math.floor(i / leaves.length),
      preds: [],
      succs: [],
    });
  }

  if (o.projects > 1) {
    // A second project gets its own root WBS node, as a real multi-project export
    // would. 011's discriminator is distinct TASK.proj_id, not PROJECT row count.
    const secondRoot = {
      wbs_id: 199999, parent_wbs_id: '', proj_id: projId + 1, proj_node_flag: 'Y',
      wbs_short_name: 'PRJ2', wbs_name: 'Second Project', seq_num: 0, depth: 1,
    };
    wbs.push(secondRoot);
    for (const task of tasks) {
      if (task.proj_id !== projId) task.wbs_id = secondRoot.wbs_id;
    }
  }

  // ---- logic network --------------------------------------------------------
  // Chains run within a WBS leaf, with cross-leaf links layered on top, so the
  // network has real depth rather than being a flat fan.
  const preds = [];
  const byLeaf = new Map();
  for (const t of tasks) {
    if (!byLeaf.has(t.wbs_id)) byLeaf.set(t.wbs_id, []);
    byLeaf.get(t.wbs_id).push(t);
  }
  let predId = 500000;
  const link = (succ, pred, type, lag) => {
    if (pred.idx >= succ.idx) return;             // keep the graph acyclic by construction
    if (succ.preds.some((p) => p.pred === pred.idx)) return;
    const rel = { task_pred_id: predId++, succ: succ.idx, pred: pred.idx, type, lag };
    preds.push(rel);
    succ.preds.push(rel);
    pred.succs.push(rel);
  };

  for (const chain of byLeaf.values()) {
    for (let i = 1; i < chain.length; i++) {
      if (r.chance(o.openEndPct)) continue;       // deliberate open end
      link(chain[i], chain[i - 1], r.weighted(o.relTypes), lagFor(r, o));
    }
  }
  // Extra links to reach the target density, drawn from anywhere earlier in the file.
  const target = Math.round(o.activities * o.predPerActivity);
  let guard = 0;
  while (preds.length < target && guard < target * 20) {
    guard++;
    const succ = tasks[r.int(1, tasks.length - 1)];
    const pred = tasks[r.int(0, succ.idx - 1)];
    link(succ, pred, r.weighted(o.relTypes), lagFor(r, o));
  }

  // Relationships the FILE will not show, declared here rather than by rewriting the
  // emitted rows afterwards. A `mutate(tables)` hook that edits logic desyncs the
  // model from the bytes, and the golden's whole defence is that it comes from the
  // model — so anything the trace has to know about lives in the model.
  for (let i = 0; i < o.externalRels && i < preds.length; i++) preds[i].external = true;
  if (o.hideRelationships) for (const rel of preds) rel.hidden = true;

  // ---- constraints ----------------------------------------------------------
  for (const t of tasks) {
    if (r.chance(o.hardConstraintPct)) t.cstr_type = r.pick(HARD_CONSTRAINTS);
    else if (r.chance(o.softConstraintPct)) t.cstr_type = r.pick(SOFT_CONSTRAINTS);
  }

  // ---- CPM ------------------------------------------------------------------
  forwardPass(tasks);
  // Two landmines are built HERE, between the passes, because both change the logic
  // the CPM reads. Doing either by mutating emitted rows would desync the golden from
  // the model, and the golden's whole defence is that it comes from the model.
  if (o.forceDrivingBranch > 0) forceDrivingBranches(tasks, o.forceDrivingBranch);
  if (o.injectCycle > 0) injectCycles(tasks, preds, o.injectCycle, predId);
  if (o.interimDeadlineDays > 0) setInterimDeadline(tasks, o.interimDeadlineDays);
  const computedFinish = tasks.reduce((m, t) => Math.max(m, t.ef), 0);
  const deadline = computedFinish - o.deadlineSlipDays * HOURS_PER_DAY;
  backwardPass(tasks, deadline);

  // Size the working-day index to what the CPM actually produced. Late dates on a
  // negative-float path land before the project start, hence the backfill.
  const maxHour = tasks.reduce((m, t) => Math.max(m, t.ef, t.lf), computedFinish);
  const minHour = tasks.reduce((m, t) => Math.min(m, t.es, t.ls), 0);
  cal.buildIndex(
    new Date(`${o.startDate}T00:00:00Z`),
    Math.ceil(maxHour / HOURS_PER_DAY) + 20,
    Math.ceil(Math.max(0, -minHour) / HOURS_PER_DAY) + 20,
  );

  // ---- progress -------------------------------------------------------------
  const dataDateHours = o.progress === 'none' ? 0
    : o.progress === 'full' ? computedFinish
      : Math.round(computedFinish * 0.4);
  applyProgress(tasks, o, dataDateHours);

  // ---- driving path ---------------------------------------------------------
  // The Longest Path, walked back over the logic that was just generated. NOT float:
  // `tf <= 0` is the conflation xer-format.md warns about and 014 decision 4 rejects.
  const drivingPath = traceDrivingPath(tasks, dataDateHours, cal);
  if (o.externalDrivingPred) externaliseChainTail(tasks, drivingPath.truth);
  const emitTasks = tasks.filter((t) => !t.external);
  drivingPath.readable = traceReadable(tasks, drivingPath, dataDateHours);
  drivingPath.causes = divergenceCauses(tasks, drivingPath);
  for (const t of tasks) t.driving = drivingPath.truth.memberIdx.has(t.idx);
  drivingPath.floatBased = floatBasedDifference(tasks, drivingPath.truth);
  if (o.floatPaths) drivingPath.floatPaths = assignFloatPaths(tasks, drivingPath.truth, o.floatPaths);

  // ---- codes, resources, UDFs ----------------------------------------------
  const actvTypes = CODE_TYPES.slice(0, Math.min(CODE_TYPES.length, 12)).map((t, i) => ({
    actv_code_type_id: 1400 + i,
    actv_code_type: t.name,
    seq_num: (i + 1) * 10,
    actv_short_len: 12,
  }));
  const actvCodes = [];
  let codeId = 8000;
  CODE_TYPES.slice(0, actvTypes.length).forEach((t, ti) => {
    t.values.forEach((v, vi) => {
      actvCodes.push({
        actv_code_id: codeId++,
        actv_code_type_id: actvTypes[ti].actv_code_type_id,
        short_name: v,
        actv_code_name: `${t.name} ${v}`,
        seq_num: (vi + 1) * 10,
      });
    });
  });
  const codesByType = new Map();
  for (const c of actvCodes) {
    if (!codesByType.has(c.actv_code_type_id)) codesByType.set(c.actv_code_type_id, []);
    codesByType.get(c.actv_code_type_id).push(c);
  }

  // TASKACTV is the biggest table in a real file and its density is the single
  // biggest lever on file size — ~14 assignments per activity on Fixture A, ~6.1 on
  // Fixture B. Spread the requested total evenly across the code types.
  const taskactv = [];
  const perType = Math.floor(o.codesPerActivity / actvTypes.length);
  const spare = o.codesPerActivity - perType * actvTypes.length;
  for (const t of emitTasks) {
    actvTypes.forEach((type, i) => {
      const n = perType + (i < spare ? 1 : 0);
      const values = codesByType.get(type.actv_code_type_id);
      for (let k = 0; k < n; k++) {
        taskactv.push({
          task_id: t.task_id,
          actv_code_type_id: type.actv_code_type_id,
          actv_code_id: r.pick(values).actv_code_id,
          proj_id: t.proj_id,
        });
      }
    });
  }

  const resources = [];
  for (let i = 0; i < o.resources; i++) {
    resources.push({
      rsrc_id: 7000 + i,
      rsrc_short_name: `R${String(i + 1).padStart(3, '0')}`,
      rsrc_name: `${r.pick(['Gang', 'Crew', 'Plant', 'Team'])} ${i + 1}`,
      rsrc_type: r.weighted([['RT_Labor', 80], ['RT_Equip', 15], ['RT_Mat', 5]]),
    });
  }

  const taskrsrc = [];
  let assignId = 600000;
  for (const t of emitTasks) {
    const n = Math.round(o.rsrcPerActivity) + (r.chance(o.rsrcPerActivity % 1) ? 1 : 0);
    for (let i = 0; i < n; i++) {
      if (t.task_type !== 'TT_Task') break;       // milestones carry no work
      const rs = resources[r.int(0, resources.length - 1)];
      const qty = Math.max(1, Math.round((t.dur / HOURS_PER_DAY) * r.int(1, 6)));
      taskrsrc.push({ taskrsrc_id: assignId++, task: t, rsrc: rs, qty });
    }
  }

  const udfTypes = [
    { udf_type_id: 800, table_name: 'PROJECT', udf_type_name: 'user_field_800', udf_type_label: 'Comments', logical_data_type: 'FT_TEXT' },
    { udf_type_id: 801, table_name: 'TASK', udf_type_name: 'user_field_801', udf_type_label: 'Work Package Ref', logical_data_type: 'FT_TEXT' },
    { udf_type_id: 802, table_name: 'TASK', udf_type_name: 'user_field_802', udf_type_label: 'Earned Value %', logical_data_type: 'FT_FLOAT_2_DECIMALS' },
    { udf_type_id: 803, table_name: 'TASK', udf_type_name: 'user_field_803', udf_type_label: 'Planned Handover', logical_data_type: 'FT_END_DATE' },
    { udf_type_id: 804, table_name: 'TASK', udf_type_name: 'user_field_804', udf_type_label: 'Sub-contractor', logical_data_type: 'FT_TEXT' },
  ];
  const udfValues = [];
  const taskUdfs = udfTypes.filter((u) => u.table_name === 'TASK');
  for (const t of emitTasks) {
    for (let i = 0; i < Math.min(taskUdfs.length, o.udfPerActivity); i++) {
      const u = taskUdfs[i];
      udfValues.push({ udf: u, task: t, r });
    }
  }

  return {
    opts: o, r, projId, cal, calendars, wbs, leaves, tasks, emitTasks, preds, taskactv,
    resources, taskrsrc, actvTypes, actvCodes, udfTypes, udfValues,
    drivingPath,
    dataDateHours,
    computedFinish,
    deadline,
    startDate: o.startDate,
  };
}

function lagFor(r, o) {
  if (r.chance(o.leadPct)) return -r.int(1, 10) * HOURS_PER_DAY;   // DCMA-2: leads
  if (r.chance(o.lagPct)) return r.int(1, 20) * HOURS_PER_DAY;     // DCMA-3: lags
  return 0;
}

/**
 * The relationships that drive an activity: the ones demanding the latest start,
 * ties all kept. Argmax rather than equality-with-ES on purpose — on a coherent
 * schedule the two are the same thing, but a cyclic network's dates are incoherent
 * by definition and only argmax is still defined there. Completed predecessors are
 * excluded: the Longest Path spans remaining work (014 decision 3).
 */
function drivingRelsOf(t, tasks) {
  const live = t.preds.filter((rel) => tasks[rel.pred].status_code !== 'TK_Complete');
  if (live.length === 0) return [];
  const values = live.map((rel) => earlyStartCandidate(rel, t, tasks));
  const best = Math.max(...values);
  if (best < t.es) return [];        // held by a constraint or the project start, not by logic
  return live.filter((_, i) => values[i] === best);
}

/** What a relationship demands of its successor's early start, in working hours. */
function earlyStartCandidate(rel, succ, tasks) {
  const p = tasks[rel.pred];
  if (rel.type === 'PR_FS') return p.ef + rel.lag;
  if (rel.type === 'PR_SS') return p.es + rel.lag;
  if (rel.type === 'PR_FF') return p.ef + rel.lag - succ.dur;
  return p.es + rel.lag - succ.dur;               // PR_SF
}

function forwardPass(tasks) {
  // Seeded once so a BACK edge (injectCycle) reads a stale number rather than
  // undefined, and never re-seeded, so a second pass over a cyclic network propagates
  // the loop instead of erasing it. Invisible on an acyclic network, where every
  // predecessor has a lower index and is already final when its successor reads it.
  for (const t of tasks) { if (t.es === undefined) { t.es = 0; t.ef = t.dur; } }
  for (const t of tasks) {
    let es = 0;
    for (const rel of t.preds) es = Math.max(es, earlyStartCandidate(rel, t, tasks));
    t.es = Math.max(0, es);
    t.ef = t.es + t.dur;
  }
}

function backwardPass(tasks, projectFinish) {
  for (const t of tasks) { t.lf = projectFinish; t.ls = projectFinish - t.dur; }
  for (let i = tasks.length - 1; i >= 0; i--) {
    const t = tasks[i];
    // A Finish On or Before constraint caps the late finish ahead of the project
    // deadline, so total float is measured against the nearest BINDING late date
    // rather than against the finish. It is the only constraint this backward pass
    // honours — the randomly sprinkled `cstr_type` values have always been decorative,
    // and making them bite would move every other fixture's dates. `setInterimDeadline`
    // plants exactly one, on a chain chosen so it cannot reach the Longest Path.
    let lf = t.lateLimit ?? projectFinish;
    for (const rel of t.succs) {
      const s = tasks[rel.succ];
      let candidate;
      if (rel.type === 'PR_FS') candidate = s.ls - rel.lag;
      else if (rel.type === 'PR_SS') candidate = s.ls - rel.lag + t.dur;
      else if (rel.type === 'PR_FF') candidate = s.lf - rel.lag;
      else candidate = s.lf - rel.lag + t.dur;    // PR_SF
      lf = Math.min(lf, candidate);
    }
    t.lf = lf;
    t.ls = t.lf - t.dur;
    t.tf = t.ls - t.es;
    // Free float: how far this activity can slip before it moves a successor, taken
    // over every successor and clamped at zero. The slack is measured in the
    // relationship's OWN frame — the same per-type correction 028 made to the driving
    // test, for the same reason: `succ.es - t.ef` is the quantity an FS relationship
    // constrains and nothing else does. An SS successor is held off this activity's
    // START, and FF/SF hold the successor's FINISH.
    //
    //   PR_FS  succ.es - t.ef - lag      PR_FF  succ.ef - t.ef - lag
    //   PR_SS  succ.es - t.es - lag      PR_SF  succ.ef - t.es - lag
    //
    // Wrong here is worse than wrong elsewhere in this file: 014 decision 4 reads
    // `free_float_hr_cnt == 0` as corroboration of a driving relationship, and the
    // clamp turns an under-computed slack into a spurious zero that reads as
    // "driving" — the error hides in exactly the direction that looks correct.
    t.ff = t.succs.length === 0 ? t.tf
      : Math.max(0, Math.min(...t.succs.map((rel) => freeSlack(rel, t, tasks))));
  }
}

/** The slack this relationship leaves its predecessor, in the frame it constrains. */
function freeSlack(rel, t, tasks) {
  const s = tasks[rel.succ];
  if (rel.type === 'PR_FS') return s.es - t.ef - rel.lag;
  if (rel.type === 'PR_SS') return s.es - t.es - rel.lag;
  if (rel.type === 'PR_FF') return s.ef - t.ef - rel.lag;
  return s.ef - t.es - rel.lag;                     // PR_SF
}

// ---- the driving path -------------------------------------------------------

/**
 * Walk the Longest Path back from a set of seeds, following whatever `driversOf`
 * says is driving. Iterative on purpose: a driving chain through the
 * 20,000-activity perf fixture is thousands deep and a recursive walk overflows.
 *
 * Grey/black colouring, so a back edge is reported as a cycle rather than followed
 * forever — 014 decision 5 gets its `cycle_count` out of the walk it needed anyway.
 */
function walkDriving(tasks, seeds, driversOf) {
  const WHITE = 0; const GREY = 1; const BLACK = 2;
  const colour = new Map();
  const memberIdx = new Set();
  const branches = [];
  const cycles = [];
  const tails = [];
  const path = [];
  let truncated = false;

  for (const seed of seeds) {
    const stack = [{ idx: seed.idx, drivers: null, i: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      if (frame.drivers === null) {
        const c = colour.get(frame.idx) ?? WHITE;
        if (c === GREY) {
          cycles.push([...path.slice(path.indexOf(frame.idx)), frame.idx]);
          stack.pop();
          continue;
        }
        if (c === BLACK) { stack.pop(); continue; }
        colour.set(frame.idx, GREY);
        path.push(frame.idx);
        memberIdx.add(frame.idx);
        const t = tasks[frame.idx];
        const found = driversOf(t);
        truncated = truncated || found.truncated;
        frame.drivers = found.rels;
        if (found.rels.length === 0) tails.push(t);
        else if (found.rels.length > 1) {
          branches.push({ task: t, drivers: found.rels.map((rel) => tasks[rel.pred]) });
        }
      }
      if (frame.i < frame.drivers.length) {
        stack.push({ idx: frame.drivers[frame.i++].pred, drivers: null, i: 0 });
        continue;
      }
      colour.set(frame.idx, BLACK);
      path.pop();
      stack.pop();
    }
  }
  return { memberIdx, branches, cycles, tails, truncated };
}

/**
 * The Longest Path, twice.
 *
 * `truth` is the generator's own answer over its own logic — exact, calendar-aware
 * by construction, and what `driving_path_flag` is written from. It is emphatically
 * not `tf <= 0`: minimum float is the conflation `xer-format.md` warns about and
 * [014](../../../docs/wayfinder/tickets/014-compute-critical-path.md) decision 4
 * rejects.
 *
 * `readable` is what a tracer built to 014 decision 4 **as amended by 028** can
 * arrive at **from the bytes of this file alone** — the emitted timestamps compared
 * per relationship type with the same-kind zero-lag floor, lag treated as elapsed
 * hours, relationships that are not in the file simply absent, predecessors outside
 * the file unresolvable. Where the two differ, the difference is the approximation
 * 014 accepted, measured rather than argued: this is the corpus's own version of the
 * recall/precision figure 014's ship gate wants from Fixture A.
 *
 * Per 014 decision 3 both span **remaining work as of the data date**, walked back
 * from the latest remaining finish, with ties all kept because paths branch.
 */
function traceDrivingPath(tasks, dataDateHours, cal) {
  const remaining = tasks.filter((t) => t.status_code !== 'TK_Complete');
  const grounded = (t) => t.status_code === 'TK_Active' || t.es <= dataDateHours
    || t.preds.some((rel) => tasks[rel.pred].status_code === 'TK_Complete');
  const finish = (walk, seeds) => ({
    state: walk.cycles.length ? 'error' : 'ok',
    seeds,
    external: [],
    ...walk,
    continuous: walk.cycles.length === 0 && !walk.truncated && walk.tails.every(grounded),
  });
  const empty = () => ({
    state: 'skip',
    reason: 'no remaining work at the data date',
    seeds: [],
    external: [],
    memberIdx: new Set(),
    branches: [],
    cycles: [],
    tails: [],
    truncated: false,
    continuous: null,
  });
  if (remaining.length === 0) return { truth: empty(), readable: empty() };

  const maxEf = remaining.reduce((m, t) => Math.max(m, t.ef), -Infinity);
  const truth = finish(
    walkDriving(tasks, remaining.filter((t) => t.ef === maxEf),
      (t) => ({ rels: drivingRelsOf(t, tasks), truncated: false })),
    remaining.filter((t) => t.ef === maxEf),
  );
  return { truth, readable: null, remaining, cal };
}

/**
 * The second half of the trace: what the FILE can tell a reader. Run after any
 * activity has been moved out of the file, because that is one of the things a
 * reader cannot see.
 */
function makeReadableDrivers(tasks, cal) {
  // Exactly the instants this file writes into early_start_date and
  // early_end_date / reend_date — the same two functions the emitter calls, rather than
  // a second copy of the rule. Keeping two copies is how the milestone instant stayed
  // wrong from 022 to 049: `lib/tables.mjs`'s `inst` and this pair had to be edited
  // together and nothing said so.
  const startInstant = (t) => rowStart(cal, t.dur, t.es).getTime();
  const finishInstant = (t) => rowFinish(cal, t.dur, t.ef).getTime();
  // A zero-duration row writes one instant for both of its dates, and says so in the row
  // it emits: early_start_date == early_end_date. That is the one thing that stops an
  // FF pair being like-for-like, and it is visible to a reader.
  const milestoneRow = (t) => startInstant(t) === finishInstant(t);

  // 014 decision 4 as amended by 028: the quantity compared is the one the
  // relationship TYPE constrains, measured against the successor timestamp it
  // constrains. Still calendar-free — every value is an instant this file already
  // carries — and on an all-FS successor the reference is a constant that cancels,
  // so this reduces to decision 4 as originally written.
  //
  //   PR_FS  pred.early_end_date   + lag  vs  succ.early_start_date
  //   PR_SS  pred.early_start_date + lag  vs  succ.early_start_date
  //   PR_FF  pred.early_end_date   + lag  vs  succ.early_end_date
  //   PR_SF  pred.early_start_date + lag  vs  succ.early_end_date
  const startAnchored = (rel) => rel.type === 'PR_SS' || rel.type === 'PR_SF';
  const finishReferenced = (rel) => rel.type === 'PR_FF' || rel.type === 'PR_SF';
  const demand = (rel) => {
    const p = tasks[rel.pred];
    return (startAnchored(rel) ? startInstant(p) : finishInstant(p)) + rel.lag * 3600000;
  };
  const reference = (rel, succ) => (finishReferenced(rel)
    ? finishInstant(succ) : startInstant(succ));

  // The comparison a type makes, as a pair of instant kinds. Two candidates on one
  // successor order the same way in elapsed time as they do in working time only
  // when they make the SAME comparison: a finish instant and the start instant that
  // follows it are one working moment written two different ways, with a weekend
  // possibly between them. Used to score, and used to explain a disagreement.
  const comparisonKind = (rel) => `${startAnchored(rel) ? 'start' : 'finish'}`
    + `-vs-${finishReferenced(rel) ? 'finish' : 'start'}`;
  // Demand and reference are the same KIND of instant for PR_SS (start against
  // start) and PR_FF (finish against finish) — and for PR_FF only while the pair is
  // like-for-like, which a milestone on exactly one side breaks.
  //
  // 049 removed what broke it: a milestone's finish is now a finish like every other
  // row's, so two finish instants order exactly as their working hours do and the
  // exclusion has nothing left to protect against. It is left standing because the rule
  // it implements is 028's to change, not this file's — and because it has still never
  // executed: 25 PR_FF relationships in the corpus, one with a milestone on a side, on
  // an activity no walk reaches, and removing the clause regenerates byte-identical.
  const sameKind = (rel, succ) => rel.type === 'PR_SS'
    || (rel.type === 'PR_FF' && milestoneRow(tasks[rel.pred]) === milestoneRow(succ));

  const driversOf = (t) => {
    const visible = t.preds.filter((rel) => !rel.hidden);
    const live = visible.filter((rel) => tasks[rel.pred].status_code !== 'TK_Complete');
    const resolvable = live.filter((rel) => !rel.external && !tasks[rel.pred].external);
    const truncated = resolvable.length !== live.length;
    // The floor (028). Where the comparison is exact — same kind of instant, no lag
    // — a candidate demanding strictly less than what actually happened did not set
    // the date, so it is droppable rather than merely unlikely. Decision 4 rejected
    // equality because a zero-gap FS across a weekend does not match, which is a
    // real objection to FS and not to these. An empty pool means the activity is a
    // chain tail: held by a constraint or the project start rather than by logic,
    // which is exactly what the truth reports there.
    const pool = resolvable.filter((rel) => !(rel.lag === 0 && sameKind(rel, t)
      && demand(rel) < reference(rel, t)));
    if (pool.length === 0) return { rels: [], truncated };
    const scores = pool.map((rel) => demand(rel) - reference(rel, t));
    const best = Math.max(...scores);
    return { rels: pool.filter((_, i) => scores[i] === best), truncated };
  };
  return { driversOf, finishInstant, comparisonKind };
}

/**
 * The fifth cause (042): the two walks can disagree about where the walk STARTS.
 *
 * Both walks span remaining work back from the latest remaining finish (014 decision
 * 3), but they read "latest" on different scales. The truth takes the maximum `ef` in
 * **working hours**; a reader has only the emitted timestamps, so the readable rule
 * takes the maximum `finishInstant` in **elapsed** time. Those pick different
 * activities whenever activities sharing one working-hour finish write it as different
 * wall-clock instants.
 *
 * Nothing inside the walk can explain this. `divergenceCauses` compares driving
 * predecessor sets activity by activity, so every activity both walks reach can agree
 * on its drivers while the membership sets differ — a non-empty `misses` beside
 * `why: []`, which is the corpus's central honesty claim being false.
 *
 * **It has no corpus instance, and this generator can no longer produce one (049).** The
 * thing that used to write one working moment as two wall-clock instants was our own
 * emitter: a zero-duration row's finish went out as the *start* of its working hour, so
 * a finish milestone sat one non-working gap above the tasks it finished with. P6 does
 * the opposite (`lib/calendar.mjs`), and now so does this. Every row's emitted finish is
 * `rowFinish`, which is strictly increasing in the working hour, so the two argmaxes are
 * the same set — checked over 7,388 ordered pairs of remaining rows across the 27
 * programme fixtures, 0 disagreements. The corpus still carries the two mixed ties 042
 * found; they tie **exactly**, as 47 of 47 real ties do (044).
 *
 * The function stays for the reason 031's milestone guard stays: it is right, and it is
 * the only thing standing between a future emitter change and a silent bare `misses`
 * list. Regenerating with it disabled produces byte-identical goldens, which is the
 * honest statement of how much the corpus currently exercises it — none.
 *
 * Returns idx -> cause string, for the activities seeded by one walk and not the other.
 */
function seedDisagreement(dp) {
  const physics = 'the truth seeds on the latest remaining finish measured in working '
    + 'hours and the readable rule on the latest emitted finish instant, which is 014 '
    + 'decision 4\'s elapsed-hours residue arriving at the START of the walk (014 '
    + 'decision 3) rather than inside it';
  const truthSeeds = new Set(dp.truth.seeds.map((t) => t.idx));
  const readSeeds = new Set(dp.readable.seeds.map((t) => t.idx));
  const out = new Map();
  for (const idx of new Set([...truthSeeds, ...readSeeds])) {
    if (truthSeeds.has(idx) === readSeeds.has(idx)) continue;
    out.set(idx, `the two walks seed differently and ${truthSeeds.has(idx)
      ? 'only the truth starts here' : 'only the readable rule starts here'}: ${physics}`);
  }
  return out;
}

/**
 * Why the two walks disagree, per activity. The corpus's job here is to STATE the
 * approximation rather than tune it away, so every cause is named and none is fixed.
 */
function divergenceCauses(tasks, dp) {
  const { driversOf, comparisonKind } = makeReadableDrivers(tasks, dp.cal);
  const out = [];
  const seeds = seedDisagreement(dp);
  const union = [...new Set([...dp.truth.memberIdx, ...dp.readable.memberIdx, ...seeds.keys()])]
    .sort((a, b) => a - b);
  for (const idx of union) {
    const t = tasks[idx];
    if (t.external) continue;
    const truth = drivingRelsOf(t, tasks);
    const read = driversOf(t).rels;
    const same = truth.length === read.length && truth.every((rel) => read.includes(rel));
    if (same && !seeds.has(idx)) continue;
    const involved = [...new Set([...truth, ...read])];
    // Relationship TYPE is no longer a cause: the rule compares per type, so a type
    // it handles cannot explain a disagreement. What survives of it is the anchor
    // KIND — an FS or SF candidate scored beside an SS or FF one puts a finish
    // instant and a start instant on the same scale, which is 014 decision 4's
    // elapsed-hours residue arriving without a lag to carry it (028).
    const mixedAnchors = new Set(involved.map(comparisonKind)).size > 1;
    const driverCause = truth.some((rel) => rel.hidden) ? 'the relationship is not in the file'
      : truth.some((rel) => rel.external || tasks[rel.pred].external)
        ? 'the driving predecessor is outside the file'
        : involved.some((rel) => rel.lag !== 0)
          ? 'lag treated as elapsed hours across non-working time (014 decision 4)'
          : mixedAnchors
            ? 'mixed anchor kinds on one successor: a finish instant scored against a '
              + 'start instant, which is 014 decision 4\'s elapsed-hours residue on a '
              + 'zero-lag relationship (028)'
            : 'timestamps order two simultaneous events differently from working time';
    // A seed disagreement decides whether the walk reaches this activity at all, so it
    // outranks any disagreement about which predecessor drives it (042).
    const cause = seeds.get(idx) ?? driverCause;
    out.push({
      task_code: t.task_code,
      driving: truth.map((rel) => (tasks[rel.pred].external || rel.external
        ? 'outside the file' : tasks[rel.pred].task_code)).sort(),
      read_as_driving: read.map((rel) => tasks[rel.pred].task_code).sort(),
      cause,
    });
  }
  return out;
}

function traceReadable(tasks, drivingPath, dataDateHours) {
  if (drivingPath.truth.state === 'skip') return drivingPath.truth;
  const { cal, remaining } = drivingPath;
  const { driversOf, finishInstant } = makeReadableDrivers(tasks, cal);

  const latest = remaining.reduce((m, t) => Math.max(m, finishInstant(t)), -Infinity);
  const seeds = remaining.filter((t) => finishInstant(t) === latest);
  const walk = walkDriving(tasks, seeds, driversOf);
  const grounded = (t) => t.status_code === 'TK_Active' || t.es <= dataDateHours
    || t.preds.some((rel) => !rel.hidden && tasks[rel.pred].status_code === 'TK_Complete');
  return {
    state: walk.cycles.length ? 'error' : 'ok',
    seeds,
    external: drivingPath.truth.external,
    ...walk,
    continuous: walk.cycles.length === 0 && !walk.truncated && walk.tails.every(grounded),
  };
}

/**
 * Guarantee `n` activities whose driving predecessor is not unique.
 *
 * Ties are made by lengthening the runner-up predecessor, never by adding lag: a lag
 * here would drag the calendar approximation into a fixture whose landmine is
 * branching, and one landmine per file is the corpus's whole discipline.
 */
function forceDrivingBranches(tasks, n) {
  let made = 0;
  const done = new Set();
  for (let attempt = 0; attempt < 60 && made < n; attempt++) {
    const chain = drivingChainIdx(tasks);
    const targets = [...chain]
      .map((i) => tasks[i])
      .filter((t) => !done.has(t.idx) && t.preds.length > 1
        && t.preds.filter((rel) => earlyStartCandidate(rel, t, tasks) === t.es).length === 1)
      .sort((a, b) => b.ef - a.ef || a.idx - b.idx);
    if (targets.length === 0) break;
    let widened = false;
    for (const target of targets) {
      const runnerUp = target.preds
        .map((rel) => ({ rel, value: earlyStartCandidate(rel, target, tasks) }))
        .sort((a, b) => b.value - a.value)[1];
      const p = tasks[runnerUp.rel.pred];
      const gap = target.es - runnerUp.value;
      if (p.dur === 0 || gap <= 0) { done.add(target.idx); continue; }  // never stretch a milestone
      p.dur += gap;
      forwardPass(tasks);
      done.add(target.idx);
      made++;
      widened = true;
      break;
    }
    if (!widened) break;
  }
  return made;
}

/**
 * Add `n` back edges, producing a network P6 could never have scheduled.
 *
 * The edge is planted ON the driving chain — tail back to the finish — so the walk
 * has to meet it rather than merely coexist with it. The CPM that follows is left
 * deliberately incoherent: a cyclic file is one that was never successfully
 * scheduled, and pretending otherwise would hide the landmine.
 */
function injectCycles(tasks, preds, n, firstPredId) {
  const chain = [...drivingChainIdx(tasks)].sort((a, b) => a - b);
  for (let i = 0; i < n && i < chain.length; i++) {
    const succ = tasks[chain[i]];
    const pred = tasks[chain[chain.length - 1 - i]];
    if (pred.idx <= succ.idx) break;
    const rel = { task_pred_id: firstPredId + i, succ: succ.idx, pred: pred.idx, type: 'PR_FS', lag: 0 };
    preds.push(rel);
    succ.preds.push(rel);
    pred.succs.push(rel);
  }
  forwardPass(tasks);
}

/**
 * A contractual deadline part-way through the programme, on a chain that does **not**
 * drive the project finish.
 *
 * This is the shape that pulls P6's two marks apart in a real file, and without it
 * they cannot be told apart at all. Total float is measured against the nearest
 * **binding** late date; the Longest Path is the logic driving the project **finish**.
 * Where an interim milestone is in delay, the chain feeding it carries the lowest
 * total float in the file while the finish is driven by another chain entirely — which
 * is why 021 found path 1 and `driving_path_flag = Y` sharing no member.
 *
 * The target is chosen so the tightening cannot reach the Longest Path. A late
 * constraint propagates backwards, and only along **driving** logic: a predecessor
 * with slack in front of it keeps strictly more float than its successor
 * (`tf(pred) <= succ.ls - pred.ef = succ.tf + (succ.es - pred.ef)`, and the bracket is
 * positive precisely when the relationship is not driving). So the minimum float this
 * deadline creates is confined to the target's **driving** ancestors, and it is that
 * set — not the whole ancestry — which must not touch the driving chain. Among the
 * candidates the longest chain wins: a path of two activities states nothing about
 * order, which is the one thing this oracle is for.
 */
function setInterimDeadline(tasks, days) {
  const driving = drivingChainIdx(tasks);
  const driversOf = (t) => t.preds
    .filter((rel) => earlyStartCandidate(rel, t, tasks) === t.es)
    .map((rel) => tasks[rel.pred]);
  const drivingAncestorsOf = (t) => {
    const out = new Set();
    const queue = [t];
    while (queue.length) {
      for (const p of driversOf(queue.pop())) {
        if (out.has(p.idx)) continue;
        out.add(p.idx);
        queue.push(p);
      }
    }
    return out;
  };
  // The same greedy walk `assignFloatPaths` will make, and it needs the same
  // tie-break: every driver of a minimum-float activity is itself at the minimum, so
  // float cannot separate them and the order of the file decides.
  const chainOf = (t) => {
    const out = [];
    let cursor = t;
    while (cursor && !out.includes(cursor.idx)) {
      out.push(cursor.idx);
      cursor = driversOf(cursor).sort((a, b) => b.ef - a.ef || a.idx - b.idx)[0];
    }
    return out;
  };
  const target = tasks
    .filter((t) => !driving.has(t.idx) && t.dur > 0)
    .map((t) => ({ t, anc: drivingAncestorsOf(t), chain: chainOf(t) }))
    .filter(({ anc }) => ![...anc].some((i) => driving.has(i)))
    .sort((a, b) => b.chain.length - a.chain.length || b.anc.size - a.anc.size
      || b.t.ef - a.t.ef || a.t.idx - b.t.idx)[0];
  if (!target || target.chain.length < 2) return null;
  // Finish On or Before — the soft late constraint that manufactures negative float
  // in a real programme. Whatever the random constraint pass put here is overwritten:
  // this activity's constraint is the point of the file.
  target.t.cstr_type = 'CS_MEOB';
  target.t.lateLimit = target.t.ef - days * HOURS_PER_DAY;
  return target.t;
}

/** The driving chain as indices, over every activity — used before progress exists. */
function drivingChainIdx(tasks) {
  const finish = tasks.reduce((m, t) => Math.max(m, t.ef), -Infinity);
  const out = new Set();
  const queue = tasks.filter((t) => t.ef === finish).map((t) => t.idx);
  while (queue.length) {
    const idx = queue.pop();
    if (out.has(idx)) continue;
    out.add(idx);
    const t = tasks[idx];
    for (const rel of t.preds) {
      if (earlyStartCandidate(rel, t, tasks) === t.es && rel.pred < idx) queue.push(rel.pred);
    }
  }
  return out;
}

/**
 * Move the chain's tail out of the file: the logic that drives this programme starts
 * in another project. The activity stays in the MODEL — the generator knows exactly
 * what it was and what it drove — and is simply never emitted, which is what a real
 * external relationship looks like from inside a single-project export.
 */
function externaliseChainTail(tasks, drivingPath) {
  const members = [...drivingPath.memberIdx].sort((a, b) => a - b);
  if (members.length < 2) return;
  const tail = tasks[members[0]];
  tail.external = true;
  tail.task_id = EXTERNAL_TASK_ID;
  tail.proj_id = EXTERNAL_PROJ_ID;
  drivingPath.memberIdx.delete(tail.idx);
  drivingPath.truncated = true;
  drivingPath.external = [tail];
  drivingPath.tails = drivingPath.tails.filter((t) => t !== tail);
}

/** How a `tf <= 0` tracer would differ. The point of the whole exercise. */
function floatBasedDifference(tasks, drivingPath) {
  const emitted = tasks.filter((t) => !t.external);
  const floatSet = new Set(emitted.filter((t) => !t.floatNull && t.tf <= 0).map((t) => t.idx));
  const extra = emitted.filter((t) => floatSet.has(t.idx) && !drivingPath.memberIdx.has(t.idx));
  const missing = emitted.filter((t) => !floatSet.has(t.idx) && drivingPath.memberIdx.has(t.idx));
  return { count: floatSet.size, extra, missing };
}

/**
 * P6's Multiple Float Paths, ranked by total float.
 *
 * MEASURED, not guessed — 021 found the output on a real export
 * ([the validation asset](../../../docs/wayfinder/tickets/assets/p6-substitute-validation.md)
 * §4) and 039 rebuilt this function onto it. Half of the old speculative reading was
 * right and half was flatly wrong:
 *
 * - **Order — confirmed.** `float_path_order` runs **1..n contiguously** along a
 *   path. That is the whole of what this second oracle validates.
 * - **Membership — refuted.** Path 1 is *not* the driving chain. It is the
 *   **lowest-total-float** chain: in that file its 79 members were 79 of the 86
 *   activities sitting at the file's minimum total float, and it shared **no member
 *   at all** with the 75 activities P6 flagged `driving_path_flag = Y`, whose float
 *   ran −862 to −502.
 *
 * Each path is a real chain of driving relationships, taken lowest float first: seed
 * on the lowest-float unassigned activity, walk back through the predecessors that
 * set its early start, number the members 1..n from the earliest. Walking the drivers
 * is what keeps a path at its seed's float — a driving predecessor's late finish is
 * capped by its successor's late start, so it cannot carry more float than a
 * successor already sitting at the minimum.
 *
 * The returned block is the golden's statement of all this, including the one
 * assertion the fixture exists for: `shared_with_driving_path` is empty.
 */
function assignFloatPaths(tasks, drivingPath, count) {
  const assigned = new Set();
  // Float paths are drawn from the activities that HAVE float: completed work carries
  // an empty total float in a real file, and P6 puts none of it on a float path.
  const pool = tasks.filter((t) => !t.external && !t.floatNull);
  const byFloat = (a, b) => a.tf - b.tf || b.ef - a.ef || a.idx - b.idx;
  const driversOf = (t) => t.preds
    .filter((rel) => earlyStartCandidate(rel, t, tasks) === t.es)
    .map((rel) => tasks[rel.pred])
    .filter((p) => !p.external && !p.floatNull && !assigned.has(p.idx))
    .sort(byFloat);

  const paths = [];
  for (let n = 1; n <= count; n++) {
    const head = pool.filter((t) => !assigned.has(t.idx)).sort(byFloat)[0];
    if (!head) break;
    const chain = [];
    for (let cursor = head; cursor; cursor = driversOf(cursor)[0]) {
      assigned.add(cursor.idx);
      chain.push(cursor);
    }
    chain.reverse();
    chain.forEach((t, i) => { t.floatPath = n; t.floatPathOrder = i + 1; });
    paths.push({
      float_path: n,
      total_float_hr: head.tf,
      member_count: chain.length,
      // In `float_path_order`, 1..n — the ordering this oracle exists to validate.
      members: chain.map((t) => t.task_code),
    });
  }

  const drivingCodes = tasks
    .filter((t) => !t.external && drivingPath.memberIdx.has(t.idx))
    .map((t) => t.task_code).sort();
  const path1 = paths[0]?.members ?? [];
  return {
    note: 'P6\'s Multiple Float Paths output. Path 1 is the LOWEST-TOTAL-FLOAT chain, '
      + 'not the driving path: on the real export 021 measured, path 1 and '
      + 'driving_path_flag = Y shared no member at all. float_path validates ORDER '
      + 'and must never be read as membership of the Longest Path (014 decision 11, '
      + 'restated by 039)',
    ranked_by: 'total_float_hr_cnt ascending; each path is a chain of driving '
      + 'relationships walked back from its seed and numbered 1..n from its earliest '
      + 'member',
    path_count: paths.length,
    unassigned_count: pool.filter((t) => !assigned.has(t.idx)).length,
    order_contiguous: paths.every((p) => p.members
      .every((_, i) => tasks.find((t) => t.task_code === p.members[i]).floatPathOrder === i + 1)),
    paths,
    // The assertion. Two marks that share nothing, in one file, so a tracer that
    // conflates them scores 0% recall and 0% precision rather than merely drifting.
    path_1: [...path1].sort(),
    driving_path_members: drivingCodes,
    shared_with_driving_path: path1.filter((c) => drivingCodes.includes(c)).sort(),
  };
}

function applyProgress(tasks, o, dataDateHours) {
  for (const t of tasks) {
    if (o.progress === 'none') {
      t.status_code = 'TK_NotStart';
      t.phys_complete_pct = 0;
      t.remain = t.dur;
      continue;
    }
    if (t.ef <= dataDateHours) {
      t.status_code = 'TK_Complete';
      t.phys_complete_pct = 100;
      t.remain = 0;
      t.act_start = t.es;
      t.act_end = t.ef;
      // Float is ABSENT on completed work in real files — empty is not zero.
      t.floatNull = true;
    } else if (t.es < dataDateHours) {
      t.status_code = 'TK_Active';
      const done = (dataDateHours - t.es) / Math.max(t.dur, 1);
      t.phys_complete_pct = Math.round(done * 100);
      t.remain = Math.max(0, t.ef - dataDateHours);
      t.act_start = t.es;
    } else {
      t.status_code = 'TK_NotStart';
      t.phys_complete_pct = 0;
      t.remain = t.dur;
    }
  }
}

function buildWbs(o, projId, r) {
  const nodes = [];
  let wbsId = 100000;
  const root = {
    wbs_id: wbsId++, parent_wbs_id: '', proj_id: projId, proj_node_flag: 'Y',
    wbs_short_name: 'PRJ', wbs_name: 'Synthetic Programme', seq_num: 0, depth: 1,
  };
  nodes.push(root);
  if (o.wbsNodes <= 1) return nodes;

  let frontier = [root];
  let created = 1;
  let depth = 2;
  while (created < o.wbsNodes && depth <= o.wbsDepth) {
    const next = [];
    const perParent = Math.max(2, Math.ceil((o.wbsNodes - created) / frontier.length / (o.wbsDepth - depth + 1)));
    for (const parent of frontier) {
      for (let i = 0; i < perParent && created < o.wbsNodes; i++) {
        const node = {
          wbs_id: wbsId++,
          parent_wbs_id: parent.wbs_id,
          proj_id: projId,
          proj_node_flag: 'N',
          wbs_short_name: `${parent.wbs_short_name}.${i + 1}`,
          wbs_name: `${r.pick(WBS_WORDS)}`,
          seq_num: (i + 1) * 10,
          depth,
        };
        nodes.push(node);
        next.push(node);
        created++;
      }
    }
    if (next.length === 0) break;
    frontier = next;
    depth++;
  }
  return nodes;
}

/** Two fixed public holidays a year — enough to exercise exception serials. */
function holidaysBetween(startDate, years) {
  const y0 = Number(startDate.slice(0, 4));
  const out = [];
  for (let y = y0; y < y0 + years; y++) out.push(`${y}-01-01`, `${y}-12-25`);
  return out;
}

export { HOURS_PER_DAY, fmtDate, fmtDateTime };
