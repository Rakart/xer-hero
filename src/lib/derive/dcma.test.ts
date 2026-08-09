import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { DcmaCheck, DcmaCheckId } from '../contracts/derived'
import { EXEMPLAR_CAP } from '../contracts/domain'
import { parseXer } from '../xer'
import type { ActivityRow, RelationshipRow } from './activities'
import { readActivities, readRelationships, readResourcedTaskIds } from './activities'
import { type DcmaInput, dcmaScorecard, HARD_CONSTRAINT_TYPES, openEnds } from './dcma'
import type { HoursPerDay } from './float'
import { hoursPerDay } from './float'

const CORPUS = fileURLToPath(new URL('../../../fixtures/synthetic/corpus/', import.meta.url))
const fixture = (name: string) => parseXer(readFileSync(`${CORPUS}${name}.xer`))

const EIGHT: HoursPerDay = { hours: 8, source: 'programme_calendar' }

let nextId = 1
function activity(partial: Partial<ActivityRow> = {}): ActivityRow {
  const id = nextId++
  return {
    task_id: id,
    task_code: `A${String(id).padStart(5, '0')}`,
    task_name: 'Activity',
    wbs_id: null,
    clndr_id: null,
    proj_id: '1',
    task_type: 'TT_Task',
    status_code: 'TK_NotStart',
    target_drtn_hr_cnt: 8,
    remain_drtn_hr_cnt: 8,
    total_float_hr_cnt: 0,
    early_start_date: '2026-01-05 08:00',
    early_end_date: '2026-01-05 16:00',
    act_start_date: null,
    act_end_date: null,
    target_start_date: null,
    target_end_date: null,
    cstr_type: null,
    driving_path_flag: null,
    ...partial,
  }
}

function relationship(partial: Partial<RelationshipRow> = {}): RelationshipRow {
  return {
    task_id: 2,
    pred_task_id: 1,
    proj_id: '1',
    pred_proj_id: '1',
    pred_type: 'PR_FS',
    lag_hr_cnt: 0,
    ...partial,
  }
}

/** A network with no open ends, so a test can move one variable at a time. */
function closedChain(n: number, make: (i: number) => Partial<ActivityRow> = () => ({})) {
  const activities = Array.from({ length: n }, (_, i) => activity(make(i)))
  const relationships: RelationshipRow[] = []
  for (let i = 1; i < n; i++) {
    relationships.push(
      relationship({
        pred_task_id: activities[i - 1]?.task_id ?? 0,
        task_id: activities[i]?.task_id ?? 0,
      }),
    )
  }
  // Close the two ends the chain leaves open, so DCMA 1 is not the thing under test.
  relationships.push(
    relationship({
      pred_task_id: activities[n - 1]?.task_id ?? 0,
      task_id: activities[0]?.task_id ?? 0,
    }),
  )
  return { activities, relationships }
}

function score(partial: Partial<DcmaInput> = {}) {
  const base: DcmaInput = {
    activities: [],
    relationships: [],
    dataDate: '2026-01-05 08:00',
    hoursPerDay: EIGHT,
    resourced: new Set<number>(),
    ...partial,
  }
  return dcmaScorecard(base)
}

const find = (checks: DcmaCheck[], id: DcmaCheckId): DcmaCheck => {
  const check = checks.find((c) => c.id === id)
  if (!check) throw new Error(`no check ${id}`)
  return check
}

