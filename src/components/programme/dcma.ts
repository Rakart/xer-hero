/**
 * The DCMA 14-point scorecard's vocabulary and arithmetic (§3.7, §6.7).
 *
 * The governing rule, and the reason none of this is inline in the component: **a check is
 * never a naked verdict.** Every row carries a mark, a word, a value and a threshold, with
 * colour as the third channel — because pass-green against fail-red measures ΔE 4.1 under
 * deuteranopia, an all-pairs failure, and the scorecard is the page's differentiator. On
 * the shelf the printed `6/10` beside the strip is enough relief; blown up to fourteen rows
 * it is not.
 *
 * The second rule is the ratio: **`passed / applicable`, never `/14`.** Skip is not fail. A
 * tender baseline runs ten applicable checks; scoring it out of fourteen would punish it
 * for being a baseline, which is the exact reading error the standard was adopted to avoid.
 */

import type { DcmaCheck, DcmaCheckId, DerivedQuality } from '@/lib/contracts/derived'
import { formatCount, formatPct } from './format'

/** The name a planner would recognise from an audit. */
export const CHECK_LABEL: Record<DcmaCheckId, string> = {
  logic: 'Logic — open ends',
  leads: 'Leads — negative lag',
  lags: 'Lags',
  relationship_types: 'Relationship types — finish-to-start',
  hard_constraints: 'Hard constraints',
  high_float: 'High float — over 44 days',
  negative_float: 'Negative float',
  high_duration: 'High duration — over 44 days',
  invalid_dates: 'Invalid dates',
  resources: 'Resources assigned',
  missed_tasks: 'Missed tasks',
  critical_path_test: 'Critical path test',
  cpli: 'Critical path length index',
  bei: 'Baseline execution index',
}

/**
 * What the check measures, in English.
 *
 * "DCMA 4" means nothing to a planner who has not been audited recently, and being
 * explicable is the whole reason this standard was adopted rather than a score we invented.
 */
export const CHECK_MEANING: Record<DcmaCheckId, string> = {
  logic: 'activities with no predecessor or no successor',
  leads: 'relationships with negative lag — they let work start before its driver finishes',
  lags: 'relationships carrying lag instead of real activities',
  relationship_types: 'share of relationships that are finish-to-start',
  hard_constraints: 'activities pinned by must-start-on or must-finish-on',
  high_float: 'activities with more than 44 days of total float',
  negative_float: 'activities already behind their late dates',
  high_duration: 'activities longer than 44 days',
  invalid_dates: 'actual dates after the data date, or forecast dates before it',
  resources: 'activities with a resource or a cost assigned',
  missed_tasks: 'activities that finished later than the baseline said',
  critical_path_test: 'insert a 600-day delay and check the programme finish moves',
  cpli: 'critical path length index against the baseline',
  bei: 'baseline execution index against the baseline',
}

/**
 * Which population each percentage is out of. A scorecard printing `35.6%` without saying
 * *of what* is unreadable, and on the 20,000-activity fixture the two populations differ by
 * 14,000.
 */
const CHECK_BASE: Partial<Record<DcmaCheckId, 'activities' | 'relationships'>> = {
  logic: 'activities',
  leads: 'relationships',
  lags: 'relationships',
  relationship_types: 'relationships',
  hard_constraints: 'activities',
  high_float: 'activities',
  negative_float: 'activities',
  high_duration: 'activities',
  invalid_dates: 'activities',
  resources: 'activities',
}

export function checkPopulation(
  id: DcmaCheckId,
  counts: { activities: number; relationships: number },
): { size: number; unit: string } | null {
  const base = CHECK_BASE[id]
  if (!base) return null
  return { size: base === 'relationships' ? counts.relationships : counts.activities, unit: base }
}

/** `PASS` · `FAIL` · `NOT APPLICABLE`. The literal words go in the DOM, not a CSS transform. */
export function stateWord(state: DcmaCheck['state']): string {
  if (state === 'pass') return 'PASS'
  if (state === 'fail') return 'FAIL'
  return 'NOT APPLICABLE'
}

/** `✓` · `✗` · `–`. A mark, so the row survives greyscale and a screen reader gets the word. */
export function stateMark(state: DcmaCheck['state']): string {
  if (state === 'pass') return '✓'
  if (state === 'fail') return '✗'
  return '–'
}

export type Threshold =
  | { kind: 'zero' }
  | { kind: 'max'; limit: number }
  | { kind: 'min'; limit: number }
  | null

/** The three shapes DCMA 1–10 write: `<=5%`, `>=90%`, `0`. Anything else parses to null. */
export function parseThreshold(threshold: string | undefined): Threshold {
  if (!threshold) return null
  if (threshold.trim() === '0') return { kind: 'zero' }
  const match = /^(<=|>=|≤|≥)\s*([\d.]+)%$/.exec(threshold.trim())
  if (!match) return null
  const limit = Number(match[2])
  if (!Number.isFinite(limit)) return null
  return { kind: match[1] === '<=' || match[1] === '≤' ? 'max' : 'min', limit }
}

