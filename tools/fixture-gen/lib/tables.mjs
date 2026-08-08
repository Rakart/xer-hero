// Model -> %R rows, per P6 version.
//
// Rows are emitted as {field_name: value} objects and the writer zips them against
// the version's %F contract, so a field that moved between 6.0 and 8.3 lands in the
// right column by construction — the same discipline the parser has to follow.

import { fmtDate, fmtDateTime, rowStart, rowFinish } from './calendar.mjs';
import { HOURS_PER_DAY } from './programme.mjs';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Ids for logic that points outside the file. Kept here as well as in programme.mjs
// because both the model and the writer have to agree on what "outside" looks like.
const EXTERNAL_PROJ_ID = 90099;
const EXTERNAL_TASK_ID = 999001;

/** Deterministic 22-char GUID in P6's base64-ish shape. */
function guid(r) {
  let s = '';
  for (let i = 0; i < 22; i++) s += B64[r.int(0, 63)];
  return s;
}

export function buildTables(model, { mojibake = false, currencies = ['USD'] } = {}) {
  const { opts: o, r, projId, cal, calendars, wbs, tasks, emitTasks, preds, taskactv,
    resources, taskrsrc, actvTypes, actvCodes, udfTypes, udfValues, dataDateHours,
    computedFinish, deadline } = model;

  const start = (h) => fmtDateTime(cal.startAt(h));
  const finish = (h) => fmtDateTime(cal.finishAt(h));
  // How a TASK row writes one of its own moments, as a start and as a finish. Both defer
  // to `lib/calendar.mjs`, which the readable walk defers to as well — this rule was
  // written out twice and drifted from P6 in both copies for six tickets (049).
  const startInst = (t, h) => fmtDateTime(rowStart(cal, t.dur, h));
  const inst = (t, h) => fmtDateTime(rowFinish(cal, t.dur, h));
  const dataDate = start(dataDateHours);

  const t = {};

  t.CURRTYPE = {
    name: 'CURRTYPE',
    rows: currencies.map((code, i) => ({
      curr_id: i + 1,
      decimal_digit_cnt: 2,
      curr_symbol: { USD: '$', GBP: '£', JPY: '¥', DKK: 'Ø' }[code] ?? '$',
      decimal_symbol: '.',
      digit_group_symbol: ',',
      pos_curr_fmt_type: '#1.1',
      neg_curr_fmt_type: '(#1.1)',
      curr_type: { USD: 'US Dollar', GBP: 'Pound Sterling', JPY: 'Japanese Yen', DKK: 'Danish Krone' }[code] ?? code,
      curr_short_name: code,
      group_digit_cnt: 3,
      base_exch_rate: 1,
    })),
  };

  t.OBS = {
    name: 'OBS',
    rows: [{ obs_id: 540, parent_obs_id: '', guid: guid(r), seq_num: 0, obs_name: 'Enterprise', obs_descr: '' }],
  };

  t.POBS = {
    name: 'POBS',
    rows: [
      { pobs_id: 100, pobs_parent_id: '', seq_num: 0, pobs_name: 'POBS_Root', pobs_descr: 'Performing Organization_Root', pobs_manager: '' },
      { pobs_id: 101, pobs_parent_id: 100, seq_num: 0, pobs_name: 'P', pobs_descr: 'Performing Organization', pobs_manager: '' },
      ...(mojibake ? mojibakePobs() : []),
    ],
  };

  t.UDFTYPE = {
    name: 'UDFTYPE',
    rows: udfTypes.map((u) => ({ ...u, super_flag: 'N', indicator_expression: '', summary_indicator_expression: '' })),
  };

  t.UMEASURE = {
    name: 'UMEASURE',
    rows: [
      { unit_id: 363, seq_num: 400, unit_abbrev: 'M3', unit_name: 'Cubic Meter' },
      { unit_id: 364, seq_num: 500, unit_abbrev: 'Ton', unit_name: 'Tonnage' },
    ],
  };

  const projectRow = (id, shortName, baselineOf) => ({
    proj_id: id,
    fy_start_month_num: 1,
    rsrc_self_add_flag: 'Y',
    allow_complete_flag: 'Y',
    rsrc_multi_assign_flag: 'Y',
    checkout_flag: 'N',
    project_flag: 'Y',
    step_complete_flag: 'N',
    cost_qty_recalc_flag: 'N',
    batch_sum_flag: 'Y',
    name_sep_char: '.',
    def_complete_pct_type: 'CP_Drtn',
    proj_short_name: shortName,
    clndr_id: calendars[0].clndr_id,
    sum_base_proj_id: baselineOf ?? '',
    task_code_base: 1000,
    task_code_step: 10,
    priority_num: 10,
    wbs_max_sum_level: 2,
    strgy_priority_num: 100,
    critical_drtn_hr_cnt: 0,
    def_cost_per_qty: '0.0000',
    last_recalc_date: dataDate,
    plan_start_date: start(0),
    plan_end_date: finish(deadline),
    scd_end_date: finish(computedFinish),
    add_date: start(0),
    def_duration_type: 'DT_FixedDUR2',
    task_code_prefix: 'A',
    guid: guid(r),
    def_qty_type: 'QT_Hour',
    add_by_name: 'admin',
    def_rate_type: 'COST_PER_QTY',
    add_act_remain_flag: 'Y',
    act_this_per_link_flag: 'Y',
    def_task_type: 'TT_Task',
    act_pct_link_flag: 'N',
    critical_path_type: 'CT_TotFloat',
    task_code_prefix_flag: 'Y',
    def_rollup_dates_flag: 'Y',
    use_project_baseline_flag: 'Y',
    rem_target_link_flag: 'Y',
    reset_planned_flag: 'Y',
    allow_neg_act_flag: 'N',
    sum_assign_level: 'SL_Taskrsrc',
    loaded_scope_level: 7,
    export_flag: 'Y',
    close_period_flag: '',
    trsrcsum_loaded: '',
  });

  const projectRows = [projectRow(projId, 'SYNTH-001')];
  for (let i = 0; i < o.extraProjectRows; i++) {
    // A baseline-bearing export carries several PROJECT rows under one owning
    // proj_id. 011 rejects multi-project on distinct TASK.proj_id precisely so this
    // shape stays legal.
    projectRows.push(projectRow(projId + 100 + i, `SYNTH-001-B${i + 1}`, projId));
  }
  if (o.projects > 1) projectRows.push(projectRow(projId + 1, 'SYNTH-002'));
  t.PROJECT = { name: 'PROJECT', rows: projectRows };

  t.CALENDAR = {
    name: 'CALENDAR',
    rows: calendars.map((c) => ({
      clndr_id: c.clndr_id,
      default_flag: c.default_flag,
      clndr_name: c.clndr_name,
      proj_id: c.clndr_type === 'CA_Project' ? projId : '',
      base_clndr_id: c.clndr_type === 'CA_Project' ? calendars[0].clndr_id : '',
      last_chng_date: start(0),
      clndr_type: c.clndr_type,
      day_hr_cnt: c.day_hr_cnt,
      week_hr_cnt: c.week_hr_cnt,
      month_hr_cnt: c.month_hr_cnt,
      year_hr_cnt: c.year_hr_cnt,
      rsrc_private: 'N',
      clndr_data: c.clndr_data,
    })),
  };

  t.SCHEDOPTIONS = {
    name: 'SCHEDOPTIONS',
    rows: [{
      schedoptions_id: 1,
      proj_id: projId,
      sched_outer_depend_type: 'SD_Both',
      sched_open_critical_flag: 'N',
      sched_lag_early_start_flag: 'Y',
      sched_retained_logic: 'Y',
      sched_setplantoforecast: 'N',
      sched_float_type: 'FT_FF',
      sched_calendar_on_relationship_lag: 'rcal_Predecessor',
      sched_use_expect_end_flag: 'Y',
      sched_progress_override: 'N',
      level_float_thrs_cnt: 0,
      level_outer_assign_flag: 'N',
      level_outer_assign_priority: 5,
      level_over_alloc_pct: 25,
      level_within_float_flag: 'N',
      level_keep_sched_date_flag: 'Y',
      level_all_rsrc_flag: 'Y',
      sched_use_project_end_date_for_float: 'Y',
      enable_multiple_longest_path_calc: o.longestPathFlag ? 'Y' : 'N',
      limit_multiple_longest_path_calc: 'Y',
      max_multiple_longest_path: 10,
      use_total_float_multiple_longest_paths: 'Y',
      key_activity_for_multiple_longest_paths: '',
      LevelPriorityList: 'priority_type,ASC\x7f\x7f',
    }],
  };

  t.PROJWBS = {
    name: 'PROJWBS',
    rows: wbs.map((n) => ({
      wbs_id: n.wbs_id,
      proj_id: n.proj_id,
      obs_id: 540,
      seq_num: n.seq_num,
      est_wt: 1,
      proj_node_flag: n.proj_node_flag,
      sum_data_flag: 'N',
      status_code: 'WS_Open',
      wbs_short_name: n.wbs_short_name,
      wbs_name: n.wbs_name,
      parent_wbs_id: n.parent_wbs_id,
      ev_user_pct: '0.06',
      ev_etc_user_value: '0.88',
      orig_cost: '0.0000',
      indep_remain_total_cost: '0.0000',
      ev_compute_type: 'EC_Cmp_pct',
      ev_etc_compute_type: 'EE_Rem_hr',
      guid: guid(r),
      plan_open_state: '',
    })),
  };

  t.RSRC = {
    name: 'RSRC',
    rows: resources.map((rs, i) => ({
      rsrc_id: rs.rsrc_id,
      clndr_id: calendars[0].clndr_id,
      guid: guid(r),
      rsrc_seq_num: (i + 1) * 100,
      rsrc_name: rs.rsrc_name,
      rsrc_short_name: rs.rsrc_short_name,
      def_qty_per_hr: 1,
      cost_qty_type: 'QT_Hour',
      active_flag: 'Y',
      auto_compute_act_flag: 'Y',
      def_cost_qty_link_flag: 'Y',
      ot_flag: 'N',
      curr_id: 1,
      rsrc_type: rs.rsrc_type,
      load_tasks_flag: '',
      level_flag: '',
    })),
  };

  t.ACTVTYPE = {
    name: 'ACTVTYPE',
    rows: actvTypes.map((a) => ({
      actv_code_type_id: a.actv_code_type_id,
      actv_short_len: a.actv_short_len,
      seq_num: a.seq_num,
      actv_code_type: a.actv_code_type,
      actv_code_type_scope: 'AS_Global',
    })),
  };

  t.RSRCRATE = {
    name: 'RSRCRATE',
    rows: resources.map((rs, i) => ({
      rsrc_rate_id: 7600 + i,
      rsrc_id: rs.rsrc_id,
      max_qty_per_hr: 1,
      cost_per_qty: '0.0000',
      start_date: start(0),
      cost_per_qty2: '0.0000',
      cost_per_qty3: '0.0000',
      cost_per_qty4: '0.0000',
      cost_per_qty5: '0.0000',
    })),
  };

  t.ACTVCODE = {
    name: 'ACTVCODE',
    rows: actvCodes.map((c) => ({
      actv_code_id: c.actv_code_id,
      parent_actv_code_id: '',
      actv_code_type_id: c.actv_code_type_id,
      actv_code_name: c.actv_code_name,
      short_name: c.short_name,
      seq_num: c.seq_num,
      color: '0000FF',
    })),
  };

  t.TASK = {
    name: 'TASK',
    // `emitTasks` drops any activity the model deliberately kept OUT of the file — an
    // external driver lives in another project's export, so the only trace of it here
    // is a TASKPRED row pointing at an id no TASK row carries.
    rows: emitTasks.map((task) => {
      const complete = task.status_code === 'TK_Complete';
      const started = complete || task.status_code === 'TK_Active';
      return {
        task_id: task.task_id,
        proj_id: task.proj_id,
        wbs_id: task.wbs_id,
        clndr_id: task.clndr_id,
        est_wt: 1,
        phys_complete_pct: task.phys_complete_pct,
        rev_fdbk_flag: 'N',
        lock_plan_flag: 'N',
        auto_compute_act_flag: 'N',
        complete_pct_type: 'CP_Drtn',
        task_type: task.task_type,
        duration_type: 'DT_FixedDUR2',
        status_code: task.status_code,
        task_code: task.task_code,
        task_name: task.task_name,
        // Float is EMPTY, not zero, on completed work — the distinction the derived
        // contract's float_histogram.null_count exists for.
        total_float_hr_cnt: task.floatNull ? '' : task.tf,
        free_float_hr_cnt: task.floatNull ? '' : task.ff,
        remain_drtn_hr_cnt: task.remain,
        act_work_qty: 0,
        remain_work_qty: 0,
        target_work_qty: 0,
        target_drtn_hr_cnt: task.dur,
        target_equip_qty: 0,
        act_equip_qty: 0,
        remain_equip_qty: 0,
        cstr_date: task.cstr_type ? inst(task, task.lf) : '',
        // A zero-duration row writes ONE instant for a moment, so its starts move with
        // its finishes: `early_start_date == early_end_date` is what a finish milestone
        // carries in a real export, and splitting them would emit a row finishing before
        // it started (049).
        act_start_date: started ? startInst(task, task.act_start) : '',
        act_end_date: complete ? inst(task, task.act_end) : '',
        late_start_date: startInst(task, task.ls),
        late_end_date: inst(task, task.lf),
        early_start_date: complete ? '' : startInst(task, task.es),
        early_end_date: complete ? '' : inst(task, task.ef),
        restart_date: complete ? '' : startInst(task, Math.max(task.es, dataDateHours)),
        reend_date: complete ? '' : inst(task, task.ef),
        target_start_date: startInst(task, task.es),
        target_end_date: inst(task, task.ef),
        rem_late_start_date: complete ? '' : startInst(task, task.ls),
        rem_late_end_date: complete ? '' : inst(task, task.lf),
        cstr_type: task.cstr_type ?? '',
        priority_type: 'PT_Normal',
        float_path: task.floatPath ?? '',
        float_path_order: task.floatPathOrder ?? '',
        guid: guid(r),
        // Longest Path, from the backward walk over this file's own logic — never
        // from float. `tf <= 0` is the conflation xer-format.md warns about and 014
        // decision 4 rejects; emitting it here made the corpus pass a broken tracer.
        // Empty on every row when P6 was not asked to compute Longest Path.
        driving_path_flag: o.longestPathFlag && task.driving ? 'Y' : '',
        act_this_per_work_qty: 0,
        act_this_per_equip_qty: 0,
        create_date: start(0),
        update_date: start(0),
        create_user: 'admin',
        update_user: 'admin',
      };
    }),
  };

  t.TASKPRED = {
    name: 'TASKPRED',
    // An external activity's OWN logic is not in this file; its outgoing links are,
    // and they carry a foreign pred_proj_id — which is what makes them external.
    // A `hidden` relationship is not written at all: the programme was scheduled with
    // it, and the export simply does not carry TASKPRED.
    rows: preds.filter((rel) => !rel.hidden && !tasks[rel.succ].external).map((rel) => ({
      task_pred_id: rel.task_pred_id,
      task_id: tasks[rel.succ].task_id,
      pred_task_id: rel.external ? EXTERNAL_TASK_ID : tasks[rel.pred].task_id,
      proj_id: tasks[rel.succ].proj_id,
      pred_proj_id: rel.external ? EXTERNAL_PROJ_ID : tasks[rel.pred].proj_id,
      pred_type: rel.type,
      lag_hr_cnt: rel.lag,
      aref: start(tasks[rel.pred].ef),
      arls: start(tasks[rel.succ].ls),
    })),
  };

  t.TASKRSRC = {
    name: 'TASKRSRC',
    rows: taskrsrc.map((a) => ({
      taskrsrc_id: a.taskrsrc_id,
      task_id: a.task.task_id,
      proj_id: a.task.proj_id,
      cost_qty_link_flag: 'Y',
      rsrc_id: a.rsrc.rsrc_id,
      remain_qty: a.task.status_code === 'TK_Complete' ? 0 : a.qty,
      target_qty: a.qty,
      remain_qty_per_hr: '0.125',
      target_lag_drtn_hr_cnt: 0,
      target_qty_per_hr: '0.125',
      act_ot_qty: 0,
      act_reg_qty: a.task.status_code === 'TK_Complete' ? a.qty : 0,
      relag_drtn_hr_cnt: 0,
      cost_per_qty: '0.0000',
      target_cost: '0.0000',
      act_reg_cost: '0.0000',
      act_ot_cost: '0.0000',
      remain_cost: '0.0000',
      target_start_date: startInst(a.task, a.task.es),
      target_end_date: inst(a.task, a.task.ef),
      rem_late_start_date: startInst(a.task, a.task.ls),
      rem_late_end_date: inst(a.task, a.task.lf),
      rollup_dates_flag: 'Y',
      ts_pend_act_end_flag: 'N',
      guid: guid(r),
      rate_type: 'COST_PER_QTY',
      act_this_per_cost: '0.0000',
      act_this_per_qty: 0,
      rsrc_type: a.rsrc.rsrc_type,
      cost_per_qty_source_type: 'ST_Rsrc',
      create_user: 'admin',
      create_date: start(0),
    })),
  };

  t.TASKACTV = { name: 'TASKACTV', rows: taskactv };

  t.UDFVALUE = {
    name: 'UDFVALUE',
    rows: udfValues.map((v) => {
      const row = { udf_type_id: v.udf.udf_type_id, fk_id: v.task.task_id, proj_id: v.task.proj_id };
      if (v.udf.logical_data_type === 'FT_TEXT') row.udf_text = `${v.udf.udf_type_label} ${v.task.task_code}`;
      else if (v.udf.logical_data_type === 'FT_FLOAT_2_DECIMALS') row.udf_number = v.task.phys_complete_pct;
      else row.udf_date = start(v.task.ef);
      return row;
    }),
  };

  return t;
}

