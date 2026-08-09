import { describe, expect, it } from 'vitest'
import { type AlarmCounts, evaluateAlarms, shouldAlarm } from './rules'

const quiet: AlarmCounts = {
  takedownOpen: 0,
  deterministicFailures: 0,
  transientFailures: 0,
  transientAttempts: 0,
  reconcilerStuck: 0,
  edgeDrift: 0,
}

const rules = (counts: Partial<AlarmCounts>) =>
  evaluateAlarms({ ...quiet, ...counts }).map((b) => b.rule)

describe('evaluateAlarms — the five asymmetric rules (§5.10)', () => {
  it('says nothing on a quiet sweep', () => {
    expect(evaluateAlarms(quiet)).toEqual([])
  })

  it('fires `deterministic_failure` on a single occurrence', () => {
    expect(rules({ deterministicFailures: 1 })).toEqual(['deterministic_failure'])
  })

  it('fires `takedown_open` on a single case', () => {
    expect(rules({ takedownOpen: 1 })).toEqual(['takedown_open'])
  })

  it('does not fire `transient_burst` on a singleton — the sweep already retries those', () => {
    expect(rules({ transientFailures: 1, transientAttempts: 1 })).toEqual([])
  })

  it('fires `transient_burst` at five in an hour', () => {
    expect(rules({ transientFailures: 5, transientAttempts: 5 })).toEqual(['transient_burst'])
  })

  it('fires on a majority failure rate once there are at least four attempts', () => {
    expect(rules({ transientFailures: 3, transientAttempts: 4 })).toEqual(['transient_burst'])
  })

  it('holds the minimum-attempts floor, so 1-of-1 is not a 100% failure rate', () => {
    expect(rules({ transientFailures: 2, transientAttempts: 3 })).toEqual([])
  })

  it('carries the count beside the rule key', () => {
    expect(evaluateAlarms({ ...quiet, reconcilerStuck: 3 })).toEqual([
      { rule: 'reconciler_stuck', count: 3 },
    ])
  })
})

describe('shouldAlarm — red on transition, then daily (§5.10)', () => {
  const now = new Date('2026-08-09T12:00:00Z')

  it('alarms on the transition into breach', () => {
    expect(shouldAlarm(false, null, now)).toBe(true)
  })

  it('stays quiet while a breach persists inside the day', () => {
    expect(shouldAlarm(true, new Date('2026-08-09T06:00:00Z'), now)).toBe(false)
  })

  it('alarms again once a day has passed', () => {
    expect(shouldAlarm(true, new Date('2026-08-08T11:00:00Z'), now)).toBe(true)
  })

  it('alarms when a breaching rule has never alarmed', () => {
    expect(shouldAlarm(true, null, now)).toBe(true)
  })
})
