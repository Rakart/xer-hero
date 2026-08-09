/**
 * Realistic `derived.json` objects for the tests, and for nothing else.
 *
 * They are not toys. `perf20k` is the measured object from
 * `fixtures/generated/perf-20k.xer` carried forward to contract v4 — 20,000 activities,
 * 34,000 relationships, 1,800 WBS nodes, a 40-bucket S-curve, 12,829 null floats and a
 * DCMA run of 6/10 with 4 skipped. `tender` is Fixture B's published measurements: 3,344
 * activities under a single WBS node, no progress at all, and a `longest_path` that P6
 * never exported. `broken` exercises the states a real file reaches and a synthetic corpus
 * hides: an undecodable calendar, a cyclic driving chain, an absent window.
 *
 * Every branch on the page is reachable from one of these four, which is the point: the
 * page is built against a database nobody can run here, so the fixtures are the only proof
 * that `skip`, `unavailable`, `error`, `wbs_depth: 1` and a clean programme all render.
 */

import type { DcmaCheck, Derived } from '@/lib/contracts/derived'
import { DERIVED_VERSION } from '@/lib/contracts/derived'

const PROGRAMME_ID = '11111111-1111-4111-8111-111111111111'
const REVISION_ID = '22222222-2222-4222-8222-222222222222'

function base(): Derived {
  return {
    version: DERIVED_VERSION,
    programme_id: PROGRAMME_ID,
    revision_id: REVISION_ID,
    computed_at: '2026-08-07T09:14:00Z',
    parser_version: '0.1.0',
    shape: {
      activity_count: 0,
      relationship_count: 0,
      milestone_count: 0,
      wbs_depth: 1,
      wbs_node_count: 1,
      wbs_summary: [],
      wbs_summary_truncated: false,
      calendar_count: 1,
      calendars_in_use: 1,
      resource_count: 0,
      resource_assignment_count: 0,
      activity_code_type_count: 0,
    },
    time: {
      start_date: null,
      finish_date: null,
      data_date: null,
      duration_calendar_days: null,
      duration_working_days: { state: 'unavailable', reason: 'no CALENDAR table in the file' },
    },
    progress: { pct_complete: 0, is_baseline: true, status_mix: {} },
    logic: {
      relationship_type_mix: {},
      open_ends: { no_predecessor: 0, no_successor: 0 },
      external_relationship_count: 0,
      critical_count: 0,
      critical_threshold_hr: 0,
      cycle_count: 0,
      path_continuous: false,
      longest_path: { state: 'unavailable', reason: 'no remaining dates' },
    },
    quality: { standard: 'DCMA-14', passed: 0, applicable: 0, skipped: 14, checks: [] },
    distributions: {
      s_curve: { bucket: 'month', from: null, to: null, starts: [], finishes: [], cumulative: [] },
      float_histogram: {
        unit: 'days',
        edges: [null, -20, 0, 5, 10, 20, 44, 100, 200, null],
        counts: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        null_count: 0,
      },
      duration_histogram: {
        unit: 'days',
        edges: [0, 1, 5, 10, 20, 44, 100, 200, null],
        counts: [0, 0, 0, 0, 0, 0, 0, 0],
      },
      activity_type_mix: {},
    },
    codes: { types: [], truncated: false },
    issues: [],
  }
}

const SKIPPED_BASELINE_CHECKS: DcmaCheck[] = [
  { id: 'missed_tasks', num: 11, state: 'skip', reason: 'no baseline tables in the file' },
  { id: 'critical_path_test', num: 12, state: 'skip', reason: 'needs a scheduling engine' },
  { id: 'cpli', num: 13, state: 'skip', reason: 'no baseline tables in the file' },
  { id: 'bei', num: 14, state: 'skip', reason: 'no baseline tables in the file' },
]

/**
 * The 20,000-activity performance fixture: progressed, four WBS levels, and the file the
 * page's measurements were taken against. Its float histogram is the single spike that
 * settled the float-is-a-table decision — 12,829 nulls and 6,254 activities over 200 days.
 */
