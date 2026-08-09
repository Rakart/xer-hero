import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ACTIVITIES_VERSION, ACTIVITY_COLUMNS } from '../contracts/activities'
import type { XerFile } from '../contracts/xer'
import { parseXer } from '../xer'
import {
  activityFinish,
  activityStart,
  buildActivities,
  isExternal,
  readActivities,
  readRelationships,
  readResourcedTaskIds,
  readWbs,
} from './activities'

const CORPUS = fileURLToPath(new URL('../../../fixtures/synthetic/corpus/', import.meta.url))
const fixture = (name: string) => parseXer(readFileSync(`${CORPUS}${name}.xer`))

interface GoldenTask {
  task_code: string
  task_name: string
  task_type: string
  status_code: string
  target_drtn_hr_cnt: number | null
  remain_drtn_hr_cnt: number | null
  total_float_hr_cnt: number | null
  early_start_date: string | null
  early_end_date: string | null
  act_start_date: string | null
  act_end_date: string | null
}
const golden = (name: string) =>
  JSON.parse(readFileSync(`${CORPUS}${name}.expected.json`, 'utf8')) as {
    tasks?: GoldenTask[]
    assertions: { activity_count: number; external_relationship_count: number }
  }

const corpusNames = readdirSync(CORPUS)
  .filter((n) => n.endsWith('.xer'))
  .map((n) => n.slice(0, -4))
  .sort()

const payloadOf = (file: XerFile, driving: ReadonlySet<number> = new Set()) =>
  buildActivities(readActivities(file).rows, readWbs(file), driving)

