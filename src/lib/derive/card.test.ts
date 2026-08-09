import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CARD_S_CURVE_POINTS } from '../contracts/card'
import type { SCurve } from '../contracts/derived'
import { parseXer } from '../xer'
import type { ActivityRow } from './activities'
import { buildCard, cardSCurve } from './card'
import type { HoursPerDay } from './float'
import { derive } from './index'

const CORPUS = fileURLToPath(new URL('../../../fixtures/synthetic/corpus/', import.meta.url))
const corpusNames = readdirSync(CORPUS)
  .filter((n) => n.endsWith('.xer'))
  .map((n) => n.slice(0, -4))
  .sort()

const EIGHT: HoursPerDay = { hours: 8, source: 'programme_calendar' }

const curve = (cumulative: number[]): SCurve => ({
  bucket: 'month',
  from: '2026-01',
  to: '2026-12',
  starts: [],
  finishes: [],
  cumulative,
})

const activity = (float: number | null): ActivityRow =>
  ({
    task_id: 1,
    task_code: 'A',
    task_name: 'A',
    wbs_id: null,
    clndr_id: null,
    proj_id: '1',
    task_type: 'TT_Task',
    status_code: 'TK_NotStart',
    target_drtn_hr_cnt: null,
    remain_drtn_hr_cnt: null,
    total_float_hr_cnt: float,
    early_start_date: null,
    early_end_date: null,
    act_start_date: null,
    act_end_date: null,
    target_start_date: null,
    target_end_date: null,
    cstr_type: null,
    driving_path_flag: null,
  }) satisfies ActivityRow

describe('cardSCurve', () => {
  it('is always sixteen points, whatever the programme spans', () => {
    // A fixed slot in a fixed-width column: nothing in a row may flow (§6.2).
    expect(cardSCurve(curve([1]))).toHaveLength(CARD_S_CURVE_POINTS)
    expect(cardSCurve(curve(Array.from({ length: 77 }, (_, i) => i + 1)))).toHaveLength(
      CARD_S_CURVE_POINTS,
    )
    expect(cardSCurve(curve([]))).toHaveLength(CARD_S_CURVE_POINTS)
  })

  it('normalises to 0→1 so it renders without knowing the activity count', () => {
    const points = cardSCurve(curve([100, 400, 1000]))
    expect(points.at(-1)).toBe(1)
    expect(points[0]).toBe(0.1)
  })

  it('never falls, because a cumulative curve cannot', () => {
    const points = cardSCurve(curve([1, 1, 5, 9, 40, 41, 90, 100]))
    for (let i = 1; i < points.length; i++) {
      expect.soft(points[i]).toBeGreaterThanOrEqual(points[i - 1] as number)
    }
  })

  it('draws a flat zero line rather than dividing by zero', () => {
    expect(cardSCurve(curve([0, 0, 0]))).toEqual(new Array(CARD_S_CURVE_POINTS).fill(0))
  })
})

describe('buildCard', () => {
  it('carries the three float percentages, the depth and the issue count', () => {
    const card = buildCard({
      activities: [activity(-8), activity(0), activity(4000)],
      sCurve: curve([1, 2, 3]),
      hoursPerDay: EIGHT,
      wbsDepth: 1,
      issuesCount: 2,
    })
    expect(card.float_mix.neg + card.float_mix.ok + card.float_mix.high).toBe(100)
    expect(card.wbs_depth).toBe(1) // renders the `no WBS` badge
    expect(card.issues_count).toBe(2) // renders the `⚠ partial` badge
  })

  it('stays about 200 bytes on every fixture, because the shelf reads zero blobs', () => {
    // A 25-row page is one Postgres query and every graphic on a row comes out of this
    // object; nothing in it may grow with activity count (§6.2).
    for (const name of corpusNames) {
      const file = parseXer(readFileSync(`${CORPUS}${name}.xer`))
      const { row } = derive({
        file,
        programmeId: 'p',
        revisionId: 'r',
        parserVersion: '0.1.0',
        computedAt: '2026-08-09T00:00:00Z',
      })
      const bytes = new TextEncoder().encode(JSON.stringify(row.card)).length
      expect.soft(bytes, `${name} card bytes`).toBeLessThan(300)
      expect.soft(row.card.s_curve, name).toHaveLength(CARD_S_CURVE_POINTS)
      const mix = row.card.float_mix
      const sum = mix.neg + mix.ok + mix.high
      expect.soft(sum === 100 || sum === 0, `${name} float_mix sums to ${sum}`).toBe(true)
    }
  })
})