export const perf20k: Derived = {
  ...base(),
  shape: {
    activity_count: 20_000,
    relationship_count: 34_000,
    milestone_count: 1407,
    wbs_depth: 4,
    wbs_node_count: 1800,
    wbs_summary: [
      { name: 'Enabling works', activity_count: 4820 },
      { name: 'Tunnels', activity_count: 6110 },
      { name: 'Stations', activity_count: 5290 },
      { name: 'Systems', activity_count: 3780 },
    ],
    wbs_summary_truncated: true,
    calendar_count: 4,
    calendars_in_use: 1,
    resource_count: 40,
    resource_assignment_count: 51_934,
    activity_code_type_count: 12,
  },
  time: {
    start_date: '2026-01-05',
    finish_date: '2029-04-04',
    data_date: '2027-04-23 13:00',
    duration_calendar_days: 1186,
    duration_working_days: {
      days: 847,
      calendar: { clndr_id: 42, name: '5-Day Week', working_days_per_week: 5 },
      activity_share_pct: 100,
    },
  },
  progress: {
    pct_complete: 64.1,
    is_baseline: false,
    status_mix: { TK_Complete: 12_829, TK_Active: 615, TK_NotStart: 6556 },
  },
  logic: {
    relationship_type_mix: { PR_FS: 31_275, PR_SS: 2057, PR_FF: 501, PR_SF: 167 },
    open_ends: { no_predecessor: 688, no_successor: 1297 },
    external_relationship_count: 0,
    critical_count: 27,
    critical_threshold_hr: 0,
    cycle_count: 0,
    path_continuous: true,
    longest_path: {
      state: 'ok',
      count: 214,
      duration_calendar_days: 1180,
      share_of_remaining_pct: 12.2,
      provenance: 'computed',
    },
  },
  quality: {
    standard: 'DCMA-14',
    passed: 6,
    applicable: 10,
    skipped: 4,
    checks: [
      {
        id: 'logic',
        num: 1,
        state: 'pass',
        no_predecessor: 688,
        no_successor: 1297,
        pct: 5,
        threshold: '<=5%',
      },
      {
        id: 'leads',
        num: 2,
        state: 'fail',
        count: 702,
        pct: 2.1,
        threshold: '0',
        truncated: true,
        shown: 2,
        examples: [
          { code: 'A213491', name: 'Erect Formwork — PRJ.101.1.1', value_hr: -56 },
          { code: 'A204503', name: 'Cast Pile Cap — PRJ.143.2', value_hr: -16 },
        ],
      },
      { id: 'lags', num: 3, state: 'pass', count: 1417, pct: 4.2, threshold: '<=5%' },
      { id: 'relationship_types', num: 4, state: 'pass', pct: 92, threshold: '>=90%' },
      { id: 'hard_constraints', num: 5, state: 'pass', count: 599, pct: 3, threshold: '<=5%' },
      {
        id: 'high_float',
        num: 6,
        state: 'fail',
        count: 7117,
        pct: 35.6,
        threshold: '<=5%',
        truncated: true,
        shown: 2,
        hours_per_day: 8,
        hours_per_day_source: 'programme_calendar',
        examples: [
          { code: 'A067950', name: 'Fabricate Drainage — PRJ.101.1.1', value_hr: 3728 },
          { code: 'A113010', name: 'Waterproof Switchgear — PRJ.103.2.1', value_hr: 3728 },
        ],
      },
      {
        id: 'negative_float',
        num: 7,
        state: 'fail',
        count: 27,
        pct: 0.1,
        threshold: '0',
        truncated: false,
        shown: 2,
        examples: [
          { code: 'A091940', name: 'Construct Rebar Cage — PRJ.164.2', value_hr: -320 },
          { code: 'A103180', name: 'Approve Rebar Cage — PRJ.164.2', value_hr: -320 },
        ],
      },
      {
        id: 'high_duration',
        num: 8,
        state: 'fail',
        count: 1155,
        pct: 5.8,
        threshold: '<=5%',
        truncated: true,
        shown: 1,
        hours_per_day: 8,
        hours_per_day_source: 'fallback',
        examples: [{ code: 'A001160', name: 'Demolish Drainage — PRJ.121.2', value_hr: 960 }],
      },
      { id: 'invalid_dates', num: 9, state: 'pass', count: 0, threshold: '0' },
      { id: 'resources', num: 10, state: 'pass', pct: 93 },
      ...SKIPPED_BASELINE_CHECKS,
    ],
  },
  distributions: {
    s_curve: {
      bucket: 'month',
      from: '2026-01',
      to: '2029-04',
      starts: [
        1524, 590, 608, 592, 682, 709, 917, 831, 764, 826, 873, 955, 893, 903, 1004, 1038, 934, 958,
        806, 697, 596, 532, 450, 376, 266, 178, 159, 80, 108, 46, 33, 43, 15, 3, 4, 2, 0, 3, 2, 0,
      ],
      finishes: [
        1122, 626, 626, 593, 638, 670, 877, 835, 771, 799, 837, 928, 884, 887, 999, 1036, 960, 972,
        892, 715, 622, 581, 507, 429, 324, 227, 195, 105, 129, 59, 50, 48, 27, 10, 8, 3, 2, 3, 3, 1,
      ],
      cumulative: [
        1122, 1748, 2374, 2967, 3605, 4275, 5152, 5987, 6758, 7557, 8394, 9322, 10_206, 11_093,
        12_092, 13_128, 14_088, 15_060, 15_952, 16_667, 17_289, 17_870, 18_377, 18_806, 19_130,
        19_357, 19_552, 19_657, 19_786, 19_845, 19_895, 19_943, 19_970, 19_980, 19_988, 19_991,
        19_993, 19_996, 19_999, 20_000,
      ],
    },
    float_histogram: {
      unit: 'days',
      edges: [null, -20, 0, 5, 10, 20, 44, 100, 200, null],
      counts: [10, 17, 0, 0, 14, 13, 174, 689, 6254],
      null_count: 12_829,
    },
    duration_histogram: {
      unit: 'days',
      edges: [0, 1, 5, 10, 20, 44, 100, 200, null],
      counts: [1407, 6102, 2951, 4954, 2662, 1729, 195, 0],
    },
    activity_type_mix: { TT_Task: 18_593, TT_FinMile: 1275, TT_Mile: 132 },
  },
  codes: {
    types: [
      { name: 'Discipline', value_count: 7, assigned_pct: 100 },
      { name: 'Area', value_count: 10, assigned_pct: 100 },
      { name: 'Phase', value_count: 5, assigned_pct: 100 },
    ],
    truncated: true,
  },
  issues: [],
}

