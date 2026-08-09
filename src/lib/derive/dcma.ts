/**
 * The DCMA 14-point scorecard (§3.7) — the differentiator, because nobody else surfaces
 * schedule quality at a glance.
 *
 * Three rules govern everything below, and each of them is a decision that would otherwise
 * be simplified away by a future reader:
 *
 * - **Quality surfaces as checks passed / applicable, never a composite score.** A score we
 *   invented would be both contestable and uncomparable between a baseline and a progressed
 *   update. DCMA 14-point is adopted *by name*: planners are already audited against it, the
 *   thresholds are external and defensible, and it costs no credibility to say "this fails
 *   DCMA check 4."
 * - **Skip is not fail.** A skipped check leaves **both** numerator and denominator, so a
 *   tender baseline runs 10 applicable checks rather than being reported as "5/14" and
 *   penalised for being a baseline. Check 12 is stated as `skip` **with its reason** rather
 *   than quietly omitted, because a missing row and an inapplicable one read the same on a
 *   page and mean opposite things.
 * - **Every check ships its raw value and its threshold, never a naked verdict.** One real
 *   fixture misses check 4 by half a percentage point — 89.5% against a 90% floor — and a
 *   verdict that fine is unreadable without the number that produced it.
 *
 * Failing checks carry the exact count plus up to 50 worst-first exemplars with
 * `truncated: true` beyond. That cap is what keeps a 20,000-activity file's `derived.json`
 * the same order of size as a 3,000-activity one: **uncapped lists would make the worst
 * programmes generate the biggest files**, which is backwards. The full list is one
 * client-side filter away, because the activity table already holds every row (§6.3).
 */

import type { DcmaCheck, DcmaExemplar, DerivedQuality } from '../contracts/derived'
import { EXEMPLAR_CAP } from '../contracts/domain'
import type { ActivityRow, RelationshipRow } from './activities'
import { dayNumber } from './dates'
import { type HoursPerDay, highThresholdHours } from './float'

/**
 * Constraints DCMA counts as **hard** — the ones that stop an activity being driven by its
 * logic in the direction the schedule needs to move.
 *
 * The mandatory pair and the two "on" constraints pin a date outright; the two "or before"
 * constraints cap an activity's late movement, which is the same defect one step softer and
 * is how the standard's auditors score them. `CS_MSOA` / `CS_MEOA` ("or after") only floor
 * the early dates and are **soft**, as is `CS_ALAP`.
 *
 * The list is what has been *observed* and may never be treated as closed (§2.4): a
 * constraint value nobody here has seen is counted as soft rather than made a rejection.
 */
export const HARD_CONSTRAINT_TYPES: readonly string[] = [
  'CS_MANDSTART',
  'CS_MANDFIN',
  'CS_MSO',
  'CS_MEO',
  'CS_MSOB',
  'CS_MEOB',
]

/** Relationship types, per §2.4 — `PR_FS` is the one DCMA 4 wants at 90% or better. */
const FS = 'PR_FS'

export interface DcmaInput {
  readonly activities: readonly ActivityRow[]
  readonly relationships: readonly RelationshipRow[]
  /** `PROJECT.last_recalc_date`. Check 9 has nothing to measure against without it. */
  readonly dataDate: string | null
  /** §10.10's conversion, with the provenance checks 6 and 8 are required to record. */
  readonly hoursPerDay: HoursPerDay
  /** `task_id`s carrying at least one `TASKRSRC` row. */
  readonly resourced: ReadonlySet<number>
}

/** One decimal place, which is the resolution every published DCMA figure is quoted at. */
function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

/**
 * Up to 50 worst-first exemplars (§3.7).
 *
 * `rank` is *worseness*, descending — so a caller passes the float itself for "highest float
 * first" and its negation for "most negative first", and the direction is stated at the call
 * site where the reader can see which end of the distribution is the bad one.
 */
function exemplars<T>(
  items: readonly T[],
  rank: (item: T) => number,
  make: (item: T) => DcmaExemplar,
): Pick<DcmaCheck, 'examples' | 'shown' | 'truncated'> {
  const ordered = [...items].sort((a, b) => rank(b) - rank(a)).slice(0, EXEMPLAR_CAP)
  return {
    examples: ordered.map(make),
    shown: ordered.length,
    truncated: items.length > EXEMPLAR_CAP,
  }
}

