import { describe, expect, it } from 'vitest'
import type { ActivitiesPayload } from '@/lib/contracts/activities'
import { ACTIVITIES_VERSION } from '@/lib/contracts/activities'
import {
  buildRows,
  buildWbsTree,
  EMPTY_FILTERS,
  filterRows,
  matchesCheck,
  rowCountLabel,
  sortRows,
  statusLabel,
  subtreeIds,
  windowRange,
} from './activity-model'

/**
 * Five activities under a three-level tree, with every awkward cell the contract allows: a
 * null float on a complete activity, a milestone with no duration, an activity whose only
 * dates are actuals, and one on the driving path.
 */
const payload: ActivitiesPayload = {
  version: ACTIVITIES_VERSION,
  activities: {
    task_id: [1, 2, 3, 4, 5],
    task_code: ['A100', 'A200', 'A300', 'A400', 'A500'],
    task_name: [
      'Excavate pile cap',
      'Cast base slab',
      'Sectional completion',
      'Waterproof roof slab',
      'Commission systems',
    ],
    wbs_id: [11, 12, 12, 10, null],
    task_type: ['TT_Task', 'TT_Task', 'TT_FinMile', 'TT_Task', 'TT_Task'],
    status_code: ['TK_Complete', 'TK_Active', 'TK_NotStart', 'TK_NotStart', 'TK_NotStart'],
    target_drtn_hr_cnt: [80, 400, 0, 16, null],
    remain_drtn_hr_cnt: [0, 120, 0, 16, null],
    total_float_hr_cnt: [null, -80, 960, 16, null],
    early_start_date: ['2026-01-05', '2026-02-01', '2026-06-01', '2026-03-01', null],
    early_end_date: ['2026-01-19', '2026-04-01', '2026-06-01', '2026-03-03', null],
    act_start_date: ['2026-01-06', '2026-02-02', null, null, null],
    act_end_date: ['2026-01-20', null, null, null, null],
    driving_path: [false, true, true, false, false],
  },
  wbs: [
    [10, null, 'PRJ', 'Quay wall reconstruction'],
    [11, 10, 'PRJ.1', 'Enabling works'],
    [12, 11, 'PRJ.1.1', 'Piling'],
  ],
}

const tree = buildWbsTree(payload.wbs, payload.activities.wbs_id)
const rows = buildRows(payload, tree.codes)

describe('buildRows', () => {
  it('converts hours to days at eight, the same convention DCMA 6 and 8 use', () => {
    expect(rows[0]?.durationDays).toBe(10)
    expect(rows[1]?.floatDays).toBe(-10)
    expect(rows[3]?.floatDays).toBe(2)
  })

  it('keeps a null float null — an empty float is not a zero float', () => {
    expect(rows[0]?.floatDays).toBeNull()
    expect(rows[4]?.floatDays).toBeNull()
  })

  it('gives a milestone no duration rather than a zero', () => {
    expect(rows[2]?.isMilestone).toBe(true)
    expect(rows[2]?.durationDays).toBeNull()
  })

  it('prefers actual dates over forecast ones, per cell', () => {
    expect(rows[0]?.start).toBe('2026-01-06')
    expect(rows[0]?.finish).toBe('2026-01-20')
    // Started but not finished: the actual start wins, the forecast finish stands.
    expect(rows[1]?.start).toBe('2026-02-02')
    expect(rows[1]?.finish).toBe('2026-04-01')
  })

  it('carries the WBS short code and tolerates an unparented activity', () => {
    expect(rows[0]?.wbsCode).toBe('PRJ.1')
    expect(rows[4]?.wbsCode).toBe('')
  })

  it('reads driving-path membership from our own boolean', () => {
    expect(rows.filter((r) => r.driving)).toHaveLength(2)
  })
})

describe('statusLabel', () => {
  it('renders the three known codes and passes an unknown one through', () => {
    expect(statusLabel('TK_Complete')).toBe('Done')
    expect(statusLabel('TK_Active')).toBe('Active')
    expect(statusLabel('TK_NotStart')).toBe('—')
    expect(statusLabel('TK_Suspended')).toBe('TK_Suspended')
  })
})

