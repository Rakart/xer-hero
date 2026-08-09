import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cell, reader, type XerFile, XerParseError, type XerTable } from '@/lib/contracts/xer'
import { parseXer } from './parse'

// `node:fs` appears in tests and nowhere else: the parser is isomorphic and reads no filesystem.
const CORPUS = new URL('../../../fixtures/synthetic/corpus/', import.meta.url)

interface Golden {
  fixture: string
  p6_version: string
  file: { bytes: number; sha256: string }
  tables: { name: string; rows: number }[]
  assertions: {
    data_date: string | null
    project_row_count: number
    distinct_task_proj_id: number
    activity_count: number
    status_mix: Record<string, number>
    activity_type_mix: Record<string, number>
    relationship_type_mix: Record<string, number>
    constraint_mix: Record<string, number>
    float_hr: { negative: number; zero: number; null: number }
    wbs: { node_count: number; max_depth: number }
    calendar_count: number
    calendars_in_use: number
    resource_count: number
    resource_assignment_count: number
    activity_code_assignment_count: number
    external_relationship_count: number
    driving_path_flag_count: number
  }
  tasks?: Record<string, string | number | null>[]
}

const names = readdirSync(CORPUS)
  .filter((f) => f.endsWith('.xer'))
  .map((f) => f.slice(0, -4))
  .sort()

const bytesOf = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(new URL(`${name}.xer`, CORPUS)))

const goldenOf = (name: string): Golden =>
  JSON.parse(readFileSync(new URL(`${name}.expected.json`, CORPUS), 'utf8')) as Golden

const rows = (file: XerFile, table: string): readonly (readonly string[])[] =>
  file.tables.get(table)?.rows ?? []

/** Every read below goes through the table's own `%F` index. There is no positional read here. */
function values(file: XerFile, table: string, field: string): string[] {
  const found = file.tables.get(table)
  if (found === undefined) return []
  const read = reader(found, field)
  if (read === null) return []
  return found.rows.map(read)
}

function tally(list: readonly string[], empty?: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const raw of list) {
    const key = raw === '' && empty !== undefined ? empty : raw
    out[key] = (out[key] ?? 0) + 1
  }
  return out
}

function wbsDepth(file: XerFile): number {
  const table = file.tables.get('PROJWBS')
  if (table === undefined || table.rows.length === 0) return 0
  const parents = new Map<string, string>()
  for (const row of table.rows) {
    parents.set(cell(table, row, 'wbs_id') ?? '', cell(table, row, 'parent_wbs_id') ?? '')
  }
  let deepest = 0
  for (const id of parents.keys()) {
    const seen = new Set([id])
    let depth = 1
    let cursor = parents.get(id) ?? ''
    while (cursor !== '' && parents.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor)
      cursor = parents.get(cursor) ?? ''
      depth++
    }
    if (depth > deepest) deepest = depth
  }
  return deepest
}

function dataDate(file: XerFile): string | null {
  const project = file.tables.get('PROJECT')
  if (project === undefined) return null
  const owners = new Set(values(file, 'TASK', 'proj_id'))
  for (const row of project.rows) {
    if (owners.has(cell(project, row, 'proj_id') ?? '')) {
      return cell(project, row, 'last_recalc_date') || null
    }
  }
  return null
}

/** `pred_proj_id` pointing outside the file is legitimate, not corruption (§2.12). */
function externalRelationships(file: XerFile): number {
  const pred = file.tables.get('TASKPRED')
  if (pred === undefined) return 0
  const proj = reader(pred, 'proj_id')
  const predProj = reader(pred, 'pred_proj_id')
  if (proj === null || predProj === null) return 0
  return pred.rows.filter((row) => proj(row) !== predProj(row)).length
}

function floatTally(file: XerFile): { negative: number; zero: number; null: number } {
  const out = { negative: 0, zero: 0, null: 0 }
  for (const value of values(file, 'TASK', 'total_float_hr_cnt')) {
    // Empty float on completed work is a different claim from zero, and the parser keeps the
    // difference: coercing empty to zero invents critical activities (§9.2, `progress-full`).
    if (value === '') out.null++
    else if (Number(value) < 0) out.negative++
    else if (Number(value) === 0) out.zero++
  }
  return out
}