describe('the scorecard as a whole', () => {
  const { activities, relationships } = closedChain(20)
  const quality = score({ activities, relationships })

  it('is DCMA-14 by name, with all fourteen checks present', () => {
    expect(quality.standard).toBe('DCMA-14')
    expect(quality.checks).toHaveLength(14)
    expect(quality.checks.map((c) => c.num)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ])
  })

  it('skips four and scores ten — skip is not fail', () => {
    // A tender baseline runs 10 applicable checks rather than being reported as "5/14" and
    // penalised for being a baseline. The skipped four leave *both* sides of the ratio.
    expect(quality.applicable).toBe(10)
    expect(quality.skipped).toBe(4)
    expect(quality.passed + quality.checks.filter((c) => c.state === 'fail').length).toBe(10)
  })

  it('states check 12 as a skip with its reason, never omitting it', () => {
    const twelve = find(quality.checks, 'critical_path_test')
    expect(twelve.state).toBe('skip')
    expect(twelve.reason).toMatch(/scheduling engine/)
  })

  it('skips 11, 13 and 14 for want of baseline tables', () => {
    for (const id of ['missed_tasks', 'cpli', 'bei'] as const) {
      const check = find(quality.checks, id)
      expect.soft(check.state, id).toBe('skip')
      expect.soft(check.reason, id).toMatch(/baseline/)
    }
  })

  it('never ships a naked verdict: every check carries its threshold', () => {
    // One real fixture misses check 4 by half a percentage point — 89.5% against a 90%
    // floor — and a verdict that fine is unreadable without the number that produced it.
    for (const check of quality.checks) {
      expect.soft(check.threshold, `check ${check.num}`).toBeTruthy()
      if (check.state !== 'skip') expect.soft(check.pct, `check ${check.num}`).toBeTypeOf('number')
    }
  })

  it('gives a reason on every skip and on no pass or fail', () => {
    for (const check of quality.checks) {
      if (check.state === 'skip') expect.soft(check.reason, `check ${check.num}`).toBeTruthy()
      else expect.soft(check.reason, `check ${check.num}`).toBeUndefined()
    }
  })
})

describe('check 1 — logic', () => {
  it('reports the worse of the two halves, not their mean', () => {
    // The contract's worked example: 42 with no predecessor and 110 with no successor over
    // 3,344 — 1.3% and 3.3% — and it prints `pct: 3.3`. A mean would print 2.3 and let a
    // programme with one clean end hide a broken other end under the 5% floor.
    const activities = Array.from({ length: 3344 }, () => activity())
    const relationships: RelationshipRow[] = []
    for (const [i, row] of activities.entries()) {
      if (i >= 42) relationships.push(relationship({ task_id: row.task_id, pred_task_id: 0 }))
      if (i >= 110) relationships.push(relationship({ task_id: 0, pred_task_id: row.task_id }))
    }
    const check = find(score({ activities, relationships }).checks, 'logic')
    expect(check.no_predecessor).toBe(42)
    expect(check.no_successor).toBe(110)
    expect(check.pct).toBe(3.3)
    expect(check.state).toBe('pass')
  })

  it('fails a file with no relationships at all, at 100% open ends', () => {
    // Open ends must not divide by zero, and a file with no logic genuinely fails DCMA 1 —
    // it is checks 2, 3 and 4 that have nothing to measure (`missing-taskpred.xer`).
    const check = find(score({ activities: [activity(), activity()] }).checks, 'logic')
    expect(check.state).toBe('fail')
    expect(check.pct).toBe(100)
  })

  it('lists both-ends-open activities first', () => {
    const [a, b, c] = [activity(), activity(), activity()]
    const relationships = [relationship({ task_id: b!.task_id, pred_task_id: c!.task_id })]
    const check = find(score({ activities: [a!, b!, c!], relationships }).checks, 'logic')
    expect(check.examples?.[0]?.value).toBe('no predecessor, no successor')
  })

  it('counts an external predecessor as closing its successor front end', () => {
    // A relationship whose predecessor lives outside the file is legitimate, not
    // corruption, and the successor genuinely has a predecessor (§3.6).
    const succ = activity()
    const ends = openEnds(
      [succ],
      [relationship({ task_id: succ.task_id, pred_task_id: 9999, pred_proj_id: '2' })],
    )
    expect(ends.no_predecessor).toBe(0)
  })
})

