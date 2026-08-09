/**
 * `derived.json` — the contract at **v4** (§3).
 *
 * Everything above the activity table on a programme page is rendered from this object and
 * nothing recomputes on render. Typical 40–60 KB, hard ceiling 150 KB (§3.11).
 *
 * The governing rule for optionality (§3.10): **stats that always compute stay bare
 * scalars; only stats that can fail are tagged.** Wrapping `activity_count` in
 * `{value, state}` would triple the file and force every consumer to unwrap a value that
 * never fails.
 */

import type { IssueSeverity } from './xer'

export const DERIVED_VERSION = 4 as const

/** The four kinds of missing (§3.10). `ok` is the fifth state: it computed. */
export type StatState = 'ok' | 'skip' | 'unavailable' | 'error'

// --- shape ------------------------------------------------------------------

export interface WbsSummaryEntry {
  name: string
  activity_count: number
}

export interface DerivedShape {
  activity_count: number
  relationship_count: number
  /** `TT_Mile` + `TT_FinMile`. */
  milestone_count: number
  /** `1` is a correct answer, not an error — Fixture B is 3,344 activities under one node. */
  wbs_depth: number
  wbs_node_count: number
  /** First-level nodes only, capped at 20. */
  wbs_summary: WbsSummaryEntry[]
  wbs_summary_truncated: boolean
  /** A fact about the file. */
  calendar_count: number
  /** A fact about the programme. Deliberately beside, not instead of, `calendar_count`. */
  calendars_in_use: number
  resource_count: number
  resource_assignment_count: number
  activity_code_type_count: number
}

// --- time -------------------------------------------------------------------

/**
 * The calendar a working-day figure was measured on travels **inside the object with the
 * number** (§3.4) — the same rule `critical_count`/`critical_threshold_hr` follows.
 */
export interface WorkingDayCalendar {
  clndr_id: number
  name: string
  working_days_per_week: number
}

export type DurationWorkingDays =
  | {
      state?: 'ok'
      days: number
      calendar: WorkingDayCalendar
      /** Share of activities assigned to this calendar. */
      activity_share_pct: number
    }
  | { state: 'unavailable' | 'error'; reason: string }

export interface DerivedTime {
  /** Naive local wall-clock, as written. The `.xer` records no timezone anywhere. */
  start_date: string | null
  finish_date: string | null
  /** `PROJECT.last_recalc_date`. */
  data_date: string | null
  /** v4: inclusive count over `[start, finish]`. `(finish − start)/86400000 + 1`, never 0. */
  duration_calendar_days: number | null
  duration_working_days: DurationWorkingDays
}

// --- progress ---------------------------------------------------------------

export interface DerivedProgress {
  pct_complete: number
  /** Derived from the data — no activity carries an actual start — never from a label. */
  is_baseline: boolean
  status_mix: Record<string, number>
}

// --- logic ------------------------------------------------------------------

/**
 * Longest Path is **not** Critical: different concepts, separate fields, separate
 * provenance (§3.6). It is always computed even when the file carries `driving_path_flag`,
 * because a stat whose method flips per file cannot be compared across programmes.
 */
export type LongestPath =
  | {
      state: 'ok'
      count: number
      /** Calendar days, counted inclusively, over the chain's window (§10.9). */
      duration_calendar_days: number
      share_of_remaining_pct: number
      provenance: 'computed'
      /** Set where the chain reached a predecessor outside the file. */
      truncated?: boolean
    }
  | { state: 'skip' | 'unavailable' | 'error'; reason: string }

export interface DerivedLogic {
  relationship_type_mix: Record<string, number>
  open_ends: { no_predecessor: number; no_successor: number }
  external_relationship_count: number
  /** Never ships without its threshold: the two are one answer. */
  critical_count: number
  /** `PROJECT.critical_drtn_hr_cnt`. 0 on one real fixture, 168 on the other. */
  critical_threshold_hr: number
  cycle_count: number
  /** Whether the driving chain runs unbroken from the data date to the finish. */
  path_continuous: boolean
  longest_path: LongestPath
}

// --- quality ----------------------------------------------------------------

export type DcmaCheckId =
  | 'logic'
  | 'leads'
  | 'lags'
  | 'relationship_types'
  | 'hard_constraints'
  | 'high_float'
  | 'negative_float'
  | 'high_duration'
  | 'invalid_dates'
  | 'resources'
  | 'missed_tasks'
  | 'critical_path_test'
  | 'cpli'
  | 'bei'

/** Up to 50 worst-first exemplars per failing check, which is what keeps the file flat. */
export interface DcmaExemplar {
  code: string
  name: string
  value_hr?: number
  value?: number | string
}

export interface DcmaCheck {
  id: DcmaCheckId
  /** The DCMA number, 1–14. Adopted by name because planners are already audited on it. */
  num: number
  state: 'pass' | 'fail' | 'skip'
  /** Present on `skip`. Check 12 states its reason rather than being quietly omitted. */
  reason?: string
  count?: number
  pct?: number
  /** The raw threshold as text, so a check never renders as a naked verdict. */
  threshold?: string
  truncated?: boolean
  shown?: number
  examples?: DcmaExemplar[]
  /** Checks 6 and 8 record which hours-per-day they converted on (§10.10). */
  hours_per_day?: number
  hours_per_day_source?: 'programme_calendar' | 'fallback'
  /** Check 1 carries its two halves. */
  no_predecessor?: number
  no_successor?: number
}

export interface DerivedQuality {
  standard: 'DCMA-14'
  passed: number
  applicable: number
  /** Skip is not fail: a skipped check leaves both numerator and denominator. */
  skipped: number
  checks: DcmaCheck[]
}

// --- distributions ----------------------------------------------------------

export interface SCurve {
  bucket: 'month'
  from: string | null
  to: string | null
  starts: number[]
  finishes: number[]
  cumulative: number[]
}

/**
 * Buckets are **fixed, never adaptive** (§3.8). Two histograms are only comparable if they
 * share edges, and revision diff is a histogram comparison. `null` at either end of `edges`
 * is an open bound.
 */
export interface Histogram {
  unit: 'days'
  edges: (number | null)[]
  counts: number[]
  /** Float only: empty float is not zero float. 345 nulls are 345 completed activities. */
  null_count?: number
}

export interface DerivedDistributions {
  s_curve: SCurve
  float_histogram: Histogram
  duration_histogram: Histogram
  activity_type_mix: Record<string, number>
}

// --- codes ------------------------------------------------------------------

export interface CodeType {
  name: string
  value_count: number
  assigned_pct: number
}

/** Types are enumerated; values are not — one type with hundreds would dominate the file. */
export interface DerivedCodes {
  types: CodeType[]
  truncated: boolean
}

// --- issues -----------------------------------------------------------------

/** Only `error`-state stats reach the detail page's *partially analysed* banner. */
export interface DerivedIssue {
  /** Dotted path of the stat, e.g. `"time.duration_working_days"`. */
  stat: string
  severity: IssueSeverity
  reason: string
}

// --- the object -------------------------------------------------------------

export interface Derived {
  version: typeof DERIVED_VERSION
  programme_id: string
  revision_id: string
  computed_at: string
  parser_version: string
  shape: DerivedShape
  time: DerivedTime
  progress: DerivedProgress
  logic: DerivedLogic
  quality: DerivedQuality
  distributions: DerivedDistributions
  codes: DerivedCodes
  issues: DerivedIssue[]
}

/** Ingest warns above this and emits a minimal object plus an `issues[]` entry above the ceiling. */
export const DERIVED_WARN_BYTES = 100_000
export const DERIVED_MAX_BYTES = 150_000
