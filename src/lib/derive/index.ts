/**
 * `lib/derive` — one call in, three artefacts out (§3, `contracts/derive.ts`).
 *
 * Ingest, seeding and the lazy recompute path all go through `derive()`, so there is exactly
 * one producer of `derived.json` in the estate. §4.9 rejects committed pre-computed JSON for
 * that reason: a second producer against a contract that has already moved twice is how the
 * two drift.
 *
 * Two rules shape the control flow and both are §3.10's:
 *
 * - **Ingest never fails on a stat error.** Only tokenizer failure rejects an upload — if
 *   `%T`/`%F`/`%R` cannot be read there is nothing to publish. Every stat-level failure is an
 *   `issues[]` entry and the programme publishes anyway, so each group is computed inside its
 *   own guard and one throwing cannot cost the other six. A half-analysed programme is still
 *   worth having on the shelf, and silent upload rejection is the worst failure mode for a
 *   warehouse: the uploader has no idea what went wrong and no way to fix it.
 * - **Stats that always compute stay bare scalars; only stats that can fail are tagged.**
 *   Wrapping `activity_count` in `{value, state}` would triple the file and force every
 *   consumer to unwrap a value that never fails.
 */

import type { ActivitiesPayload } from '../contracts/activities'
import type { DeriveInput, DeriveOutput, RevisionFacets } from '../contracts/derive'
import {
  DERIVED_MAX_BYTES,
  DERIVED_VERSION,
  DERIVED_WARN_BYTES,
  type Derived,
  type DerivedCodes,
  type DerivedDistributions,
  type DerivedIssue,
  type DerivedLogic,
  type DerivedProgress,
  type DerivedQuality,
  type DerivedShape,
  type DerivedTime,
  type LongestPath,
  type WbsSummaryEntry,
} from '../contracts/derived'
import { WBS_SUMMARY_CAP } from '../contracts/domain'
import type { TraceResult } from '../contracts/trace'
import type { XerFile, XerTable } from '../contracts/xer'
import { cell, reader } from '../contracts/xer'
import type { ActivityRow, RelationshipRow, WbsNode } from './activities'
import {
  activityFinish,
  activityStart,
  buildActivities,
  isExternal,
  readActivities,
  readRelationships,
  readResourcedTaskIds,
  readWbs,
} from './activities'
import { durationWorkingDays } from './calendar'
import { buildCard } from './card'
import type { DateWindow } from './dates'
import { dateFromDayNumber, dayNumber, durationCalendarDays, isMilestoneType } from './dates'
import { dcmaScorecard, openEnds } from './dcma'
import {
  activityTypeMix,
  countBy,
  durationHistogram,
  floatHistogram,
  sCurve,
} from './distributions'
import { hoursPerDay } from './float'
import { trace, traceIssues } from './tracer'

/** Code types in `codes.types`, the same discipline as the 50-exemplar and 20-WBS caps. */
export const CODE_TYPE_CAP = 50

/** One decimal place, the resolution every published percentage here is quoted at. */
function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