/**
 * POBS rows carrying the 0x81 landmine.
 *
 * Fixture B has 31,485 0x81 bytes and every one of them is in POBS: rows whose
 * names are already mangled — CP1252 bytes in one row, UTF-8 bytes sitting inside a
 * CP1252 file in the next. 0x81 is undefined in CP1252, so a strict decode throws
 * on the real file. Python's cp1252 codec does exactly that, which is how this was
 * found. The bytes below reproduce the shape, not the content.
 */
function mojibakePobs() {
  return [
    {
      pobs_id: 1486,
      pobs_parent_id: 100,
      seq_num: 2,
      // 0x81 is an undefined CP1252 code point; U+0081 round-trips it as a raw byte.
      pobs_name: '\u00CA\u00E0\u00F2\u00E5\u00E3\u00FAA\u0081H1.1',
      pobs_descr: '\u00CA1.1',
      pobs_manager: 'admin',
    },
    {
      pobs_id: 1487,
      pobs_parent_id: 100,
      seq_num: 2,
      // The same text double-encoded: UTF-8 bytes inside a CP1252 file.
      pobs_name: '\u00C3\u008A\u00C3\u0081H\u00C3\u00B2\u00C3\u00A5\u00C3\u00A3\u00C3\u00AE1.1',
      pobs_descr: '',
      pobs_manager: 'admin',
    },
  ];
}

export { HOURS_PER_DAY, fmtDate };
