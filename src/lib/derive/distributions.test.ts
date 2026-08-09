import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseXer } from '../xer'
import type { ActivityRow } from './activities'
import { readActivities } from './activities'
import {
  activityTypeMix,
  DURATION_HISTOGRAM_EDGES,
  durationHistogram,
  FLOAT_HISTOGRAM_EDGES,
  floatHistogram,
  sCurve,
} from './distributions'
import type { HoursPerDay } from './float'
import { programmeWindow } from './index'

const CORPUS = fileURLToPath(new URL('../../../fixtures/synthetic/corpus/', import.meta.url))
const fixture = (name: string) => parseXer(readFileSync(`${CORPUS}${name}.xer`))
const golden = (name: string) =>
  JSON.parse(readFileSync(`${CORPUS}${name}.expected.json`, 'utf8')) as {
    assertions: Record<string, never>
  }
const corpusNames = readdirSync(CORPUS)
  .filter((n) => n.endsWith('.xer'))
  .map((n) => n.slice(0, -4))
  .sort()

const EIGHT: HoursPerDay = { hours: 8, source: 'programme_calendar' }

let nextId = 1
function activity(partial: Partial<ActivityRow> = {}): ActivityRow {
  return {
    task_id: nextId++,
    task_code: 'A0000',
    task_name: 'Activity',
    wbs_id: null,
    clndr_id: null,
    proj_id: '1',
    task_type: 'TT_Task',
    status_code: 'TK_NotStart',
    target_drtn_hr_cnt: null,
    remain_drtn_hr_cnt: null,
    total_float_hr_cnt: null,
    early_start_date: null,
    early_end_date: null,
    act_start_date: null,
    act_end_date: null,
    target_start_date: null,
    target_end_date: null,
    cstr_type: null,
    driving_path_flag: null,
    ...partial,
  }
}

describe('fixed buckets', () => {
  it('ships the spec edge arrays verbatim', () => {
    // Buckets are fixed, never adaptive: two histograms are only comparable if they share
    // edges, and revision diff — the feature planners want next — is a subtraction.
    expect(FLOAT_HISTOGRAM_EDGES).toEqual([null, -20, 0, 5, 10, 20, 44, 100, 200, null])
    expect(DURATION_HISTOGRAM_EDGES).toEqual([0, 1, 5, 10, 20, 44, 100, 200, null])
  })

  it('emits one count per gap between edges', () => {
    const rows = [activity()]
    expect(floatHistogram(rows, EIGHT).counts).toHaveLength(FLOAT_HISTOGRAM_EDGES.length - 1)
    expect(durationHistogram(rows, EIGHT).counts).toHaveLength(DURATION_HISTOGRAM_EDGES.length - 1)
  })

  it('puts a value on an edge in the bucket the edge opens', () => {
    const rows = [
      activity({ total_float_hr_cnt: -20 * 8 }),
      activity({ total_float_hr_cnt: 0 }),
      activity({ total_float_hr_cnt: 44 * 8 }),
      activity({ total_float_hr_cnt: 200 * 8 }),
    ]
    // [-∞,-20) [-20,0) [0,5) [5,10) [10,20) [20,44) [44,100) [100,200) [200,∞)
    expect(floatHistogram(rows, EIGHT).counts).toEqual([0, 1, 1, 0, 0, 0, 1, 0, 1])
  })

  it('converts hours on the programme day length, not a hard-coded 8', () => {
    // On a 24-hour elapsed calendar a hard-coded 8 would put everything over a fortnight in
    // the top bucket — the defect that removed the 352-hour constant (§10.10).
    const rows = [activity({ total_float_hr_cnt: 240 })] // 10 days at 24h, 30 days at 8h
    expect(floatHistogram(rows, { hours: 24, source: 'programme_calendar' }).counts[4]).toBe(1)
    expect(floatHistogram(rows, EIGHT).counts[5]).toBe(1)
  })
})