function numberOrNull(value: string | undefined): number | null {
  if (value === undefined) return null
  const text = value.trim()
  if (text === '') return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

const rowCount = (table: XerTable | undefined): number => table?.rows.length ?? 0

/**
 * Compute one stat group, or record why it could not be computed and carry on.
 *
 * The fallback is a valid object of the group's own shape rather than `null`, so a consumer
 * never has to branch on a group being absent — the `issues[]` entry is where the failure is
 * told, and only an `error` severity reaches the detail page's *partially analysed* banner.
 */
function guard<T>(stat: string, issues: DerivedIssue[], fallback: T, compute: () => T): T {
  try {
    return compute()
  } catch (e) {
    issues.push({
      stat,
      severity: 'error',
      reason: `${stat} could not be computed: ${e instanceof Error ? e.message : String(e)}`,
    })
    return fallback
  }
}

// --- the pipeline ------------------------------------------------------------

export function derive(input: DeriveInput): DeriveOutput {
  const { file, programmeId, revisionId, parserVersion, computedAt } = input
  const issues: DerivedIssue[] = []

  // One name-mapped read of each table, shared by every group below (§2.7), so
  // `activities.json` and `derived.json` cannot disagree about what an activity is.
  const read = readActivities(file)
  const activities = read.rows
  const relationships = readRelationships(file)
  const wbs = readWbs(file)
  const resourced = readResourcedTaskIds(file)
  if (read.unidentifiable > 0) {
    issues.push({
      stat: 'shape.activity_count',
      severity: 'warn',
      reason:
        `${read.unidentifiable} TASK row(s) carry no readable task_id and were dropped: ` +
        'nothing can join a relationship, an assignment or a driving flag to a row with no ' +
        'identity, and inventing one would corrupt those joins silently',
    })
  }

  const window = programmeWindow(activities)
  const day = hoursPerDay(file)
  const project = projectRow(file, activities)

  const shape = guard('shape', issues, EMPTY_SHAPE, () =>
    buildShape(file, activities, relationships, wbs),
  )
  const time = guard('time', issues, EMPTY_TIME, () => buildTime(file, window, project, issues))
  const progress = guard('progress', issues, EMPTY_PROGRESS, () => buildProgress(activities))

  // The trace is its own guard: a cycle is a *reported* state rather than a throw (§8.7),
  // but a defect in the walk must not cost the other six groups.
  const traced = guard('logic.longest_path', issues, UNAVAILABLE_TRACE, () => trace(file))
  issues.push(...traceIssues(traced))

  const logic = guard('logic', issues, EMPTY_LOGIC, () =>
    buildLogic(activities, relationships, project, traced),
  )
  const quality = guard('quality', issues, EMPTY_QUALITY, () =>
    dcmaScorecard({
      activities,
      relationships,
      dataDate: time.data_date,
      hoursPerDay: day,
      resourced,
    }),
  )
  const distributions = guard('distributions', issues, EMPTY_DISTRIBUTIONS, () => ({
    s_curve: sCurve(activities, window),
    float_histogram: floatHistogram(activities, day),
    duration_histogram: durationHistogram(activities, day),
    activity_type_mix: activityTypeMix(activities),
  }))
  const codes = guard('codes', issues, EMPTY_CODES, () => buildCodes(file, activities.length))

  let derived: Derived = {
    version: DERIVED_VERSION,
    programme_id: programmeId,
    revision_id: revisionId,
    computed_at: computedAt,
    parser_version: parserVersion,
    shape,
    time,
    progress,
    logic,
    quality,
    distributions,
    codes,
    issues,
  }
  derived = withinSizeBudget(derived)

  const activitiesPayload: ActivitiesPayload = buildActivities(activities, wbs, traced.members)
  const row: RevisionFacets = {
    p6_version: file.header?.version ?? null,
    activity_count: derived.shape.activity_count,
    start_date: derived.time.start_date,
    finish_date: derived.time.finish_date,
    data_date: derived.time.data_date,
    pct_complete: derived.progress.pct_complete,
    is_baseline: derived.progress.is_baseline,
    checks_passed: derived.quality.passed,
    checks_applicable: derived.quality.applicable,
    card: buildCard({
      activities,
      sCurve: derived.distributions.s_curve,
      hoursPerDay: day,
      wbsDepth: derived.shape.wbs_depth,
      issuesCount: derived.issues.length,
    }),
    derived_version: DERIVED_VERSION,
  }
  return { derived, activities: activitiesPayload, row }
}

// --- the window --------------------------------------------------------------

/**
 * `[start_date, finish_date]` — computed **once** and handed to `durationCalendarDays`,
 * `durationWorkingDays` and the S-curve alike, so the two duration fields cannot count two
 * different windows (§3.4).
 *
 * Both ends are dates, not instants: every consumer measures whole days, and a window is a
 * pair of calendar dates however precisely the file wrote them.
 */
export function programmeWindow(activities: readonly ActivityRow[]): DateWindow | null {
  let first: number | null = null
  let last: number | null = null
  for (const row of activities) {
    const s = dayNumber(activityStart(row))
    if (s !== null && (first === null || s < first)) first = s
    const f = dayNumber(activityFinish(row))
    if (f !== null && (last === null || f > last)) last = f
  }
  if (first === null || last === null) return null
  return { start: dateFromDayNumber(first), finish: dateFromDayNumber(last) }
}

/**
 * The `PROJECT` row that owns the activities.
 *
 * `multiproj-baseline-rows.xer` carries three `PROJECT` rows and one of them owns the
 * `TASK` rows' `proj_id`; reading row 0 would take the data date and the critical threshold
 * off a baseline copy. Falls back to the first row where nothing matches, which is what a
 * single-project file degenerates to anyway.
 */
function projectRow(
  file: XerFile,
  activities: readonly ActivityRow[],
): { table: XerTable; row: readonly string[] } | null {
  const table = file.tables.get('PROJECT')
  if (!table || table.rows.length === 0) return null
  const projIds = new Set(activities.map((a) => a.proj_id).filter((id) => id !== null))
  const read = reader(table, 'proj_id')
  if (read && projIds.size === 1) {
    const wanted = [...projIds][0]
    const owner = table.rows.find((r) => read(r) === wanted)
    if (owner) return { table, row: owner }
  }
  const first = table.rows[0]
  return first ? { table, row: first } : null
}

function projectField(
  project: { table: XerTable; row: readonly string[] } | null,
  field: string,
): string | undefined {
  if (!project) return undefined
  return cell(project.table, project.row, field)
}

// --- shape -------------------------------------------------------------------

function buildShape(
  file: XerFile,
  activities: readonly ActivityRow[],
  relationships: readonly { pred_type: string }[],
  wbs: readonly WbsNode[],
): DerivedShape {
  const summary = wbsSummary(wbs, activities)
  return {
    activity_count: activities.length,
    relationship_count: relationships.length,
    milestone_count: activities.filter((row) => isMilestoneType(row.task_type)).length,
    wbs_depth: wbsDepth(wbs),
    wbs_node_count: wbs.length,
    wbs_summary: summary.entries,
    wbs_summary_truncated: summary.truncated,
    // A fact about the file, beside a fact about the programme (§3.3). `missing-calendar`
    // reports 2 in use against a `calendar_count` of 0 — the rows still name calendars the
    // file no longer carries, which is exactly what a table-level deletion leaves behind.
    calendar_count: rowCount(file.tables.get('CALENDAR')),
    calendars_in_use: new Set(
      activities.map((row) => row.clndr_id).filter((id): id is string => id !== null),
    ).size,
    resource_count: rowCount(file.tables.get('RSRC')),
    resource_assignment_count: rowCount(file.tables.get('TASKRSRC')),
    activity_code_type_count: rowCount(file.tables.get('ACTVTYPE')),
  }
}

/**
 * How deep the breakdown goes, counting the project node as level 1.
 *
 * **`wbs_depth: 1` is a correct answer, not an error** — one real tender puts 3,344
 * activities under a single node with no breakdown at all, and every card and chart keyed on
 * WBS must render sensibly there. Nothing may promise a WBS treemap.
 */
export function wbsDepth(nodes: readonly WbsNode[]): number {
  const byId = new Map(nodes.map((n) => [n.wbs_id, n]))
  let deepest = 0
  for (const node of nodes) {
    let depth = 1
    let current = node
    const seen = new Set<number>([node.wbs_id])
    for (;;) {
      const parentId = current.parent_wbs_id
      if (parentId === null) break
      const parent = byId.get(parentId)
      // A parent naming itself, or a loop of them, is damage rather than a tree — stop
      // walking rather than hang, and report the depth reached.
      if (!parent || seen.has(parent.wbs_id)) break
      seen.add(parent.wbs_id)
      current = parent
      depth++
    }
    if (depth > deepest) deepest = depth
  }
  return deepest
}

/**
 * First-level nodes only, capped at 20 (§3.3).
 *
 * "First level" excludes the project node itself: a summary whose one entry is the whole
 * programme is not a breakdown. On a file with no breakdown at all the list is empty, which
 * is the same true statement the `no WBS` badge makes.
 *
 * The 20 kept are the **largest**, because a truncated breakdown that dropped the biggest
 * node would misdescribe the programme on first paint — and first paint is the entire reason
 * this list exists rather than being read out of `activities.json`.
 */
export function wbsSummary(
  nodes: readonly WbsNode[],
  activities: readonly ActivityRow[],
): { entries: WbsSummaryEntry[]; truncated: boolean } {
  const byId = new Map(nodes.map((n) => [n.wbs_id, n]))
  const children = new Map<number, WbsNode[]>()
  for (const node of nodes) {
    const parentId = node.parent_wbs_id
    if (parentId === null || !byId.has(parentId)) continue
    const list = children.get(parentId)
    if (list) list.push(node)
    else children.set(parentId, [node])
  }

  const firstLevel = nodes.filter((node) => {
    if (node.proj_node_flag) return false
    const parentId = node.parent_wbs_id
    if (parentId === null) return true
    const parent = byId.get(parentId)
    return parent === undefined || parent.proj_node_flag
  })

  const perNode = new Map<number, number>()
  for (const row of activities) {
    if (row.wbs_id === null) continue
    perNode.set(row.wbs_id, (perNode.get(row.wbs_id) ?? 0) + 1)
  }
  const subtreeCount = (node: WbsNode, seen: Set<number>): number => {
    if (seen.has(node.wbs_id)) return 0
    seen.add(node.wbs_id)
    let total = perNode.get(node.wbs_id) ?? 0
    for (const child of children.get(node.wbs_id) ?? []) total += subtreeCount(child, seen)
    return total
  }

  const entries = firstLevel
    .map((node) => ({
      name: node.wbs_name || node.wbs_short_name,
      activity_count: subtreeCount(node, new Set()),
    }))
    .sort((a, b) => b.activity_count - a.activity_count)
  return { entries: entries.slice(0, WBS_SUMMARY_CAP), truncated: entries.length > WBS_SUMMARY_CAP }
}

// --- time --------------------------------------------------------------------

function buildTime(
  file: XerFile,
  window: DateWindow | null,
  project: { table: XerTable; row: readonly string[] } | null,
  issues: DerivedIssue[],
): DerivedTime {
  // Passed the same window as `duration_calendar_days`, deliberately — the calendar engine
  // does not derive one, so that the two fields cannot count different spans (§3.4).
  const working = durationWorkingDays(file, window)
  issues.push(...working.issues)
  return {
    start_date: window?.start ?? null,
    finish_date: window?.finish ?? null,
    // Naive local wall-clock, as written. The `.xer` records no timezone anywhere and
    // converting to UTC would invent information.
    data_date: projectField(project, 'last_recalc_date')?.trim() || null,
    duration_calendar_days: durationCalendarDays(window?.start, window?.finish),
    duration_working_days: working.value,
  }
}

// --- progress ----------------------------------------------------------------

function buildProgress(activities: readonly ActivityRow[]): DerivedProgress {
  const status_mix = countBy(activities, (row) => row.status_code)
  const complete = activities.filter((row) => row.status_code === 'TK_Complete').length
  return {
    pct_complete: pct(complete, activities.length),
    // **Derived from the data, never from a label the uploader chose** (§3.5), because it
    // decides which quality checks apply. An unprogressed tender is a baseline whatever it
    // is called, and a file with one actual start is not one however it is titled.
    is_baseline: activities.every((row) => row.act_start_date === null),
    status_mix,
  }
}

// --- logic -------------------------------------------------------------------

function buildLogic(
  activities: readonly ActivityRow[],
  relationships: readonly RelationshipRow[],
  project: { table: XerTable; row: readonly string[] } | null,
  traced: TraceResult,
): DerivedLogic {
  const ends = openEnds(activities, relationships)
  // `critical_count` must never ship without `critical_threshold_hr`: the threshold is 0 on
  // one real fixture and 168 hours on the other, so "131 critical activities" and "1,265
  // critical activities" are answers to different questions (§8.15). Absent, it is 0 — the
  // stricter reading, and the one P6 itself defaults to.
  const threshold = numberOrNull(projectField(project, 'critical_drtn_hr_cnt')) ?? 0
  const critical = activities.filter(
    (row) => row.total_float_hr_cnt !== null && row.total_float_hr_cnt <= threshold,
  ).length

  return {
    relationship_type_mix: relationshipTypeMix(relationships),
    open_ends: { no_predecessor: ends.no_predecessor, no_successor: ends.no_successor },
    external_relationship_count: relationships.filter(isExternal).length,
    critical_count: critical,
    critical_threshold_hr: threshold,
    cycle_count: traced.cycleCount,
    path_continuous: traced.pathContinuous,
    longest_path: longestPathOf(traced),
  }
}

function relationshipTypeMix(
  relationships: readonly { pred_type: string }[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const rel of relationships) out[rel.pred_type] = (out[rel.pred_type] ?? 0) + 1
  return out
}

/**
 * `TraceResult` narrowed to the contract's `longest_path`.
 *
 * **Provenance is always `computed`**, on every file including the ones where P6 exported an
 * answer of its own: a stat whose method flips per file cannot be compared across
 * programmes, and the flag is the only ground truth this project will ever have — spending
 * it as an output would spend it forever. Disagreement is an `info` entry and nothing more.
 */
export function longestPathOf(traced: TraceResult): LongestPath {
  if (traced.state !== 'ok') {
    return { state: traced.state, reason: traced.reason ?? 'the walk did not run' }
  }
  const ok: LongestPath = {
    state: 'ok',
    count: traced.members.size,
    duration_calendar_days: traced.durationCalendarDays ?? 0,
    share_of_remaining_pct: traced.shareOfRemainingPct ?? 0,
    provenance: 'computed',
  }
  return traced.truncated ? { ...ok, truncated: true } : ok
}

// --- codes -------------------------------------------------------------------

/**
 * Activity code **types**, never their values (§3.9).
 *
 * `TASKACTV` is the largest table in both real fixtures — ~14 assignments per activity in
 * one and ~6.1 in the other — and a code type with hundreds of values would dominate the
 * file, so the panel enumerates types and the values stay in the source.
 */
function buildCodes(file: XerFile, activityCount: number): DerivedCodes {
  const types = file.tables.get('ACTVTYPE')
  if (!types) return { types: [], truncated: false }
  const typeId = reader(types, 'actv_code_type_id')
  const typeName = reader(types, 'actv_code_type')

  // Values as the file **declares** them, which is what a type's size actually is; the
  // distinct assigned values are the fallback where the file carries no `ACTVCODE`.
  const declared = new Map<string, number>()
  const codes = file.tables.get('ACTVCODE')
  const codeType = codes ? reader(codes, 'actv_code_type_id') : null
  if (codes && codeType) {
    for (const row of codes.rows) {
      const key = codeType(row)
      declared.set(key, (declared.get(key) ?? 0) + 1)
    }
  }

  const assignments = file.tables.get('TASKACTV')
  const byType = new Map<string, { tasks: Set<string>; values: Set<string> }>()
  if (assignments) {
    const aType = reader(assignments, 'actv_code_type_id')
    const aTask = reader(assignments, 'task_id')
    const aCode = reader(assignments, 'actv_code_id')
    if (aType && aTask) {
      for (const row of assignments.rows) {
        const key = aType(row)
        let entry = byType.get(key)
        if (!entry) {
          entry = { tasks: new Set(), values: new Set() }
          byType.set(key, entry)
        }
        entry.tasks.add(aTask(row))
        if (aCode) entry.values.add(aCode(row))
      }
    }
  }

  const all = types.rows.map((row) => {
    const key = typeId?.(row) ?? ''
    const entry = byType.get(key)
    return {
      name: typeName?.(row) ?? '',
      value_count: declared.get(key) ?? entry?.values.size ?? 0,
      assigned_pct: pct(entry?.tasks.size ?? 0, activityCount),
    }
  })
  all.sort((a, b) => b.assigned_pct - a.assigned_pct || b.value_count - a.value_count)
  return { types: all.slice(0, CODE_TYPE_CAP), truncated: all.length > CODE_TYPE_CAP }
}

// --- the size budget ---------------------------------------------------------

/** UTF-8 bytes of the serialised object, which is what the blob store will hold. */
export function derivedBytes(derived: Derived): number {
  return new TextEncoder().encode(JSON.stringify(derived)).length
}

/**
 * The size budget (§3.11): warn above 100 KB, and above the 150 KB **hard ceiling** emit a
 * minimal object plus an `issues[]` entry rather than failing the upload.
 *
 * Every capped list exists to keep this figure flat as programme size grows — a
 * 20,000-activity file must produce a `derived.json` of the same order as a 3,000-activity
 * one — so reaching the ceiling means something uncapped got in, and the repair is to drop
 * the *lists* and keep every scalar. The page still renders; it renders without exemplars.
 */
export function withinSizeBudget(derived: Derived): Derived {
  const bytes = derivedBytes(derived)
  if (bytes <= DERIVED_WARN_BYTES) return derived
  if (bytes <= DERIVED_MAX_BYTES) {
    // A log, not an `issues[]` entry: `issues_count` drives the row's *partial* badge and a
    // large-but-valid object is not partially analysed (§6.2).
    console.warn(`derive: derived.json is ${bytes} bytes, above the ${DERIVED_WARN_BYTES} warning`)
    return derived
  }
  return minimalDerived(derived, bytes)
}

function minimalDerived(derived: Derived, bytes: number): Derived {
  return {
    ...derived,
    shape: {
      ...derived.shape,
      wbs_summary: [],
      wbs_summary_truncated: derived.shape.wbs_summary.length > 0,
    },
    quality: {
      ...derived.quality,
      // Verdicts, counts and thresholds survive; the exemplars are what grew. A check whose
      // exemplars were dropped says `truncated`, which is the same word it uses when the cap
      // dropped them — from a reader's side those are the same fact.
      checks: derived.quality.checks.map((check) => {
        const { examples, ...rest } = check
        return examples && examples.length > 0 ? { ...rest, truncated: true } : rest
      }),
    },
    distributions: {
      ...derived.distributions,
      s_curve: { ...derived.distributions.s_curve, starts: [], finishes: [], cumulative: [] },
    },
    codes: { types: [], truncated: derived.codes.types.length > 0 },
    issues: [
      ...derived.issues,
      {
        stat: 'derived',
        severity: 'warn',
        reason:
          `derived.json reached ${bytes} bytes, above the ${DERIVED_MAX_BYTES} ceiling; ` +
          'exemplars, the S-curve arrays, the WBS summary and the code types were dropped. ' +
          'The upload is unaffected — only the stat computation is degraded',
      },
    ],
  }
}

// --- fallbacks ---------------------------------------------------------------
//
// Each is a valid object of its group's shape, so a guarded failure costs the *numbers* and
// never the ability of a consumer to read the object (§3.10).

const EMPTY_SHAPE: DerivedShape = {
  activity_count: 0,
  relationship_count: 0,
  milestone_count: 0,
  wbs_depth: 0,
  wbs_node_count: 0,
  wbs_summary: [],
  wbs_summary_truncated: false,
  calendar_count: 0,
  calendars_in_use: 0,
  resource_count: 0,
  resource_assignment_count: 0,
  activity_code_type_count: 0,
}

const EMPTY_TIME: DerivedTime = {
  start_date: null,
  finish_date: null,
  data_date: null,
  duration_calendar_days: null,
  duration_working_days: { state: 'error', reason: 'the time group did not compute' },
}

const EMPTY_PROGRESS: DerivedProgress = {
  pct_complete: 0,
  is_baseline: false,
  status_mix: {},
}

const UNAVAILABLE_TRACE: TraceResult = {
  state: 'unavailable',
  reason: 'the trace did not run',
  members: new Set(),
  truncated: false,
  cycleCount: 0,
  pathContinuous: false,
  durationCalendarDays: null,
  shareOfRemainingPct: null,
  flag: { present: false, flagged: 0, agreed: 0, onlyFlag: 0, onlyComputed: 0 },
}

const EMPTY_LOGIC: DerivedLogic = {
  relationship_type_mix: {},
  open_ends: { no_predecessor: 0, no_successor: 0 },
  external_relationship_count: 0,
  critical_count: 0,
  critical_threshold_hr: 0,
  cycle_count: 0,
  path_continuous: false,
  longest_path: { state: 'error', reason: 'the logic group did not compute' },
}

const EMPTY_QUALITY: DerivedQuality = {
  standard: 'DCMA-14',
  passed: 0,
  applicable: 0,
  skipped: 14,
  checks: [],
}

const EMPTY_DISTRIBUTIONS: DerivedDistributions = {
  s_curve: { bucket: 'month', from: null, to: null, starts: [], finishes: [], cumulative: [] },
  float_histogram: { unit: 'days', edges: [], counts: [], null_count: 0 },
  duration_histogram: { unit: 'days', edges: [], counts: [] },
  activity_type_mix: {},
}

const EMPTY_CODES: DerivedCodes = { types: [], truncated: false }

export type { ActivityRow } from './activities'