describe('buildWbsTree', () => {
  it('rolls counts up from the subtree, or every branch reads zero', () => {
    const root = tree.byId.get(10)
    expect(root?.own).toBe(1)
    expect(root?.total).toBe(4)
    expect(tree.byId.get(11)?.total).toBe(3)
    expect(tree.byId.get(12)?.total).toBe(2)
  })

  it('records depth so the rail can indent without walking again', () => {
    expect(tree.byId.get(10)?.depth).toBe(0)
    expect(tree.byId.get(12)?.depth).toBe(2)
    expect(tree.roots.map((n) => n.id)).toEqual([10])
  })

  it('treats an orphan as a root rather than dropping its subtree', () => {
    const orphaned = buildWbsTree([[99, 42, 'X', 'Orphan']], [99, 99])
    expect(orphaned.roots.map((n) => n.id)).toEqual([99])
    expect(orphaned.roots[0]?.total).toBe(2)
  })
})

describe('subtreeIds', () => {
  it('selects the whole subtree, never the node alone', () => {
    expect([...subtreeIds(tree, 11)].sort()).toEqual([11, 12])
    expect([...subtreeIds(tree, 12)]).toEqual([12])
    expect([...subtreeIds(tree, 404)]).toEqual([])
  })
})

describe('filterRows', () => {
  it('returns everything under the empty filter set', () => {
    expect(filterRows(rows, EMPTY_FILTERS)).toHaveLength(5)
  })

  it('searches code and name together, case-insensitively', () => {
    expect(filterRows(rows, { ...EMPTY_FILTERS, query: 'slab' }).map((r) => r.code)).toEqual([
      'A200',
      'A400',
    ])
    expect(filterRows(rows, { ...EMPTY_FILTERS, query: 'a300' }).map((r) => r.code)).toEqual([
      'A300',
    ])
  })

  it('filters to a WBS subtree', () => {
    const filtered = filterRows(rows, { ...EMPTY_FILTERS, wbsSubtree: subtreeIds(tree, 11) })
    expect(filtered.map((r) => r.code)).toEqual(['A100', 'A200', 'A300'])
  })

  it('never counts a null float as zero float', () => {
    const filtered = filterRows(rows, { ...EMPTY_FILTERS, floatAtOrBelowZero: true })
    expect(filtered.map((r) => r.code)).toEqual(['A200'])
  })

  it('applies the three DCMA predicates the payload can express', () => {
    expect(matchesCheck(rows[1] as never, 'negative_float')).toBe(true)
    expect(filterRows(rows, { ...EMPTY_FILTERS, check: 'high_float' }).map((r) => r.code)).toEqual([
      'A300',
    ])
    expect(
      filterRows(rows, { ...EMPTY_FILTERS, check: 'high_duration' }).map((r) => r.code),
    ).toEqual(['A200'])
  })

  it('combines predicates rather than replacing them', () => {
    const filtered = filterRows(rows, {
      ...EMPTY_FILTERS,
      drivingOnly: true,
      status: 'TK_NotStart',
    })
    expect(filtered.map((r) => r.code)).toEqual(['A300'])
  })
})

describe('sortRows', () => {
  it('sorts nulls last in both directions', () => {
    const up = sortRows(rows, 'floatDays', 1).map((r) => r.code)
    const down = sortRows(rows, 'floatDays', -1).map((r) => r.code)
    expect(up.slice(-2)).toEqual(['A100', 'A500'])
    expect(down.slice(-2)).toEqual(['A100', 'A500'])
    expect(up[0]).toBe('A200')
    expect(down[0]).toBe('A300')
  })

  it('is stable on ties, on payload order', () => {
    // TK_Active, TK_Complete, then the three TK_NotStart rows in the order the payload
    // wrote them — a tie must not reshuffle under the cursor.
    const sorted = sortRows(rows, 'statusCode', 1).map((r) => r.code)
    expect(sorted).toEqual(['A200', 'A100', 'A300', 'A400', 'A500'])
  })
})

describe('rowCountLabel', () => {
  it('names the denominator only while a filter is on', () => {
    expect(rowCountLabel(20_000, 20_000)).toBe('20,000 rows')
    expect(rowCountLabel(1222, 20_000)).toBe('1,222 rows of 20,000')
    expect(rowCountLabel(1, 20_000)).toBe('1 row of 20,000')
  })
})

describe('windowRange', () => {
  it('renders a couple of dozen rows for twenty thousand', () => {
    const { first, last } = windowRange(0, 460, 28, 20_000)
    expect(first).toBe(0)
    expect(last - first).toBeLessThan(35)
  })

  it('overscans on both sides and never runs past the end', () => {
    expect(windowRange(2800, 460, 28, 20_000).first).toBe(94)
    expect(windowRange(20_000 * 28, 460, 28, 20_000).last).toBe(20_000)
  })

  it('collapses safely on an empty result', () => {
    expect(windowRange(0, 460, 28, 0)).toEqual({ first: 0, last: 0 })
  })
})
