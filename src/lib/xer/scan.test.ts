import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MAX_ACTIVITIES, MAX_FILE_BYTES } from '@/lib/contracts/domain'
import { cell, reader, type XerFile } from '@/lib/contracts/xer'
import { parseXer } from './parse'
import {
  NO_READ_ABOVE_BYTES,
  type ScanResult,
  scanVerdict,
  scanXer,
  scanXerSync,
  sizeOnlyVerdict,
} from './scan'

const CORPUS = new URL('../../../fixtures/synthetic/corpus/', import.meta.url)

interface Golden {
  p6_version: string
  file: { bytes: number; sha256: string }
  tables: { name: string; rows: number }[]
  assertions: {
    data_date: string | null
    distinct_task_proj_id: number
    activity_count: number
    wbs: { node_count: number; max_depth: number }
    calendar_count: number
    calendars_in_use: number
  }
  ingest: { accept: boolean; guard?: string; reason: string; message?: string }
  readability?: {
    starts_with_ermhdr: boolean
    reaches_end_marker: boolean
    nul_byte_count: number
    trailing_nul_run: number
    complete_bytes: number
    verdict: string
  }
}

const names = readdirSync(CORPUS)
  .filter((f) => f.endsWith('.xer'))
  .map((f) => f.slice(0, -4))
  .sort()

const bytesOf = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(new URL(`${name}.xer`, CORPUS)))

const goldenOf = (name: string): Golden =>
  JSON.parse(readFileSync(new URL(`${name}.expected.json`, CORPUS), 'utf8')) as Golden

/** The same facts, recomputed from the retaining parse — the two drivers must agree (§5.2). */
function fromFullParse(file: XerFile): {
  table_row_counts: Record<string, number>
  activity_count: number
  distinct_task_proj_id: number
  calendars_in_use: number
  p6_version: string | null
} {
  const counts: Record<string, number> = {}
  for (const [name, table] of file.tables) counts[name] = table.rows.length
  const task = file.tables.get('TASK')
  const projId = task === undefined ? null : reader(task, 'proj_id')
  const clndrId = task === undefined ? null : reader(task, 'clndr_id')
  const rows = task?.rows ?? []
  return {
    table_row_counts: counts,
    activity_count: rows.length,
    distinct_task_proj_id: projId === null ? 0 : new Set(rows.map(projId)).size,
    calendars_in_use:
      clndrId === null ? 0 : new Set(rows.map(clndrId).filter((v) => v !== '')).size,
    p6_version: file.header?.version || null,
  }
}

describe.each(names)('%s', (name) => {
  const golden = goldenOf(name)
  const bytes = bytesOf(name)

  it('hashes and measures the bytes the golden recorded', async () => {
    const scan = await scanXer(bytes)
    expect(scan.bytes).toBe(golden.file.bytes)
    // The client's digest drives a dedup lookup only; ingest recomputes it (§2.11).
    expect(scan.content_hash).toBe(golden.file.sha256)
  })

  it('agrees with the full parse on every fact both compute (§5.2)', async () => {
    const scan = await scanXer(bytes, { hash: false })
    const parsed = parseXer(bytes)
    const expected = fromFullParse(parsed)
    expect(scan.table_row_counts).toEqual(expected.table_row_counts)
    expect(scan.activity_count).toBe(expected.activity_count)
    expect(scan.distinct_task_proj_id).toBe(expected.distinct_task_proj_id)
    expect(scan.calendars_in_use).toBe(expected.calendars_in_use)
    expect(scan.p6_version).toBe(expected.p6_version)
  })

  it('reports the programme facts the metadata screen prefills from', async () => {
    const scan = await scanXer(bytes, { hash: false })
    const a = golden.assertions
    expect(scan.activity_count).toBe(a.activity_count)
    expect(scan.distinct_task_proj_id).toBe(a.distinct_task_proj_id)
    expect(scan.data_date).toBe(a.data_date)
    expect(scan.wbs).toEqual(a.wbs)
    expect(scan.calendar_count).toBe(a.calendar_count)
    expect(scan.calendars_in_use).toBe(a.calendars_in_use)
    // Recorded, never rejected on: a version with no fixture still parses by name (§2.7).
    expect(scan.p6_version).toBe(scan.starts_with_ermhdr ? golden.p6_version : null)
  })

  it('reaches the golden ingest verdict', async () => {
    const scan = await scanXer(bytes, { hash: false })
    const verdict = scanVerdict(scan)
    expect(verdict.accept).toBe(golden.ingest.accept)
    if (!verdict.accept && golden.ingest.message !== undefined) {
      expect(verdict.guard).toBe(golden.ingest.guard)
      expect(verdict.reason).toBe(golden.ingest.reason)
      expect(verdict.message).toBe(golden.ingest.message)
    }
  })
})

