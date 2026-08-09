/**
 * `activities.json` — the contract at **v2** (§3.12).
 *
 * Columnar: parallel arrays, one entry per activity, because that is what compresses and
 * what a virtualised table wants. 340 KB gzipped at the 20,000-activity cap.
 *
 * `TASKPRED` and `TASKACTV` are deliberately **out of the cut** — including both doubles the
 * file, and v1 has no relationship view and no code-value filter. Adding a Gantt later is an
 * additive block on the same object rather than a re-cut.
 *
 * Fetched lazily on approach to the activity table; a visitor who never scrolls there never
 * pays for it.
 */

export const ACTIVITIES_VERSION = 2 as const

/**
 * Dates are strings exactly as the file wrote them — naive local wall-clock — or `null`
 * where the cell was empty. Nothing is converted to UTC: the `.xer` records no timezone and
 * inventing one would invent information.
 */
export type NaiveDate = string | null

export interface ActivityColumns {
  task_id: number[]
  task_code: string[]
  task_name: string[]
  wbs_id: (number | null)[]
  task_type: string[]
  status_code: string[]
  target_drtn_hr_cnt: (number | null)[]
  remain_drtn_hr_cnt: (number | null)[]
  /** Null is meaningful: empty float is not zero float. */
  total_float_hr_cnt: (number | null)[]
  early_start_date: NaiveDate[]
  early_end_date: NaiveDate[]
  act_start_date: NaiveDate[]
  act_end_date: NaiveDate[]
  /** v2: our own computed driving-path membership, not the file's flag. */
  driving_path: boolean[]
}

/** `[wbs_id, parent_wbs_id, wbs_short_name, wbs_name]` — a tuple, to keep the file small. */
export type WbsTuple = [number, number | null, string, string]

export interface ActivitiesPayload {
  version: typeof ACTIVITIES_VERSION
  activities: ActivityColumns
  wbs: WbsTuple[]
}

/** Every column name, so a builder cannot forget one and still typecheck. */
export const ACTIVITY_COLUMNS = [
  'task_id',
  'task_code',
  'task_name',
  'wbs_id',
  'task_type',
  'status_code',
  'target_drtn_hr_cnt',
  'remain_drtn_hr_cnt',
  'total_float_hr_cnt',
  'early_start_date',
  'early_end_date',
  'act_start_date',
  'act_end_date',
  'driving_path',
] as const satisfies readonly (keyof ActivityColumns)[]