describe.each(names)('%s', (name) => {
  const golden = goldenOf(name)
  const file = parseXer(bytesOf(name))

  it('declares the golden tables, in order, with the golden row counts', () => {
    const seen = [...file.tables.values()].map((t) => ({ name: t.name, rows: t.rows.length }))
    expect(seen).toEqual(golden.tables)
  })

  it('reads the golden assertions by field name', () => {
    const a = golden.assertions
    expect({
      data_date: dataDate(file),
      project_row_count: rows(file, 'PROJECT').length,
      distinct_task_proj_id: new Set(values(file, 'TASK', 'proj_id')).size,
      activity_count: rows(file, 'TASK').length,
      status_mix: tally(values(file, 'TASK', 'status_code')),
      activity_type_mix: tally(values(file, 'TASK', 'task_type')),
      relationship_type_mix: tally(values(file, 'TASKPRED', 'pred_type')),
      constraint_mix: tally(values(file, 'TASK', 'cstr_type'), '(empty)'),
      float_hr: floatTally(file),
      wbs: { node_count: rows(file, 'PROJWBS').length, max_depth: wbsDepth(file) },
      calendar_count: rows(file, 'CALENDAR').length,
      calendars_in_use: new Set(values(file, 'TASK', 'clndr_id')).size,
      resource_count: rows(file, 'RSRC').length,
      resource_assignment_count: rows(file, 'TASKRSRC').length,
      activity_code_assignment_count: rows(file, 'TASKACTV').length,
      external_relationship_count: externalRelationships(file),
      driving_path_flag_count: values(file, 'TASK', 'driving_path_flag').filter((v) => v === 'Y')
        .length,
    }).toEqual({
      data_date: a.data_date,
      project_row_count: a.project_row_count,
      distinct_task_proj_id: a.distinct_task_proj_id,
      activity_count: a.activity_count,
      status_mix: a.status_mix,
      activity_type_mix: a.activity_type_mix,
      relationship_type_mix: a.relationship_type_mix,
      constraint_mix: a.constraint_mix,
      float_hr: a.float_hr,
      wbs: a.wbs,
      calendar_count: a.calendar_count,
      calendars_in_use: a.calendars_in_use,
      resource_count: a.resource_count,
      resource_assignment_count: a.resource_assignment_count,
      activity_code_assignment_count: a.activity_code_assignment_count,
      external_relationship_count: a.external_relationship_count,
      driving_path_flag_count: a.driving_path_flag_count,
    })
  })

  it('reproduces the golden activity dump cell for cell', () => {
    const dump = golden.tasks ?? []
    const task = file.tables.get('TASK')
    if (dump.length === 0) {
      expect(task?.rows.length ?? 0).toBe(0)
      return
    }
    const table = task as XerTable
    const byCode = new Map(table.rows.map((row) => [cell(table, row, 'task_code'), row]))
    for (const expected of dump) {
      const row = byCode.get(String(expected.task_code))
      expect(row, `activity ${String(expected.task_code)}`).toBeDefined()
      for (const [field, want] of Object.entries(expected)) {
        // A field absent from this file's `%F` is `undefined`, not `''` — the parser must not
        // flatten "absent from source" into "empty" (contract, §3.10).
        const got = cell(table, row as readonly string[], field)
        if (got === undefined) continue
        expect(got, `${String(expected.task_code)}.${field}`).toBe(
          want === null ? '' : String(want),
        )
      }
    }
  })
})