describe('the name-mapped read', () => {
  it('reads the same programme identically out of two different field sets', () => {
    // `TASK` moves from 61 fields to 60 between the 6.0 and 8.3 exports and the field
    // *order* differs, so a positional read is silently wrong on one of the two with no
    // arity mismatch to catch it (§2.7). This is that failure, made loud.
    expect(readActivities(fixture('ver-60-fieldset')).rows).toEqual(
      readActivities(fixture('ver-83-fieldset')).rows,
    )
  })

  it('reproduces every activity the golden says the generator emitted', () => {
    // The golden is written from what the generator *intended to emit*, never from parsing
    // the result, so agreeing with it is a claim about this reader rather than a round trip.
    for (const name of corpusNames) {
      const tasks = golden(name).tasks
      if (!tasks) continue
      const rows = readActivities(fixture(name)).rows
      expect.soft(rows.length, `${name} row count`).toBe(tasks.length)
      for (const [i, want] of tasks.entries()) {
        const got = rows[i]
        expect
          .soft(
            {
              task_code: got?.task_code,
              task_name: got?.task_name,
              task_type: got?.task_type,
              status_code: got?.status_code,
              target_drtn_hr_cnt: got?.target_drtn_hr_cnt,
              remain_drtn_hr_cnt: got?.remain_drtn_hr_cnt,
              total_float_hr_cnt: got?.total_float_hr_cnt,
              early_start_date: got?.early_start_date,
              early_end_date: got?.early_end_date,
              act_start_date: got?.act_start_date,
              act_end_date: got?.act_end_date,
            },
            `${name} row ${i}`,
          )
          .toEqual({
            task_code: want.task_code,
            task_name: want.task_name,
            task_type: want.task_type,
            status_code: want.status_code,
            target_drtn_hr_cnt: want.target_drtn_hr_cnt,
            remain_drtn_hr_cnt: want.remain_drtn_hr_cnt,
            total_float_hr_cnt: want.total_float_hr_cnt,
            early_start_date: want.early_start_date,
            early_end_date: want.early_end_date,
            act_start_date: want.act_start_date,
            act_end_date: want.act_end_date,
          })
      }
    }
  })

  it('keeps an empty float empty rather than turning it into a zero', () => {
    const rows = readActivities(fixture('progress-full')).rows
    expect(rows.every((r) => r.total_float_hr_cnt === null)).toBe(true)
  })

  it('leaves dates as the file wrote them, naive and unconverted', () => {
    // The `.xer` records no timezone anywhere; converting to UTC would invent information.
    const row = readActivities(fixture('wbs-flat')).rows[0]
    expect(row?.early_start_date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })

  it('prefers what happened to what was planned, for the window', () => {
    const rows = readActivities(fixture('progress-full')).rows
    for (const row of rows) {
      expect.soft(activityStart(row)).toBe(row.act_start_date)
      expect.soft(activityFinish(row)).toBe(row.act_end_date)
    }
  })

  it('reads no activities at all out of a file with nothing in it', () => {
    expect(readActivities(fixture('enc-zeroed-file')).rows).toEqual([])
  })
})

describe('relationships and WBS', () => {
  it('finds the external predecessor the corpus plants, and no others', () => {
    for (const name of corpusNames) {
      const want = golden(name).assertions.external_relationship_count
      const got = readRelationships(fixture(name)).filter(isExternal).length
      expect.soft(got, name).toBe(want)
    }
  })

  it('reports no relationships where the file carries no TASKPRED table', () => {
    expect(readRelationships(fixture('missing-taskpred'))).toEqual([])
  })

  it('reads a lead as a negative lag rather than dropping the sign', () => {
    const leads = readRelationships(fixture('float-negative')).filter((r) => r.lag_hr_cnt < 0)
    expect(leads.length).toBeGreaterThan(0)
  })

  it('marks the project node so the WBS summary can exclude it', () => {
    const nodes = readWbs(fixture('progress-full'))
    expect(nodes.filter((n) => n.proj_node_flag)).toHaveLength(1)
    expect(nodes.filter((n) => n.proj_node_flag)[0]?.parent_wbs_id).toBeNull()
  })
})

describe('the activities.json payload', () => {
  it('is v2 and columnar, with every column the same length', () => {
    for (const name of corpusNames) {
      const payload = payloadOf(fixture(name))
      expect.soft(payload.version, name).toBe(ACTIVITIES_VERSION)
      const n = payload.activities.task_id.length
      expect.soft(n, `${name} count`).toBe(golden(name).assertions.activity_count)
      for (const column of ACTIVITY_COLUMNS) {
        expect.soft(payload.activities[column].length, `${name}.${column}`).toBe(n)
      }
    }
  })

  it('carries our computed driving path, never the file’s own flag', () => {
    // A stat whose method flips with how the planner happened to export cannot be compared
    // across programmes, and the flag is the only ground truth this project will ever have.
    const file = fixture('wbs-flat')
    const rows = readActivities(file).rows
    const flagged = rows.filter((r) => r.driving_path_flag === 'Y').length
    expect(flagged).toBeGreaterThan(0)
    const payload = payloadOf(file, new Set([rows[0]?.task_id ?? 0]))
    expect(payload.activities.driving_path.filter(Boolean)).toHaveLength(1)
    expect(payload.activities.driving_path[0]).toBe(true)
  })

  it('writes the WBS as tuples, to keep the file small', () => {
    const payload = payloadOf(fixture('progress-full'))
    expect(payload.wbs).toHaveLength(6)
    for (const tuple of payload.wbs) expect.soft(tuple).toHaveLength(4)
    expect(payload.wbs[0]?.[1]).toBeNull() // the project node has no parent
  })

  it('survives a task name carrying an embedded newline', () => {
    const payload = payloadOf(fixture('text-multiline'))
    expect(payload.activities.task_name.some((n) => n.includes('\n'))).toBe(true)
  })
})

describe('resource assignments', () => {
  it('counts distinct task ids, not TASKRSRC rows', () => {
    const file = fixture('wbs-flat')
    const resourced = readResourcedTaskIds(file)
    expect(resourced.size).toBeGreaterThan(0)
    expect(resourced.size).toBeLessThanOrEqual(readActivities(file).rows.length)
  })
})