/**
 * Fixture B: a real, professionally produced tender programme — 3,344 activities under a
 * single WBS node, 0% complete, and a `longest_path` P6 never exported. `wbs_depth: 1` is a
 * correct answer here, not an error, and check 4 misses by half a percentage point.
 */
export const tender: Derived = {
  ...base(),
  shape: {
    activity_count: 3344,
    relationship_count: 5883,
    milestone_count: 233,
    wbs_depth: 1,
    wbs_node_count: 1,
    wbs_summary: [{ name: 'Quay wall reconstruction', activity_count: 3344 }],
    wbs_summary_truncated: false,
    calendar_count: 3,
    calendars_in_use: 1,
    resource_count: 37,
    resource_assignment_count: 6256,
    activity_code_type_count: 12,
  },
  time: {
    start_date: '2017-04-24',
    finish_date: '2023-08-11',
    data_date: null,
    duration_calendar_days: 2301,
    duration_working_days: {
      days: 1644,
      calendar: { clndr_id: 42, name: '5-Day Week', working_days_per_week: 5 },
      activity_share_pct: 50,
    },
  },
  progress: {
    pct_complete: 0,
    is_baseline: true,
    status_mix: { TK_NotStart: 3344, TK_Active: 0, TK_Complete: 0 },
  },
  logic: {
    relationship_type_mix: { PR_FS: 5267, PR_SS: 576, PR_FF: 39, PR_SF: 1 },
    open_ends: { no_predecessor: 42, no_successor: 110 },
    external_relationship_count: 0,
    critical_count: 131,
    critical_threshold_hr: 0,
    cycle_count: 0,
    path_continuous: false,
    longest_path: {
      state: 'skip',
      reason: 'the programme has no progress, so there is no remaining work to trace',
    },
  },
  quality: {
    standard: 'DCMA-14',
    passed: 5,
    applicable: 10,
    skipped: 4,
    checks: [
      {
        id: 'logic',
        num: 1,
        state: 'pass',
        no_predecessor: 42,
        no_successor: 110,
        pct: 3.3,
        threshold: '<=5%',
      },
      { id: 'leads', num: 2, state: 'fail', count: 362, pct: 6.2, threshold: '0' },
      { id: 'lags', num: 3, state: 'fail', count: 518, pct: 8.8, threshold: '<=5%' },
      // Half a percentage point under a 90% floor. This is the row that proves a naked
      // verdict is unreadable: `FAIL` alone would hide that it is 89.5 against 90.
      { id: 'relationship_types', num: 4, state: 'fail', pct: 89.5, threshold: '>=90%' },
      { id: 'hard_constraints', num: 5, state: 'pass', count: 140, pct: 4.2, threshold: '<=5%' },
      { id: 'high_float', num: 6, state: 'fail', count: 2530, pct: 75.7, threshold: '<=5%' },
      { id: 'negative_float', num: 7, state: 'pass', count: 0, pct: 0, threshold: '0' },
      { id: 'high_duration', num: 8, state: 'fail', count: 1411, pct: 42.2, threshold: '<=5%' },
      { id: 'invalid_dates', num: 9, state: 'pass', count: 0, threshold: '0' },
      { id: 'resources', num: 10, state: 'pass', pct: 86.4 },
      ...SKIPPED_BASELINE_CHECKS,
    ],
  },
  distributions: {
    s_curve: {
      bucket: 'month',
      from: '2017-04',
      to: '2017-09',
      starts: [12, 47, 91, 120, 64, 20],
      finishes: [0, 3, 22, 60, 110, 3149],
      cumulative: [0, 3, 25, 85, 195, 3344],
    },
    float_histogram: {
      unit: 'days',
      edges: [null, -20, 0, 5, 10, 20, 44, 100, 200, null],
      counts: [0, 0, 240, 190, 150, 232, 190, 1580, 762],
      null_count: 0,
    },
    duration_histogram: {
      unit: 'days',
      edges: [0, 1, 5, 10, 20, 44, 100, 200, null],
      counts: [233, 700, 900, 780, 500, 180, 51, 0],
    },
    activity_type_mix: { TT_Task: 3111, TT_FinMile: 213, TT_Mile: 20 },
  },
  codes: {
    types: [
      { name: 'Discipline', value_count: 14, assigned_pct: 99.1 },
      { name: 'Area', value_count: 31, assigned_pct: 97.4 },
    ],
    truncated: false,
  },
  // `info` — recorded, and deliberately **not** banner-worthy.
  issues: [
    {
      stat: 'logic.longest_path',
      severity: 'info',
      reason: 'driving_path_flag set on 1 of 3344 activities',
    },
  ],
}