describe('checks 2, 3 and 4 — the relationship checks', () => {
  const { activities } = closedChain(10)

  it('fails check 2 on a single lead, because the threshold is zero', () => {
    const relationships = [relationship({ lag_hr_cnt: -24 }), ...Array(99).fill(relationship())]
    const check = find(score({ activities, relationships }).checks, 'leads')
    expect(check.count).toBe(1)
    expect(check.threshold).toBe('0')
    expect(check.state).toBe('fail')
    expect(check.examples?.[0]?.value_hr).toBe(-24)
  })

  it('passes check 3 at exactly 5% and fails above it', () => {
    const lag = (n: number) => [
      ...Array(n).fill(relationship({ lag_hr_cnt: 8 })),
      ...Array(100 - n).fill(relationship()),
    ]
    expect(find(score({ activities, relationships: lag(5) }).checks, 'lags').state).toBe('pass')
    expect(find(score({ activities, relationships: lag(6) }).checks, 'lags').state).toBe('fail')
  })

  it('fails check 4 at 89.5% and passes at 90%', () => {
    // The half-point miss on a real tender, reproduced exactly.
    const mix = (fs: number, other: number) => [
      ...Array(fs).fill(relationship()),
      ...Array(other).fill(relationship({ pred_type: 'PR_SS' })),
    ]
    const near = find(
      score({ activities, relationships: mix(179, 21) }).checks,
      'relationship_types',
    )
    expect(near.pct).toBe(89.5)
    expect(near.state).toBe('fail')
    expect(
      find(score({ activities, relationships: mix(180, 20) }).checks, 'relationship_types').state,
    ).toBe('pass')
  })

  it('skips 2, 3 and 4 where the file carries no relationships', () => {
    // Inapplicable, not failed: "0 of 0 relationships are finish-to-start" is a division by
    // zero, and reporting 0% FS as a failure would be a verdict on nothing.
    const quality = score({ activities })
    for (const id of ['leads', 'lags', 'relationship_types'] as const) {
      expect.soft(find(quality.checks, id).state, id).toBe('skip')
    }
    expect(quality.applicable).toBe(7)
    expect(quality.skipped).toBe(7)
  })
})

describe('check 5 — hard constraints', () => {
  it('counts the two-way constraints and not the "or after" ones', () => {
    expect(HARD_CONSTRAINT_TYPES).toContain('CS_MANDFIN')
    expect(HARD_CONSTRAINT_TYPES).toContain('CS_MSO')
    expect(HARD_CONSTRAINT_TYPES).not.toContain('CS_MSOA')
    expect(HARD_CONSTRAINT_TYPES).not.toContain('CS_ALAP')
  })

  it('carries the constraint type on the exemplar', () => {
    const activities = [
      activity({ cstr_type: 'CS_MANDFIN' }),
      activity({ cstr_type: 'CS_MSOA' }),
      activity(),
    ]
    const check = find(score({ activities }).checks, 'hard_constraints')
    expect(check.count).toBe(1)
    expect(check.state).toBe('fail')
    expect(check.examples?.[0]?.value).toBe('CS_MANDFIN')
  })
})

describe('checks 6 and 8 — the 44-day thresholds', () => {
  const many = (float: number) =>
    Array.from({ length: 100 }, () => activity({ total_float_hr_cnt: float }))

  it('record which day length converted them, and its provenance', () => {
    const quality = score({ activities: many(0), hoursPerDay: { hours: 24, source: 'fallback' } })
    for (const id of ['high_float', 'high_duration'] as const) {
      const check = find(quality.checks, id)
      expect.soft(check.hours_per_day, id).toBe(24)
      expect.soft(check.hours_per_day_source, id).toBe('fallback')
    }
  })

  it('move the threshold with the calendar', () => {
    // 44 days is 352 hours on an eight-hour day and 1,056 on an elapsed one: a hard-coded
    // 352 would fail every activity over a fortnight on a 24-hour calendar (§10.10).
    const activities = many(400)
    expect(find(score({ activities }).checks, 'high_float').count).toBe(100)
    const elapsed = score({ activities, hoursPerDay: { hours: 24, source: 'programme_calendar' } })
    expect(find(elapsed.checks, 'high_float').count).toBe(0)
  })

  it('leave null float out of the numerator without excusing the programme', () => {
    const activities = [
      ...Array.from({ length: 50 }, () => activity({ total_float_hr_cnt: null })),
      ...Array.from({ length: 50 }, () => activity({ total_float_hr_cnt: 400 })),
    ]
    const check = find(score({ activities }).checks, 'high_float')
    expect(check.count).toBe(50)
    expect(check.pct).toBe(50) // of all 100 activities, not of the 50 that report float
  })
})

describe('check 7 — negative float', () => {
  it('fails on one negative-float activity and orders exemplars most-negative first', () => {
    const activities = [
      activity({ total_float_hr_cnt: -8 }),
      activity({ total_float_hr_cnt: -480 }),
      activity({ total_float_hr_cnt: null }),
      activity({ total_float_hr_cnt: 0 }),
    ]
    const check = find(score({ activities }).checks, 'negative_float')
    expect(check.state).toBe('fail')
    expect(check.count).toBe(2)
    expect(check.examples?.map((e) => e.value_hr)).toEqual([-480, -8])
  })
})

