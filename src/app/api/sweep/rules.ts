import type { AlarmRule, SweepBreach } from '@/lib/db/schema'

/**
 * The five asymmetric rules of §5.10, as one pure function over six numbers.
 *
 * They live in app code rather than in the workflow's YAML because they are time-windowed and
 * joined — miserable in `jq` — and because the dashboard and the alarm then read **one
 * evaluated verdict** instead of two implementations that drift. `/ops` renders the latest
 * `sweep_run` verdict rather than recomputing, so the page and the alarm can never disagree.
 *
 * **Every threshold here is a guess.** 12 h, 7 d, 5-per-hour, 50%, 1 h and 24 h are reasoned
 * but unevidenced against zero traffic and no incident history. They are constants with tests
 * precisely so retuning is a reviewed commit; expect the first month of real uploads to move
 * at least one.
 */

export const THRESHOLDS = {
  /** A `takedown_report` in `open`. One is enough — nobody else is watching. */
  takedownOpenHours: 12,
  /** `awaiting_owner` is deliberately the owner's ball, so it gets its own longer clock. */
  takedownAwaitingOwnerDays: 7,
  /** Deterministic failures are near-extinct by construction, so the rule is *any*. */
  deterministicWindowHours: 24,
  transientWindowHours: 1,
  transientBurstCount: 5,
  /** The floor stops one failure out of one attempt reading as a 100% failure rate. */
  transientMinimumAttempts: 4,
  transientFailureRate: 0.5,
  /** A tombstoned revision whose bytes are still there is "hard-delete" quietly untrue. */
  reconcilerStuckHours: 1,
  quarantineGraceHours: 24,
  quarantineDays: 30,
} as const

export interface AlarmCounts {
  /** `open` past 12 h, plus `awaiting_owner` past 7 days. */
  takedownOpen: number
  deterministicFailures: number
  transientFailures: number
  transientAttempts: number
  /** Stranded tombstones plus over-age Class B quarantines. */
  reconcilerStuck: number
  /** §5.13 assertions that failed this run. */
  edgeDrift: number
}

/**
 * A rate threshold on an event that should never happen guarantees the first occurrence is
 * invisible, which is why `deterministic_failure` fires on **any**; and the sweep already
 * retries transients, so a singleton there is genuine noise. Two singletons carry more
 * information than any rate, and that asymmetry is the point of the table.
 */
export function evaluateAlarms(counts: AlarmCounts): SweepBreach[] {
  const breaches: SweepBreach[] = []
  const breach = (rule: AlarmRule, count: number) => {
    if (count > 0) breaches.push({ rule, count })
  }

  breach('takedown_open', counts.takedownOpen)
  breach('deterministic_failure', counts.deterministicFailures)

  const burst =
    counts.transientFailures >= THRESHOLDS.transientBurstCount ||
    (counts.transientAttempts >= THRESHOLDS.transientMinimumAttempts &&
      counts.transientFailures / counts.transientAttempts > THRESHOLDS.transientFailureRate)
  if (burst) breaches.push({ rule: 'transient_burst', count: counts.transientFailures })

  breach('reconciler_stuck', counts.reconcilerStuck)
  breach('edge_drift', counts.edgeDrift)

  return breaches
}

/**
 * **Cadence: red on transition, then daily** (§5.10). The sweep runs 96 times a day; a rule
 * that goes red on every run while a condition persists produces 96 mails a day for one
 * unactioned report, and a channel that cries every 15 minutes is one you filter to a folder
 * within a week — at which point the alarm is decorative and nobody decided that.
 *
 * So a rule alarms when it breaches for the first time since it last cleared, and **once per
 * 24 h** while it stays breached. "Transition only, once ever" was rejected because a mail
 * deleted half-asleep at 2 a.m. has to come back tomorrow.
 */
export function shouldAlarm(wasBreaching: boolean, lastAlarmedAt: Date | null, now: Date): boolean {
  if (!wasBreaching) return true
  if (!lastAlarmedAt) return true
  return now.getTime() - lastAlarmedAt.getTime() >= 24 * 60 * 60 * 1000
}