const skip = (id: DcmaCheck['id'], num: number, reason: string, threshold: string): DcmaCheck => ({
  id,
  num,
  state: 'skip',
  reason,
  threshold,
})

const NO_ACTIVITIES = 'the file carries no activities'
const NO_RELATIONSHIPS = 'the file carries no relationships'
const NO_BASELINE = 'the file carries no baseline tables'

/**
 * The open ends of the logic network — DCMA 1's two halves, and `logic.open_ends`.
 *
 * Computed here and read twice so the scorecard and the logic block cannot disagree about
 * how many activities dangle. An activity is open at an end when **no relationship in the
 * file** names it there; a relationship whose predecessor lives outside the file still
 * closes its successor's front end, because the successor genuinely has a predecessor —
 * `external-relationship.xer` exists to hold that line (§3.6).
 */
export interface OpenEnds {
  readonly no_predecessor: number
  readonly no_successor: number
  readonly missingPredecessor: ReadonlySet<number>
  readonly missingSuccessor: ReadonlySet<number>
}

export function openEnds(
  activities: readonly ActivityRow[],
  relationships: readonly RelationshipRow[],
): OpenEnds {
  const hasPredecessor = new Set<number>()
  const hasSuccessor = new Set<number>()
  for (const rel of relationships) {
    if (rel.task_id !== null) hasPredecessor.add(rel.task_id)
    if (rel.pred_task_id !== null) hasSuccessor.add(rel.pred_task_id)
  }
  const missingPredecessor = new Set<number>()
  const missingSuccessor = new Set<number>()
  for (const row of activities) {
    if (!hasPredecessor.has(row.task_id)) missingPredecessor.add(row.task_id)
    if (!hasSuccessor.has(row.task_id)) missingSuccessor.add(row.task_id)
  }
  return {
    no_predecessor: missingPredecessor.size,
    no_successor: missingSuccessor.size,
    missingPredecessor,
    missingSuccessor,
  }
}

/**
 * The scorecard.
 *
 * Ten checks are computable from a lone `.xer`; four are not and say so. 11, 13 and 14 want
 * baseline tables no v1 file carries, and 12 wants a scheduling engine — the 600-day-delay
 * test — so it is **permanently** skipped and what it is *for* ships instead as
 * `logic.path_continuous`, outside the ratio. A fifteenth check would make
 * `checks_passed / checks_applicable` incomparable with every published DCMA number (§8.1).
 */
export function dcmaScorecard(input: DcmaInput): DerivedQuality {
  const { activities, relationships, dataDate, hoursPerDay, resourced } = input
  const nActivities = activities.length
  const nRelationships = relationships.length
  const highHours = highThresholdHours(hoursPerDay)

  const checks: DcmaCheck[] = [
    check1Logic(activities, relationships, nActivities),
    check2Leads(relationships, nRelationships),
    check3Lags(relationships, nRelationships),
    check4RelationshipTypes(relationships, nRelationships),
    check5HardConstraints(activities, nActivities),
    check6HighFloat(activities, nActivities, highHours, hoursPerDay),
    check7NegativeFloat(activities, nActivities),
    check8HighDuration(activities, nActivities, highHours, hoursPerDay),
    check9InvalidDates(activities, nActivities, dataDate),
    check10Resources(activities, nActivities, resourced),
    skip('missed_tasks', 11, NO_BASELINE, '<=5%'),
    // Not "unimplemented": the 600-day-delay test needs a scheduling engine, and stating
    // the reason is the difference between an inapplicable check and a missing one (§3.10).
    skip('critical_path_test', 12, 'the test needs a scheduling engine', '—'),
    skip('cpli', 13, NO_BASELINE, '>=0.95'),
    skip('bei', 14, NO_BASELINE, '>=0.95'),
  ]

  const applicable = checks.filter((c) => c.state !== 'skip')
  return {
    standard: 'DCMA-14',
    passed: applicable.filter((c) => c.state === 'pass').length,
    applicable: applicable.length,
    skipped: checks.length - applicable.length,
    checks,
  }
}

// --- 1. Logic (open ends) ----------------------------------------------------