describe('the tokenizer', () => {
  it('keeps an unknown table rather than discarding it, and says so (§2.5)', () => {
    const file = parseXer(bytesOf('unknown-table-and-enum'))
    const unknown = file.tables.get('ZZUNKNOWN')
    expect(unknown?.rows).toHaveLength(2)
    expect(file.issues.some((i) => i.table === 'ZZUNKNOWN' && i.severity === 'info')).toBe(true)
    // POBS is in real exports and in no Oracle list; it must not be reported as a surprise.
    expect(file.issues.some((i) => i.table === 'POBS')).toBe(false)
  })

  it('keeps enum values it has never seen, verbatim (§2.4)', () => {
    const file = parseXer(bytesOf('unknown-table-and-enum'))
    expect(values(file, 'TASK', 'task_type')).toContain('TT_LOE')
    expect(values(file, 'TASK', 'task_type')).toContain('TT_WBS')
    expect(values(file, 'TASKPRED', 'pred_type')).toContain('PR_SF')
    expect(values(file, 'TASK', 'cstr_type')).toContain('CS_MANDFIN')
    expect(file.issues.some((i) => i.severity === 'error')).toBe(false)
  })

  it('notes a value outside the observed enumerations without rejecting it', () => {
    const file = parseXer(
      ['%T\tTASK', '%F\ttask_id\ttask_type', '%R\t1\tTT_Invented', '%E', ''].join('\r\n'),
    )
    expect(values(file, 'TASK', 'task_type')).toEqual(['TT_Invented'])
    expect(file.issues).toContainEqual({
      severity: 'info',
      reason: 'task_type value TT_Invented is outside the observed set; kept as written (§2.4)',
      table: 'TASK',
    })
  })

  it('joins a row broken by free text and logs that it did (§2.3)', () => {
    const file = parseXer(bytesOf('text-multiline'))
    const task = file.tables.get('TASK') as XerTable
    const names = new Map(
      task.rows.map((r) => [cell(task, r, 'task_code'), cell(task, r, 'task_name')]),
    )
    expect(names.get('A001030')).toBe('Install Switchgear\r\n(second line of the name)')
    // A lone CR is data, not a line ending: only a *trailing* CR belongs to the CRLF (§2.3).
    expect(names.get('A001070')).toBe('Cast Base Slab\rphase 2')
    expect(file.issues.some((i) => i.severity === 'info' && i.reason.includes('joined'))).toBe(true)
    expect(file.issues.some((i) => i.severity === 'error')).toBe(false)
  })

  it('marks a file that ends with %E as terminated, and one that does not as not', () => {
    expect(parseXer(bytesOf('missing-taskpred')).terminated).toBe(true)
    expect(parseXer(bytesOf('enc-truncated-export')).terminated).toBe(false)
    expect(parseXer(bytesOf('enc-zeroed-file')).terminated).toBe(false)
  })

  it('reports no tokenizer problem on the truncated export, which is why §5.3 reads bytes', () => {
    const file = parseXer(bytesOf('enc-truncated-export'))
    // Perfect header, whole tables, correct arity on every row — and the zero padding lands
    // inside the last `UDFVALUE` row at the right arity, with nothing reporting a problem.
    expect(file.issues.filter((i) => i.severity !== 'info')).toEqual([])
    const udf = file.tables.get('UDFVALUE') as XerTable
    const last = udf.rows[udf.rows.length - 1] as readonly string[]
    const code = cell(udf, last, 'udf_code_id') as string
    expect(code.startsWith('\r\n')).toBe(true)
    expect(code.split(String.fromCharCode(0))).toHaveLength(3443)
  })

  it('finds nothing at all in a wholly zeroed file, and does not pretend otherwise', () => {
    const file = parseXer(bytesOf('enc-zeroed-file'))
    expect(file.tables.size).toBe(0)
    expect(file.header).toBeNull()
    expect(file.terminated).toBe(false)
    expect(file.issues.some((i) => i.severity === 'error')).toBe(true)
  })

  it('reads the header, including the fields no P6 column names', () => {
    const file = parseXer(bytesOf('ver-83-fieldset'))
    expect(file.header).toEqual({
      version: '8.3',
      exportedOn: '2026-08-07',
      exportType: 'Project',
      userLogin: 'admin',
      userName: 'Primavera Admin',
      databaseName: 'dbxDatabaseNoName',
      currency: 'USD',
      raw: [
        'ERMHDR',
        '8.3',
        '2026-08-07',
        'Project',
        'admin',
        'Primavera Admin',
        'dbxDatabaseNoName',
        'Project Management',
        'USD',
      ],
    })
  })

  it('tells a field absent from %F apart from a field present and empty (§3.10)', () => {
    const file = parseXer(bytesOf('ver-83-fieldset'))
    const task = file.tables.get('TASK') as XerTable
    const row = task.rows[0] as readonly string[]
    expect(cell(task, row, 'review_type')).toBeUndefined() // 6.0 only
    expect(cell(task, row, 'location_id')).toBe('') // 8.3 only, and empty here
    expect(reader(task, 'review_type')).toBeNull()
  })
})