/**
 * The two `error` states, together with the degenerate shapes that reach a division by
 * zero: no relationships, no window, no status mix. This is the only fixture that raises
 * the *partially analysed* banner.
 */
export const broken: Derived = {
  ...base(),
  shape: {
    ...base().shape,
    activity_count: 12,
    relationship_count: 0,
    milestone_count: 12,
    wbs_depth: 1,
    wbs_node_count: 1,
    wbs_summary: [],
    wbs_summary_truncated: false,
    calendar_count: 0,
    calendars_in_use: 0,
    activity_code_type_count: 0,
  },
  time: {
    start_date: null,
    finish_date: null,
    data_date: null,
    duration_calendar_days: null,
    duration_working_days: {
      state: 'error',
      reason: 'clndr_data parse failed for clndr_id 42',
    },
  },
  logic: {
    ...base().logic,
    critical_count: 4,
    critical_threshold_hr: 168,
    cycle_count: 2,
    external_relationship_count: 3,
    longest_path: { state: 'error', reason: 'the driving chain contains a cycle' },
  },
  quality: {
    standard: 'DCMA-14',
    passed: 0,
    applicable: 0,
    skipped: 14,
    checks: [
      { id: 'logic', num: 1, state: 'skip', reason: 'no relationships in the file' },
      { id: 'leads', num: 2, state: 'skip', reason: 'no relationships in the file' },
      { id: 'lags', num: 3, state: 'skip', reason: 'no relationships in the file' },
      { id: 'relationship_types', num: 4, state: 'skip', reason: 'no relationships in the file' },
      { id: 'hard_constraints', num: 5, state: 'skip', reason: 'no constraints in the file' },
      { id: 'high_float', num: 6, state: 'skip', reason: 'no float in the file' },
      { id: 'negative_float', num: 7, state: 'skip', reason: 'no float in the file' },
      { id: 'high_duration', num: 8, state: 'skip', reason: 'no durations in the file' },
      { id: 'invalid_dates', num: 9, state: 'skip', reason: 'no dates in the file' },
      { id: 'resources', num: 10, state: 'skip', reason: 'no resources in the file' },
      ...SKIPPED_BASELINE_CHECKS,
    ],
  },
  issues: [
    {
      stat: 'time.duration_working_days',
      severity: 'error',
      reason: 'clndr_data parse failed for clndr_id 42',
    },
    { stat: 'logic.longest_path', severity: 'error', reason: 'the driving chain contains a cycle' },
    { stat: 'shape.wbs_summary', severity: 'warn', reason: 'PROJWBS names 0 nodes' },
  ],
}

/**
 * A programme with **zero issues**, every applicable check passing, and no missing state
 * anywhere: the case where the page must have nothing to apologise for and no banner.
 */
export const clean: Derived = {
  ...tender,
  quality: {
    standard: 'DCMA-14',
    passed: 10,
    applicable: 10,
    skipped: 4,
    checks: tender.quality.checks.map((check) =>
      check.state === 'fail' ? { ...check, state: 'pass' as const } : check,
    ),
  },
  logic: {
    ...tender.logic,
    path_continuous: true,
    longest_path: {
      state: 'ok',
      count: 88,
      duration_calendar_days: 640,
      share_of_remaining_pct: 41.5,
      provenance: 'computed',
      truncated: true,
    },
  },
  time: {
    ...tender.time,
    data_date: '2019-06-30',
    duration_working_days: {
      days: 1644,
      calendar: { clndr_id: 7, name: '7-Day Elapsed', working_days_per_week: 7 },
      activity_share_pct: 100,
    },
  },
  issues: [],
}

export const FIXTURES = { perf20k, tender, broken, clean } as const