/**
 * `pct` is the **worse of the two halves**, not their mean.
 *
 * The contract's own worked example is 42 activities with no predecessor and 110 with no
 * successor over 3,344 — 1.3% and 3.3% — and it prints `pct: 3.3`. A mean would print 2.3
 * and let a programme with one clean end hide a broken other end under the 5% floor. Both
 * halves ship beside it so the reader can see which end is open.
 *
 * `count` is the **union** — activities open at either end, which is the list the exemplars
 * come from and the number the page's "open all N in the activity table" link applies to. It
 * is deliberately not `no_predecessor + no_successor`: an activity open at both ends is one
 * activity to fix, not two.
 */
function check1Logic(
  activities: readonly ActivityRow[],
  relationships: readonly RelationshipRow[],
  nActivities: number,
): DcmaCheck {
  if (nActivities === 0) return skip('logic', 1, NO_ACTIVITIES, '<=5%')
  const ends = openEnds(activities, relationships)
  const worst = Math.max(pct(ends.no_predecessor, nActivities), pct(ends.no_successor, nActivities))
  const open = activities.filter(
    (row) => ends.missingPredecessor.has(row.task_id) || ends.missingSuccessor.has(row.task_id),
  )
  const state = worst <= 5 ? 'pass' : 'fail'
  return {
    id: 'logic',
    num: 1,
    state,
    no_predecessor: ends.no_predecessor,
    no_successor: ends.no_successor,
    count: open.length,
    pct: worst,
    threshold: '<=5%',
    // Worst first is both ends open, which is the activity a planner fixes first.
    ...(state === 'fail'
      ? exemplars(
          open,
          (row) =>
            (ends.missingPredecessor.has(row.task_id) ? 1 : 0) +
            (ends.missingSuccessor.has(row.task_id) ? 1 : 0),
          (row) => ({
            code: row.task_code,
            name: row.task_name,
            value: openEndLabel(
              ends.missingPredecessor.has(row.task_id),
              ends.missingSuccessor.has(row.task_id),
            ),
          }),
        )
      : {}),
  }
}

function openEndLabel(noPredecessor: boolean, noSuccessor: boolean): string {
  if (noPredecessor && noSuccessor) return 'no predecessor, no successor'
  return noPredecessor ? 'no predecessor' : 'no successor'
}

// --- 2. Leads, 3. Lags, 4. Relationship types --------------------------------

/**
 * A lead is a **negative** lag, and the threshold is zero — one lead fails the check.
 *
 * The exemplar names the *successor*, because that is the activity a planner opens to find
 * the relationship; the lead itself lives on the edge and has no code of its own.
 */
function check2Leads(relationships: readonly RelationshipRow[], nRelationships: number): DcmaCheck {
  if (nRelationships === 0) return skip('leads', 2, NO_RELATIONSHIPS, '0')
  const leads = relationships.filter((rel) => rel.lag_hr_cnt < 0)
  const state = leads.length === 0 ? 'pass' : 'fail'
  return {
    id: 'leads',
    num: 2,
    state,
    count: leads.length,
    pct: pct(leads.length, nRelationships),
    threshold: '0',
    ...(state === 'fail'
      ? exemplars(
          leads,
          (rel) => -rel.lag_hr_cnt, // most negative lag first
          (rel) => ({
            code: String(rel.task_id ?? ''),
            name: `${rel.pred_type} from ${rel.pred_task_id ?? '?'}`,
            value_hr: rel.lag_hr_cnt,
          }),
        )
      : {}),
  }
}

function check3Lags(relationships: readonly RelationshipRow[], nRelationships: number): DcmaCheck {
  if (nRelationships === 0) return skip('lags', 3, NO_RELATIONSHIPS, '<=5%')
  const lags = relationships.filter((rel) => rel.lag_hr_cnt > 0)
  const share = pct(lags.length, nRelationships)
  const state = share <= 5 ? 'pass' : 'fail'
  return {
    id: 'lags',
    num: 3,
    state,
    count: lags.length,
    pct: share,
    threshold: '<=5%',
    ...(state === 'fail'
      ? exemplars(
          lags,
          (rel) => rel.lag_hr_cnt, // longest lag first
          (rel) => ({
            code: String(rel.task_id ?? ''),
            name: `${rel.pred_type} from ${rel.pred_task_id ?? '?'}`,
            value_hr: rel.lag_hr_cnt,
          }),
        )
      : {}),
  }
}

/**
 * Finish-to-start share, floor 90% — the check one real tender misses by half a point.
 *
 * No exemplars: the failure is a ratio over the whole network and a list of non-FS edges has
 * no worst-first ordering to offer, so 50 arbitrary rows would cost bytes and say nothing.
 */