/** The count a check is about: its own, or check 1's two halves added together. */
export function checkCount(check: DcmaCheck): number | undefined {
  if (check.count !== undefined) return check.count
  if (check.no_predecessor !== undefined && check.no_successor !== undefined) {
    return check.no_predecessor + check.no_successor
  }
  return undefined
}

/** The value cell: the number the threshold is about. `—` where the check is skipped. */
export function checkValue(check: DcmaCheck): string {
  if (check.state === 'skip') return '—'
  if (check.pct !== undefined) return `${formatPct(check.pct)}%`
  const count = checkCount(check)
  return count === undefined ? '—' : formatCount(count)
}

/**
 * The margin, in words and numbers — the channel that survives greyscale and deuteranopia.
 *
 * It exists because Fixture B misses check 4 by half a percentage point: `FAIL` alone hides
 * that 89.5% is one bad relationship away from a pass, and `FAIL` alone on check 6 hides
 * that 75.7% is fifteen times the limit. Those are different programmes.
 */
export function marginSentence(check: DcmaCheck): string | null {
  const threshold = parseThreshold(check.threshold)
  if (!threshold || check.state === 'skip') return null

  if (threshold.kind === 'zero') {
    if (check.state === 'pass') return 'none, which is what the standard allows'
    const count = checkCount(check)
    return `${formatCount(count ?? 0)} where the standard allows none`
  }
  if (check.pct === undefined) return null

  if (threshold.kind === 'max') {
    return check.state === 'pass'
      ? `${formatPct(threshold.limit - check.pct)} points under the ${threshold.limit}% limit`
      : `${(check.pct / threshold.limit).toFixed(1)}× the ${threshold.limit}% limit`
  }
  return check.state === 'pass'
    ? `${formatPct(check.pct - threshold.limit)} points over the ${threshold.limit}% floor`
    : `${formatPct(threshold.limit - check.pct)} points short of the ${threshold.limit}% floor`
}

/**
 * The verdict sentence, adopted from the rejected *Verdict* layout — the one element it
 * contributed. It names the failing checks and their values, never a grade.
 */
export function verdictSentence(quality: DerivedQuality): string {
  const failing = quality.checks.filter((check) => check.state === 'fail')
  if (quality.applicable === 0) {
    return 'None of the 14 checks applies to this file, so there is no ratio to report.'
  }
  if (failing.length === 0) {
    return `This programme passes all ${quality.applicable} of the checks that apply to it.`
  }
  const clauses = failing
    .map((check) => `${shortLabel(check.id)} at ${checkValue(check)}`)
    .join(', ')
  return `This programme fails ${failing.length} of the ${quality.applicable} checks that apply to it: ${clauses}.`
}

/** `High float — over 44 days` → `high float`. The clause form the verdict sentence uses. */
export function shortLabel(id: DcmaCheckId): string {
  const label = CHECK_LABEL[id]
  const head = label.split(' — ')[0] ?? label
  return head.toLowerCase()
}

/**
 * The sentence beside the hero ratio. Both sides of the ratio exclude the skipped checks,
 * and saying so is not an aside: a reader who assumes a denominator of 14 reads 6/10 as
 * eight failures.
 */
export function ratioSentence(quality: DerivedQuality): string {
  if (quality.skipped === 0) {
    return `All 14 checks apply to this file, so the ratio is out of 14.`
  }
  return (
    `${quality.skipped} of the 14 checks are not applicable to this file and are excluded ` +
    `from both sides of the ratio — a baseline scored out of 14 would be punished for being ` +
    `a baseline.`
  )
}

/**
 * Which failing checks can hand their whole population to the activity table.
 *
 * This is narrower than "every failing check", and the reason is the payload cut rather
 * than effort: `activities.json` is 13 `TASK` columns plus the WBS tree (§3.12), so a
 * predicate over float or duration is expressible client-side and a predicate over
 * relationships, constraints or resources is not — `TASKPRED` and `TASKACTV` are out of the
 * cut, and putting them in doubles the largest object the site serves. The exemplar list
 * remains the answer for those checks; the deep link is only offered where it is real.
 */
export type ActivityFilterId = 'high_float' | 'negative_float' | 'high_duration'

const TABLE_FILTERS: Record<string, ActivityFilterId> = {
  high_float: 'high_float',
  negative_float: 'negative_float',
  high_duration: 'high_duration',
}

export function activityFilterFor(id: DcmaCheckId): ActivityFilterId | null {
  return TABLE_FILTERS[id] ?? null
}

/** The 14-cell compact strip. It never renders without its printed ratio beside it. */
export function stripCells(quality: DerivedQuality): DcmaCheck['state'][] {
  const byNum = new Map(quality.checks.map((check) => [check.num, check.state]))
  return Array.from({ length: 14 }, (_, index) => byNum.get(index + 1) ?? 'skip')
}