describe('readability, decided on the bytes before anything is derived (§5.3)', () => {
  it.each(names.filter((n) => goldenOf(n).readability !== undefined))(
    'measures %s exactly as the golden measured it off the bytes',
    async (name) => {
      const golden = goldenOf(name).readability as NonNullable<Golden['readability']>
      const scan = await scanXer(bytesOf(name), { hash: false })
      expect({
        starts_with_ermhdr: scan.starts_with_ermhdr,
        reaches_end_marker: scan.reaches_end_marker,
        nul_byte_count: scan.nul_byte_count,
        trailing_nul_run: scan.trailing_nul_run,
        complete_bytes: scan.complete_bytes,
      }).toEqual({
        starts_with_ermhdr: golden.starts_with_ermhdr,
        reaches_end_marker: golden.reaches_end_marker,
        nul_byte_count: golden.nul_byte_count,
        trailing_nul_run: golden.trailing_nul_run,
        complete_bytes: golden.complete_bytes,
      })
      expect(scanVerdict(scan)).toMatchObject({ accept: false, guard: 'unreadable' })
    },
  )

  it.each(names.filter((n) => goldenOf(n).readability === undefined))(
    'finds %s readable: it ends with %%E and carries no NUL byte',
    async (name) => {
      const scan = await scanXer(bytesOf(name), { hash: false })
      expect(scan.starts_with_ermhdr).toBe(true)
      expect(scan.reaches_end_marker).toBe(true)
      expect(scan.nul_byte_count).toBe(0)
      expect(scan.tokenizer_ok).toBe(true)
    },
  )

  it('tells a truncated export apart from a legitimately sparse one', async () => {
    // Same shape, opposite verdicts: the sparse file ends with %E and the truncated one does not.
    const sparse = await scanXer(bytesOf('missing-taskpred'), { hash: false })
    const truncated = await scanXer(bytesOf('enc-truncated-export'), { hash: false })
    expect(sparse.tokenizer_ok).toBe(true)
    expect(truncated.tokenizer_ok).toBe(true)
    expect(truncated.activity_count).toBe(sparse.activity_count)
    expect(scanVerdict(sparse)).toEqual({ accept: true })
    expect(scanVerdict(truncated).accept).toBe(false)
  })

  it('rejects a wholly zeroed file as unreadable, not as an empty programme', async () => {
    const scan = await scanXer(bytesOf('enc-zeroed-file'), { hash: false })
    // Every count is zero and indistinguishable from a very small programme, which is why no
    // count can be the discriminator (§5.3).
    expect(scan.activity_count).toBe(0)
    const verdict = scanVerdict(scan)
    expect(verdict).toMatchObject({ accept: false, guard: 'unreadable' })
  })
})