function check4RelationshipTypes(
  relationships: readonly RelationshipRow[],
  nRelationships: number,
): DcmaCheck {
  if (nRelationships === 0) return skip('relationship_types', 4, NO_RELATIONSHIPS, '>=90%')
  const fs = relationships.filter((rel) => rel.pred_type === FS).length
  const share = pct(fs, nRelationships)
  return {
    id: 'relationship_types',
    num: 4,
    state: share >= 90 ? 'pass' : 'fail',
    count: nRelationships - fs,
    pct: share,
    threshold: '>=90%',
  }
}

// --- 5. Hard constraints -----------------------------------------------------

function check5HardConstraints(activities: readonly ActivityRow[], nActivities: number): DcmaCheck {
  if (nActivities === 0) return skip('hard_constraints', 5, NO_ACTIVITIES, '<=5%')
  const hard = activities.filter(
    (row) => row.cstr_type !== null && HARD_CONSTRAINT_TYPES.includes(row.cstr_type),
  )
  const share = pct(hard.length, nActivities)
  const state = share <= 5 ? 'pass' : 'fail'
  return {
    id: 'hard_constraints',
    num: 5,
    state,
    count: hard.length,
    pct: share,
    threshold: '<=5%',
    // No ordering is worse than another here, so file order stands and the exemplar carries
    // the constraint type — which is the fact a planner needs to decide whether to remove it.
    ...(state === 'fail'
      ? exemplars(
          hard,
          () => 0,
          (row) => ({ code: row.task_code, name: row.task_name, value: row.cstr_type ?? '' }),
        )
      : {}),
  }
}

// --- 6. High float, 7. Negative float ----------------------------------------

/**
 * Float above 44 days, converted on the programme calendar (§10.10).
 *
 * **Null float is not zero float and is not high float either** — it is absent, so it leaves
 * the numerator without joining the denominator's other bands. The activity still counts in
 * the denominator, because DCMA 6 is a share of *activities* and a programme that stopped
 * reporting float on half its rows has not thereby passed.
 */
function check6HighFloat(
  activities: readonly ActivityRow[],
  nActivities: number,
  highHours: number,
  day: HoursPerDay,
): DcmaCheck {
  if (nActivities === 0) return skip('high_float', 6, NO_ACTIVITIES, '<=5%')
  const high = activities.filter(
    (row) => row.total_float_hr_cnt !== null && row.total_float_hr_cnt > highHours,
  )
  const share = pct(high.length, nActivities)
  const state = share <= 5 ? 'pass' : 'fail'
  return {
    id: 'high_float',
    num: 6,
    state,
    count: high.length,
    pct: share,
    threshold: '<=5%',
    hours_per_day: day.hours,
    hours_per_day_source: day.source,
    ...(state === 'fail'
      ? exemplars(
          high,
          (row) => row.total_float_hr_cnt ?? 0, // most float first
          (row) => ({
            code: row.task_code,
            name: row.task_name,
            value_hr: row.total_float_hr_cnt ?? 0,
          }),
        )
      : {}),
  }
}

/** Negative float, threshold zero. One negative-float activity fails the check. */
function check7NegativeFloat(activities: readonly ActivityRow[], nActivities: number): DcmaCheck {
  if (nActivities === 0) return skip('negative_float', 7, NO_ACTIVITIES, '0')
  const negative = activities.filter(
    (row) => row.total_float_hr_cnt !== null && row.total_float_hr_cnt < 0,
  )
  const state = negative.length === 0 ? 'pass' : 'fail'
  return {
    id: 'negative_float',
    num: 7,
    state,
    count: negative.length,
    pct: pct(negative.length, nActivities),
    threshold: '0',
    ...(state === 'fail'
      ? exemplars(
          negative,
          (row) => -(row.total_float_hr_cnt ?? 0), // most negative first
          (row) => ({
            code: row.task_code,
            name: row.task_name,
            value_hr: row.total_float_hr_cnt ?? 0,
          }),
        )
      : {}),
  }
}

// --- 8. High duration --------------------------------------------------------

/**
 * Original duration above 44 days — `target_drtn_hr_cnt`, the same column the duration
 * histogram buckets, converted on the same day length so the chart and the check agree.
 */
