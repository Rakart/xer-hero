/**
 * The tracer's output — the seam between `derive/tracer.ts` and everything that reads a
 * driving path (§8.7).
 *
 * Two consumers, one result: `derived.json` takes `logic.longest_path`, `cycle_count` and
 * `path_continuous` from it, and `activities.json` takes its 14th column — a boolean per
 * activity, in the same order as the other columnar arrays.
 *
 * **Longest Path is not Critical.** They are different concepts with separate fields and
 * separate provenance, and conflating them is the classic P6 reporting error the product
 * must not commit. Nothing in this file touches `total_float_hr_cnt`.
 */

export interface TraceResult {
  /**
   * `ok` — the walk ran. `skip` — a 100%-complete programme. `unavailable` — remaining dates
   * are absent. `error` — a cycle. The vocabulary is §3.6's, and it is the same vocabulary
   * `time.duration_working_days` uses one field along.
   */
  state: 'ok' | 'skip' | 'unavailable' | 'error'
  /** Present on every state but `ok`. */
  reason?: string

  /** `task_id`s on the driving set. A driving path is a **set, not a chain**: ties are all kept. */
  members: ReadonlySet<number>

  /** Set where the chain reached a predecessor outside the file. Never exercised by a real export. */
  truncated: boolean

  /** A bare stat with members under the 50-exemplar cap. Deliberately not a 15th DCMA check. */
  cycleCount: number

  /** Whether the driving chain runs unbroken from the data date to the finish. */
  pathContinuous: boolean

  /**
   * Calendar days, counted inclusively, from the earliest `early_start_date` on the chain to
   * the latest `early_end_date` on it (§10.9) — the same convention and the same name as
   * `time.duration_calendar_days`, one field along. Deliberately not working days: a chain
   * crosses many activities and a working-day count needs *one* calendar to be measured on.
   */
  durationCalendarDays: number | null

  /** Members as a share of activities with work remaining. */
  shareOfRemainingPct: number | null

  /**
   * `driving_path_flag` is retained as a **validation oracle**, never as the answer —
   * a stat whose method flips per file cannot be compared across programmes. Disagreement
   * emits an `info` entry in `issues[]`, and nothing else.
   */
  flag: {
    /** Absent from the file's `%F` list entirely, which is its own kind of missing. */
    present: boolean
    flagged: number
    agreed: number
    onlyFlag: number
    onlyComputed: number
  }
}
