/**
 * The name-mapped read of the activity-shaped tables, and the `activities.json` builder
 * (§2.7, §3.12).
 *
 * **Every field here is reached through the table's own `%F` index** — `cell`/`reader`,
 * never a position. Between the 6.0 and 8.3 exports of one programme `TASK` moves from 61
 * fields to 60 and the field *order* differs, so a positional read is silently wrong on one
 * of the two with no arity mismatch to catch it. `ver-60-fieldset.xer` and
 * `ver-83-fieldset.xer` exist to make that failure loud.
 *
 * Every stat module reads `ActivityRow[]` from here rather than reaching into `XerFile`
 * itself, so the file is walked once (§2.7's "build your name→index lookup once per table
 * per file") and — more to the point — `activities.json` and `derived.json` are assembled
 * from **the same rows**. The blob the activity table fetches and the numbers printed above
 * it cannot disagree about what an activity is.
 */

import { ACTIVITIES_VERSION, type ActivitiesPayload, type WbsTuple } from '../contracts/activities'
import type { XerFile, XerTable } from '../contracts/xer'
import { reader } from '../contracts/xer'

/** A `.xer` cell as a number, or `null` where it is empty or unreadable. */
function numberOrNull(value: string | undefined): number | null {
  if (value === undefined) return null
  const text = value.trim()
  if (text === '') return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

/** A `.xer` cell as text, or `null` where the field is absent or empty (§2.7). */
function textOrNull(value: string | undefined): string | null {
  if (value === undefined) return null
  const text = value.trim()
  return text === '' ? null : text
}

/**
 * One `TASK` row, typed. Wider than `activities.json`'s cut because the stat modules need
 * `cstr_type` (DCMA 5), `clndr_id` (`calendars_in_use`), `proj_id` (the programme-calendar
 * selection) and the target dates (the window fallback) — none of which the activity table
 * renders.
 */
export interface ActivityRow {
  readonly task_id: number
  readonly task_code: string
  readonly task_name: string
  readonly wbs_id: number | null
  readonly clndr_id: string | null
  readonly proj_id: string | null
  readonly task_type: string
  readonly status_code: string
  readonly target_drtn_hr_cnt: number | null
  readonly remain_drtn_hr_cnt: number | null
  /** Null is meaningful: empty float is not zero float (§3.8). */
  readonly total_float_hr_cnt: number | null
  readonly early_start_date: string | null
  readonly early_end_date: string | null
  readonly act_start_date: string | null
  readonly act_end_date: string | null
  readonly target_start_date: string | null
  readonly target_end_date: string | null
  readonly cstr_type: string | null
  /** Retained as a validation oracle only — never an output (§3.6). */
  readonly driving_path_flag: string | null
}

/** The read's result: the rows, and what had to be dropped to get them. */
export interface ActivityRead {
  readonly rows: ActivityRow[]
  /**
   * `TASK` rows whose `task_id` does not read as a number. Such a row has no identity, so
   * nothing can join a relationship, a resource assignment or a driving flag to it, and
   * inventing an id would corrupt those joins silently. Dropped, counted, and reported as an
   * `issues[]` entry by the pipeline (§3.10) — never a rejection.
   */
  readonly unidentifiable: number
}

export function readActivities(file: XerFile): ActivityRead {
  const table = file.tables.get('TASK')
  if (!table) return { rows: [], unidentifiable: 0 }
  const get = (field: string) => reader(table, field)
  const id = get('task_id')
  const code = get('task_code')
  const name = get('task_name')
  const wbs = get('wbs_id')
  const clndr = get('clndr_id')
  const proj = get('proj_id')
  const type = get('task_type')
  const status = get('status_code')
  const targetDrtn = get('target_drtn_hr_cnt')
  const remainDrtn = get('remain_drtn_hr_cnt')
  const float = get('total_float_hr_cnt')
  const es = get('early_start_date')
  const ef = get('early_end_date')
  const as = get('act_start_date')
  const ae = get('act_end_date')
  const ts = get('target_start_date')
  const te = get('target_end_date')
  const cstr = get('cstr_type')
  const driving = get('driving_path_flag')

  const rows: ActivityRow[] = []
  let unidentifiable = 0
  for (const row of table.rows) {
    const taskId = numberOrNull(id?.(row))
    if (taskId === null) {
      unidentifiable++
      continue
    }
    rows.push({
      task_id: taskId,
      task_code: code?.(row) ?? '',
      task_name: name?.(row) ?? '',
      wbs_id: numberOrNull(wbs?.(row)),
      clndr_id: textOrNull(clndr?.(row)),
      proj_id: textOrNull(proj?.(row)),
      task_type: type?.(row) ?? '',
      status_code: status?.(row) ?? '',
      target_drtn_hr_cnt: numberOrNull(targetDrtn?.(row)),
      remain_drtn_hr_cnt: numberOrNull(remainDrtn?.(row)),
      total_float_hr_cnt: numberOrNull(float?.(row)),
      early_start_date: textOrNull(es?.(row)),
      early_end_date: textOrNull(ef?.(row)),
      act_start_date: textOrNull(as?.(row)),
      act_end_date: textOrNull(ae?.(row)),
      target_start_date: textOrNull(ts?.(row)),
      target_end_date: textOrNull(te?.(row)),
      cstr_type: textOrNull(cstr?.(row)),
      driving_path_flag: textOrNull(driving?.(row)),
    })
  }
  return { rows, unidentifiable }
}

/**
 * The instant an activity begins, preferring what actually happened.
 *
 * Actual before early before target: a completed activity's early dates are P6's leftovers
 * and its actual dates are the truth, while an activity-list export with no scheduled dates
 * at all still carries its targets. The programme window, the S-curve and both duration
 * fields all read this one accessor so they cannot measure three different windows (§3.4).
 */
export function activityStart(row: ActivityRow): string | null {
  return row.act_start_date ?? row.early_start_date ?? row.target_start_date
}

/** The instant an activity ends, on the same preference. */
export function activityFinish(row: ActivityRow): string | null {
  return row.act_end_date ?? row.early_end_date ?? row.target_end_date
}

// --- relationships -----------------------------------------------------------

/** One `TASKPRED` row, typed. `TASKPRED` is absent from real exports (§9.2) — hence `[]`. */
export interface RelationshipRow {
  readonly task_id: number | null
  readonly pred_task_id: number | null
  readonly proj_id: string | null
  readonly pred_proj_id: string | null
  readonly pred_type: string
  /** Elapsed hours as the file wrote them. A negative lag is a lead (DCMA 2). */
  readonly lag_hr_cnt: number
}

export function readRelationships(file: XerFile): RelationshipRow[] {
  const table = file.tables.get('TASKPRED')
  if (!table) return []
  const succ = reader(table, 'task_id')
  const pred = reader(table, 'pred_task_id')
  const proj = reader(table, 'proj_id')
  const predProj = reader(table, 'pred_proj_id')
  const type = reader(table, 'pred_type')
  const lag = reader(table, 'lag_hr_cnt')
  return table.rows.map((row) => ({
    task_id: numberOrNull(succ?.(row)),
    pred_task_id: numberOrNull(pred?.(row)),
    proj_id: textOrNull(proj?.(row)),
    pred_proj_id: textOrNull(predProj?.(row)),
    pred_type: type?.(row) ?? '',
    lag_hr_cnt: numberOrNull(lag?.(row)) ?? 0,
  }))
}

/**
 * A relationship whose predecessor lives in another project (§3.6).
 *
 * Legitimate, not corruption — `external-relationship.xer` exists to say so. Compared as
 * written text, because a `proj_id` is an opaque key and not an arithmetic quantity.
 */
export function isExternal(rel: RelationshipRow): boolean {
  return rel.pred_proj_id !== null && rel.proj_id !== null && rel.pred_proj_id !== rel.proj_id
}

// --- WBS ---------------------------------------------------------------------

export interface WbsNode {
  readonly wbs_id: number
  readonly parent_wbs_id: number | null
  readonly wbs_short_name: string
  readonly wbs_name: string
  /** The project node — the tree's root, and not itself a breakdown of anything. */
  readonly proj_node_flag: boolean
}

export function readWbs(file: XerFile): WbsNode[] {
  const table = file.tables.get('PROJWBS')
  if (!table) return []
  const id = reader(table, 'wbs_id')
  const parent = reader(table, 'parent_wbs_id')
  const short = reader(table, 'wbs_short_name')
  const name = reader(table, 'wbs_name')
  const projNode = reader(table, 'proj_node_flag')
  const nodes: WbsNode[] = []
  for (const row of table.rows) {
    const wbsId = numberOrNull(id?.(row))
    if (wbsId === null) continue
    nodes.push({
      wbs_id: wbsId,
      parent_wbs_id: numberOrNull(parent?.(row)),
      wbs_short_name: short?.(row) ?? '',
      wbs_name: name?.(row) ?? '',
      proj_node_flag: projNode?.(row) === 'Y',
    })
  }
  return nodes
}

/** `task_id`s carrying at least one `TASKRSRC` row — DCMA 10's numerator. */
export function readResourcedTaskIds(file: XerFile): Set<number> {
  return distinctTaskIds(file.tables.get('TASKRSRC'))
}

function distinctTaskIds(table: XerTable | undefined): Set<number> {
  const out = new Set<number>()
  if (!table) return out
  const id = reader(table, 'task_id')
  if (!id) return out
  for (const row of table.rows) {
    const n = numberOrNull(id(row))
    if (n !== null) out.add(n)
  }
  return out
}

// --- the payload -------------------------------------------------------------

/**
 * `activities.json` at v2 (§3.12) — columnar, because parallel arrays are what compresses
 * and what a virtualised table wants. 340 KB gzipped at the 20,000-activity cap.
 *
 * `driving_path` is **our** computed membership, never the file's `driving_path_flag`: a
 * stat whose method flips with how the planner happened to export cannot be compared across
 * programmes, and the flag is the only ground truth this project will ever have (§8.1).
 *
 * `TASKPRED` and `TASKACTV` are deliberately out of the cut — including both doubles the
 * file and v1 has neither a relationship view nor a code-value filter.
 */
export function buildActivities(
  rows: readonly ActivityRow[],
  wbs: readonly WbsNode[],
  driving: ReadonlySet<number>,
): ActivitiesPayload {
  const n = rows.length
  const columns = {
    task_id: new Array<number>(n),
    task_code: new Array<string>(n),
    task_name: new Array<string>(n),
    wbs_id: new Array<number | null>(n),
    task_type: new Array<string>(n),
    status_code: new Array<string>(n),
    target_drtn_hr_cnt: new Array<number | null>(n),
    remain_drtn_hr_cnt: new Array<number | null>(n),
    total_float_hr_cnt: new Array<number | null>(n),
    early_start_date: new Array<string | null>(n),
    early_end_date: new Array<string | null>(n),
    act_start_date: new Array<string | null>(n),
    act_end_date: new Array<string | null>(n),
    driving_path: new Array<boolean>(n),
  }
  for (let i = 0; i < n; i++) {
    const row = rows[i] as ActivityRow
    columns.task_id[i] = row.task_id
    columns.task_code[i] = row.task_code
    columns.task_name[i] = row.task_name
    columns.wbs_id[i] = row.wbs_id
    columns.task_type[i] = row.task_type
    columns.status_code[i] = row.status_code
    columns.target_drtn_hr_cnt[i] = row.target_drtn_hr_cnt
    columns.remain_drtn_hr_cnt[i] = row.remain_drtn_hr_cnt
    columns.total_float_hr_cnt[i] = row.total_float_hr_cnt
    columns.early_start_date[i] = row.early_start_date
    columns.early_end_date[i] = row.early_end_date
    columns.act_start_date[i] = row.act_start_date
    columns.act_end_date[i] = row.act_end_date
    columns.driving_path[i] = driving.has(row.task_id)
  }
  const tuples: WbsTuple[] = wbs.map((node) => [
    node.wbs_id,
    node.parent_wbs_id,
    node.wbs_short_name,
    node.wbs_name,
  ])
  return { version: ACTIVITIES_VERSION, activities: columns, wbs: tuples }
}