describe('check 9 — invalid dates', () => {
  const dataDate = '2026-06-01 08:00'

  it('flags an actual date after the data date', () => {
    const activities = [activity({ status_code: 'TK_Complete', act_end_date: '2026-07-01 16:00' })]
    const check = find(score({ activities, dataDate }).checks, 'invalid_dates')
    expect(check.state).toBe('fail')
    expect(check.examples?.[0]?.value).toMatch(/actual finish/)
  })

  it('flags remaining work scheduled in the past', () => {
    const activities = [
      activity({ early_start_date: '2026-01-05 08:00', early_end_date: '2026-01-06 16:00' }),
    ]
    expect(find(score({ activities, dataDate }).checks, 'invalid_dates').state).toBe('fail')
  })

  it('exempts a completed activity, whose early dates are leftovers', () => {
    // Reading those as forecasts would fail every progressed programme for the crime of
    // having finished something.
    const activities = [
      activity({
        status_code: 'TK_Complete',
        act_start_date: '2026-01-05 08:00',
        act_end_date: '2026-01-06 16:00',
        early_start_date: '2026-01-05 08:00',
        early_end_date: '2026-01-06 16:00',
      }),
    ]
    expect(find(score({ activities, dataDate }).checks, 'invalid_dates').state).toBe('pass')
  })

  it('skips rather than passes where the file names no data date', () => {
    const quality = score({ activities: [activity()], dataDate: null })
    const check = find(quality.checks, 'invalid_dates')
    expect(check.state).toBe('skip')
    expect(check.reason).toMatch(/data date/)
    expect(quality.applicable).toBe(6) // 1, 5, 6, 7, 8, 10 — the relationship checks skip too
  })
})

describe('check 10 — resources', () => {
  it('is reported, not scored: it passes and prints its share', () => {
    const activities = Array.from({ length: 4 }, () => activity())
    const resourced = new Set([activities[0]?.task_id ?? 0])
    const check = find(score({ activities, resourced }).checks, 'resources')
    expect(check.state).toBe('pass')
    expect(check.pct).toBe(25)
    expect(check.threshold).toBe('—')
  })
})

describe('the exemplar cap', () => {
  it('carries the exact count, 50 worst-first exemplars and truncated beyond', () => {
    // This is what keeps a 20,000-activity file's derived.json the same order as a
    // 3,000-activity one. Uncapped lists would make the *worst* programmes generate the
    // *biggest* files, which is backwards.
    const activities = Array.from({ length: 200 }, (_, i) =>
      activity({ total_float_hr_cnt: -(i + 1) * 8 }),
    )
    const check = find(score({ activities }).checks, 'negative_float')
    expect(check.count).toBe(200)
    expect(check.examples).toHaveLength(EXEMPLAR_CAP)
    expect(check.shown).toBe(EXEMPLAR_CAP)
    expect(check.truncated).toBe(true)
    expect(check.examples?.[0]?.value_hr).toBe(-1600) // the worst, not the first in the file
  })

  it('spends no bytes on exemplars for a passing check', () => {
    const check = find(
      score({ activities: [activity({ total_float_hr_cnt: 0 })] }).checks,
      'negative_float',
    )
    expect(check.state).toBe('pass')
    expect(check.examples).toBeUndefined()
    expect(check.truncated).toBeUndefined()
  })
})

describe('against the corpus', () => {
  const run = (name: string) => {
    const file = fixture(name)
    const activities = readActivities(file).rows
    return dcmaScorecard({
      activities,
      relationships: readRelationships(file),
      dataDate: null,
      hoursPerDay: hoursPerDay(file),
      resourced: readResourcedTaskIds(file),
    })
  }

  it('fails check 7 on float-negative with the golden five', () => {
    const check = find(run('float-negative').checks, 'negative_float')
    expect(check.state).toBe('fail')
    expect(check.count).toBe(5)
  })

  it('passes check 7 on a baseline that carries no negative float', () => {
    expect(find(run('progress-none').checks, 'negative_float').state).toBe('pass')
  })

  it('skips the relationship checks on missing-taskpred and still scores the rest', () => {
    const quality = run('missing-taskpred')
    expect(quality.applicable).toBe(6) // 9 skips too: this call passes no data date
    expect(find(quality.checks, 'logic').state).toBe('fail')
  })

  it('converts on the programme calendar, not on default_flag', () => {
    const check = find(run('cal-default-unused').checks, 'high_float')
    expect(check.hours_per_day).toBe(8)
    expect(check.hours_per_day_source).toBe('programme_calendar')
  })
})