describe('floatHistogram', () => {
  it('counts empty float in null_count and in no bucket', () => {
    // Empty float is not zero float. The two must not land in the same place, or a
    // completed programme reports a wall of spurious zero-float criticals.
    const h = floatHistogram([activity(), activity({ total_float_hr_cnt: 0 })], EIGHT)
    expect(h.null_count).toBe(1)
    expect(h.counts.reduce((a, b) => a + b, 0)).toBe(1)
    expect(h.counts[2]).toBe(1)
  })

  it('agrees with every golden on nulls, zeros and negatives', () => {
    for (const name of corpusNames) {
      const g = golden(name).assertions as unknown as {
        float_hr: { negative: number; zero: number; null: number }
      }
      const rows = readActivities(fixture(name)).rows
      const h = floatHistogram(rows, EIGHT)
      expect.soft(h.null_count, `${name} null float`).toBe(g.float_hr.null)
      const negative = rows.filter(
        (r) => r.total_float_hr_cnt !== null && r.total_float_hr_cnt < 0,
      ).length
      const zero = rows.filter((r) => r.total_float_hr_cnt === 0).length
      expect.soft(negative, `${name} negative float`).toBe(g.float_hr.negative)
      expect.soft(zero, `${name} zero float`).toBe(g.float_hr.zero)
      expect
        .soft(h.counts.reduce((a, b) => a + b, 0) + (h.null_count ?? 0), `${name} totals`)
        .toBe(rows.length)
    }
  })
})

describe('durationHistogram', () => {
  it('files a milestone with no duration in the [0, 1) bucket', () => {
    // The opposite treatment to float, deliberately: absent float is unknown, absent
    // duration is none.
    const h = durationHistogram([activity({ task_type: 'TT_Mile' })], EIGHT)
    expect(h.counts[0]).toBe(1)
    expect(h.null_count).toBeUndefined()
  })

  it('counts every activity, since a duration is never absent-as-unknown', () => {
    for (const name of corpusNames) {
      const rows = readActivities(fixture(name)).rows
      const total = durationHistogram(rows, EIGHT).counts.reduce((a, b) => a + b, 0)
      expect.soft(total, name).toBe(rows.length)
    }
  })
})

describe('sCurve', () => {
  it('buckets by month over the window, inclusive of both ends', () => {
    const rows = [
      activity({ early_start_date: '2026-01-05 08:00', early_end_date: '2026-01-16 16:00' }),
      activity({ early_start_date: '2026-02-02 08:00', early_end_date: '2026-03-06 16:00' }),
    ]
    const curve = sCurve(rows, { start: '2026-01-05', finish: '2026-03-06' })
    expect(curve.bucket).toBe('month')
    expect(curve.from).toBe('2026-01')
    expect(curve.to).toBe('2026-03')
    expect(curve.starts).toEqual([1, 1, 0])
    expect(curve.finishes).toEqual([1, 0, 1])
    expect(curve.cumulative).toEqual([1, 1, 2])
  })

  it('reports no curve at all where there is no window', () => {
    const curve = sCurve([activity()], null)
    expect(curve).toEqual({
      bucket: 'month',
      from: null,
      to: null,
      starts: [],
      finishes: [],
      cumulative: [],
    })
  })

  it('closes on the activity count and rises monotonically, on every fixture', () => {
    for (const name of corpusNames) {
      const rows = readActivities(fixture(name)).rows
      const curve = sCurve(rows, programmeWindow(rows))
      if (rows.length === 0) continue
      const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
      expect.soft(sum(curve.starts), `${name} starts`).toBe(rows.length)
      expect.soft(sum(curve.finishes), `${name} finishes`).toBe(rows.length)
      expect.soft(curve.cumulative.at(-1), `${name} cumulative`).toBe(rows.length)
      expect
        .soft(curve.cumulative.every((v, i) => i === 0 || v >= (curve.cumulative[i - 1] ?? 0)))
        .toBe(true)
      expect.soft(curve.starts).toHaveLength(curve.finishes.length)
    }
  })
})

describe('activityTypeMix', () => {
  it('counts what the file says, including types nobody has documented', () => {
    // P6 enumerations may never be treated as closed (§2.4): `TT_LOE` and `TT_WBS` must
    // appear rather than vanishing into an "other" bucket that hides them.
    for (const name of corpusNames) {
      const g = golden(name).assertions as unknown as {
        activity_type_mix: Record<string, number>
      }
      const mix = activityTypeMix(readActivities(fixture(name)).rows)
      expect.soft(mix, name).toEqual(g.activity_type_mix)
    }
  })
})