function check8HighDuration(
  activities: readonly ActivityRow[],
  nActivities: number,
  highHours: number,
  day: HoursPerDay,
): DcmaCheck {
  if (nActivities === 0) return skip('high_duration', 8, NO_ACTIVITIES, '<=5%')
  const long = activities.filter((row) => (row.target_drtn_hr_cnt ?? 0) > highHours)
  const share = pct(long.length, nActivities)
  const state = share <= 5 ? 'pass' : 'fail'
  return {
    id: 'high_duration',
    num: 8,
    state,
    count: long.length,
    pct: share,
    threshold: '<=5%',
    hours_per_day: day.hours,
    hours_per_day_source: day.source,
    ...(state === 'fail'
      ? exemplars(
          long,
          (row) => row.target_drtn_hr_cnt ?? 0, // longest first
          (row) => ({
            code: row.task_code,
            name: row.task_name,
            value_hr: row.target_drtn_hr_cnt ?? 0,
          }),
        )
      : {}),
  }
}

// --- 9. Invalid dates --------------------------------------------------------

/**
 * Dates on the wrong side of the data date, threshold zero.
 *
 * Two directions, both of which are a statement about time that cannot be true:
 *
 * - an **actual** date after the data date — work recorded as having happened after *now*;
 * - a **remaining** date before it — work still to do, scheduled in the past.
 *
 * A completed activity is exempt from the second: P6 leaves its early dates behind as
 * historical leftovers, and reading those as forecasts would fail every progressed
 * programme in the corpus for the crime of having finished something.
 *
 * Skipped — not failed and not silently passed — where the file names no data date, because
 * an absent `PROJECT.last_recalc_date` makes the question unanswerable rather than answered
 * in our favour (§3.10).
 */
function check9InvalidDates(
  activities: readonly ActivityRow[],
  nActivities: number,
  dataDate: string | null,
): DcmaCheck {
  if (nActivities === 0) return skip('invalid_dates', 9, NO_ACTIVITIES, '0')
  const dd = dayNumber(dataDate)
  if (dd === null) {
    return skip('invalid_dates', 9, 'the file names no data date to measure dates against', '0')
  }

  const offenders: { row: ActivityRow; reason: string }[] = []
  for (const row of activities) {
    const reason = invalidDateReason(row, dd)
    if (reason) offenders.push({ row, reason })
  }
  const state = offenders.length === 0 ? 'pass' : 'fail'
  return {
    id: 'invalid_dates',
    num: 9,
    state,
    count: offenders.length,
    pct: pct(offenders.length, nActivities),
    threshold: '0',
    ...(state === 'fail'
      ? exemplars(
          offenders,
          () => 0,
          (o) => ({ code: o.row.task_code, name: o.row.task_name, value: o.reason }),
        )
      : {}),
  }
}

function invalidDateReason(row: ActivityRow, dataDate: number): string | null {
  const after = (date: string | null): boolean => {
    const d = dayNumber(date)
    return d !== null && d > dataDate
  }
  const before = (date: string | null): boolean => {
    const d = dayNumber(date)
    return d !== null && d < dataDate
  }
  if (after(row.act_start_date)) return 'actual start after the data date'
  if (after(row.act_end_date)) return 'actual finish after the data date'
  if (row.status_code === 'TK_Complete') return null
  // A started activity's early start is history; only what remains has to be in the future.
  if (row.status_code !== 'TK_Active' && before(row.early_start_date)) {
    return 'remaining start before the data date'
  }
  if (before(row.early_end_date)) return 'remaining finish before the data date'
  return null
}

// --- 10. Resources -----------------------------------------------------------

/**
 * The share of activities carrying a resource assignment.
 *
 * DCMA states **no threshold** for this one, so it is reported rather than scored: it holds
 * its place in `applicable` — the published ratio is out of ten and the two real fixtures
 * score 5/10 and 8/10 against exactly this check set — and it prints its percentage with an
 * em dash where a threshold would go, so nothing renders as a verdict we did not make.
 */
function check10Resources(
  activities: readonly ActivityRow[],
  nActivities: number,
  resourced: ReadonlySet<number>,
): DcmaCheck {
  if (nActivities === 0) return skip('resources', 10, NO_ACTIVITIES, '—')
  const count = activities.filter((row) => resourced.has(row.task_id)).length
  return {
    id: 'resources',
    num: 10,
    state: 'pass',
    count,
    pct: pct(count, nActivities),
    threshold: '—',
  }
}