describe('the caps and the discriminators (§5.3)', () => {
  const withScan = async (name: string): Promise<ScanResult> =>
    await scanXer(bytesOf(name), { hash: false })

  it('rejects on distinct TASK.proj_id, never on PROJECT row count', async () => {
    const multi = scanVerdict(await withScan('multiproj-two-proj-id'))
    expect(multi).toEqual({
      accept: false,
      guard: 'multi_project',
      reason: 'distinct TASK.proj_id > 1',
      message: 'This export contains 2 projects — export a single project and upload again.',
    })

    // Three PROJECT rows, one owning `proj_id`: a baseline-bearing export must stay legal.
    const baseline = await withScan('multiproj-baseline-rows')
    expect(baseline.project_row_count).toBe(3)
    expect(baseline.distinct_task_proj_id).toBe(1)
    expect(scanVerdict(baseline)).toEqual({ accept: true })
  })

  it('names the guard that fired, with the measured value beside the limit', async () => {
    const base = await withScan('ver-83-fieldset')

    const overActivities: ScanResult = { ...base, activity_count: 24_310 }
    expect(scanVerdict(overActivities)).toMatchObject({
      guard: 'activity_cap',
      message: 'This export has 24,310 activities. xer-hero accepts up to 20,000.',
    })

    // Inside the activity cap and over the byte cap means the size is in the other tables.
    const overBytes: ScanResult = { ...base, bytes: 74_876_518, activity_count: 12_400 }
    expect(scanVerdict(overBytes)).toMatchObject({
      guard: 'byte_cap',
      message:
        'This file is 71.4 MB. xer-hero accepts .xer exports up to 60 MB. It has 12,400 activities, which is inside the limit — the size is in the other tables (activity codes, resource assignments, user-defined text).',
    })

    const empty: ScanResult = { ...base, activity_count: 0 }
    expect(scanVerdict(empty)).toMatchObject({
      guard: 'no_activities',
      message: 'This export contains no activities.',
    })
  })

  it('runs without WebCrypto, losing the hash and nothing else (§5.2)', () => {
    const scan = scanXerSync(bytesOf('ver-83-fieldset'))
    expect(scan.content_hash).toBeNull()
    expect(scan.activity_count).toBe(20)
    expect(scanVerdict(scan)).toEqual({ accept: true })
  })

  it('reads nothing above twice the cap, and scans between the cap and twice it', () => {
    expect(sizeOnlyVerdict(MAX_FILE_BYTES + 1)).toBeNull()
    expect(sizeOnlyVerdict(NO_READ_ABOVE_BYTES)).toBeNull()
    expect(sizeOnlyVerdict(NO_READ_ABOVE_BYTES + 1)).toMatchObject({
      accept: false,
      guard: 'oversize',
    })
  })

  it('accepts the whole corpus except the four files a golden rejects', async () => {
    const rejected: string[] = []
    for (const name of names) {
      const verdict = scanVerdict(await scanXer(bytesOf(name), { hash: false }))
      if (!verdict.accept) rejected.push(name)
    }
    expect(rejected.sort()).toEqual([
      'enc-truncated-export',
      'enc-zeroed-file',
      'multiproj-two-proj-id',
    ])
  })

  it('never rejects on P6 version or on encoding', async () => {
    for (const name of [
      'ver-60-fieldset',
      'ver-83-fieldset',
      'enc-mojibake-0x81',
      'enc-cp1252-currency',
    ]) {
      expect(scanVerdict(await scanXer(bytesOf(name), { hash: false })), name).toEqual({
        accept: true,
      })
    }
    expect(MAX_ACTIVITIES).toBe(20_000)
  })
})

describe('the metadata prefill (§5.4)', () => {
  it('takes the title from the root PROJWBS node, not from the project code', async () => {
    const scan = await scanXer(bytesOf('ver-83-fieldset'), { hash: false })
    const parsed = parseXer(bytesOf('ver-83-fieldset'))
    const wbs = parsed.tables.get('PROJWBS')
    const root = wbs?.rows.find((row) => cell(wbs, row, 'proj_node_flag') === 'Y')
    expect(root).toBeDefined()
    expect(scan.title_prefill).toBe(cell(wbs!, root!, 'wbs_name'))
    expect(scan.title_prefill).not.toBe(scan.p6_project_id)
    expect(scan.p6_project_id).toBeTruthy()
  })

  it('falls back to PROJECT.proj_short_name where the file carries no WBS at all', async () => {
    // `wbs-flat` is Fixture B's real shape: PROJWBS = 1 and depth 1 is a correct answer.
    const scan = await scanXer(bytesOf('wbs-flat'), { hash: false })
    expect(scan.wbs).toEqual({ node_count: 1, max_depth: 1 })
    expect(scan.title_prefill).toBeTruthy()
  })

  it('carries the export date range and the header facts the panel renders', async () => {
    const scan = await scanXer(bytesOf('progress-full'), { hash: false })
    expect(scan.exported_on).toBe('2026-08-07')
    expect(scan.activity_date_range.start).toBeTruthy()
    expect(scan.activity_date_range.finish).toBeTruthy()
    expect(scan.activity_date_range.start! <= scan.activity_date_range.finish!).toBe(true)
    expect(scan.personal_data.export_login).toBe('admin')
    expect(scan.personal_data.export_user_name).toBe('Primavera Admin')
    expect(scan.personal_data.resources.length).toBe(scan.table_row_counts.RSRC)
    expect(scan.personal_data.truncated).toBe(false)
  })
})