describe('the failures that leave nothing to publish (§5.3 reject 3)', () => {
  it('throws when %R has no %F', () => {
    expect(() => parseXer('%T\tTASK\r\n%R\t1\t2\r\n%E\r\n')).toThrow(XerParseError)
  })

  it('throws when %F has no %T', () => {
    expect(() => parseXer('%F\ttask_id\r\n%E\r\n')).toThrow(XerParseError)
  })

  it('throws when a row cannot be reconciled to its own %F arity', () => {
    let thrown: XerParseError | null = null
    try {
      parseXer('%T\tTASK\r\n%F\ta\tb\tc\r\n%R\t1\t2\r\n%E\r\n')
    } catch (error) {
      thrown = error as XerParseError
    }
    // The planner reads `message`; `failure_detail` is operator-only and names the row (§5.11).
    expect(thrown?.message).toBe('This file is corrupt or truncated — re-export it from P6.')
    expect(thrown?.detail).toBe('TASK row at line 3 has 2 fields against the 3 its %F declares')
  })

  it('throws on a row with more cells than the table declares', () => {
    expect(() => parseXer('%T\tTASK\r\n%F\ta\tb\r\n%R\t1\t2\t3\r\n%E\r\n')).toThrow(XerParseError)
  })
})

/**
 * §2.7 as a test rather than a note. `ver-60-fieldset` and `ver-83-fieldset` are the same
 * programme under both `%F` contracts; read by name they are identical, and a parser reading by
 * position is wrong on one of them silently, with no arity error to catch it.
 */
describe('version drift', () => {
  const sixty = parseXer(bytesOf('ver-60-fieldset'))
  const eightThree = parseXer(bytesOf('ver-83-fieldset'))

  it('is the same programme declared under different field sets and different orders', () => {
    const a = sixty.tables.get('TASK') as XerTable
    const b = eightThree.tables.get('TASK') as XerTable
    expect(a.fields).not.toEqual(b.fields)
    expect(a.fields.length).not.toBe(b.fields.length)
    expect(a.index.get('status_code')).not.toBe(b.index.get('status_code'))
    expect(sixty.header?.version).toBe('6.0')
    expect(eightThree.header?.version).toBe('8.3')
  })

  it('reads identically by name across every field the two files share', () => {
    for (const [name, left] of sixty.tables) {
      const right = eightThree.tables.get(name)
      if (right === undefined) continue
      expect(left.rows.length, `${name} row count`).toBe(right.rows.length)
      const shared = left.fields.filter((f) => right.index.has(f))
      expect(shared.length).toBeGreaterThan(0)
      for (let r = 0; r < left.rows.length; r++) {
        const leftRow = left.rows[r] as readonly string[]
        const rightRow = right.rows[r] as readonly string[]
        for (const field of shared) {
          expect(cell(left, leftRow, field), `${name}.${field} row ${r}`).toBe(
            cell(right, rightRow, field),
          )
        }
      }
    }
  })

  it('would have read the wrong column positionally, with no arity error to catch it', () => {
    const a = sixty.tables.get('TASK') as XerTable
    const b = eightThree.tables.get('TASK') as XerTable
    const at = a.index.get('status_code') as number
    // The incident §2.7 records: index 13 is `status_code` in the 6.0 file and `task_name` in
    // the 8.3 file. Both rows are complete; only the meaning moved.
    expect(b.fields[at]).toBe('task_name')
    const rowA = a.rows[0] as readonly string[]
    const rowB = b.rows[0] as readonly string[]
    expect(rowA[at]).toBe('TK_NotStart')
    expect(rowB[at]).not.toBe('TK_NotStart')
    expect(cell(b, rowB, 'status_code')).toBe('TK_NotStart')
  })
})
