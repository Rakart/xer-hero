/**
 * The tokenizer: `ERMHDR` / `%T` / `%F` / `%R` / `%E` into the contract shape (§2.3).
 *
 * Oracle documents the field mappings and not the grammar, so every rule here is observed from
 * real exports. Two of them decide the shape of this module:
 *
 * - **Never index a field by position** (§2.7). The `Map<fieldName, index>` is built from each
 *   table's own `%F` line, per table, per file, and is the only thing a caller may read a cell
 *   through. Between the 6.0 and 8.3 exports of one programme `TASK` index 13 is `status_code`
 *   in one file and `task_name` in the other, with matching arity and no error to catch it.
 * - **Only tokenizer failure rejects a file** (§3.10, §5.3). If `%T`/`%F`/`%R` cannot be read
 *   there is nothing to publish, so that throws. Unknown tables, unknown enum values, missing
 *   tables and mojibake are recorded in `issues[]` and parsing continues.
 *
 * The grammar is emitted to a visitor rather than straight into a structure, because the same
 * tokenizer drives two collectors (§5.2): a retaining one that builds tables on the server, and
 * a discarding one that updates counters in the browser. A row reaches the visitor as the raw
 * tab-joined text, so a collector that only counts `TASKACTV` never pays to split it — on a
 * 20,000-activity export 92.9% of records have no field extracted.
 */

import { RELATIONSHIP_TYPES, STATUS_CODES, TASK_TYPES } from '@/lib/contracts/domain'
import {
  type ParseIssue,
  type XerCell,
  type XerFile,
  type XerHeader,
  XerParseError,
  type XerTable,
} from '@/lib/contracts/xer'
import { decodeCp1252WithReport } from './decode'

/** What the planner is told when the grammar itself will not read (§5.3 reject 3). */
export const TOKENIZER_FAILURE_MESSAGE = 'This file is corrupt or truncated — re-export it from P6.'

/**
 * An unbounded `issues[]` is a memory leak on a hostile 60 MB file, and a screen cannot render
 * ten thousand notes anyway. The cap is announced by the last entry rather than left silent.
 */
const MAX_ISSUES = 200

/**
 * Tables observed in real exports plus the ones the corpus carries. It exists to make an
 * unfamiliar `%T` *visible*, never to filter one: `POBS` is in real files, is read by nothing,
 * and appears in no Oracle list at all (§2.5). Unknown tables are kept verbatim.
 */
const TABLES_SEEN_IN_REAL_EXPORTS: ReadonlySet<string> = new Set([
  'ACTVCODE',
  'ACTVTYPE',
  'CALENDAR',
  'CURRTYPE',
  'DOCUMENT',
  'OBS',
  'PCATTYPE',
  'PCATVAL',
  'POBS',
  'PROJECT',
  'PROJPCAT',
  'PROJWBS',
  'RSRC',
  'RSRCRATE',
  'SCHEDOPTIONS',
  'TASK',
  'TASKACTV',
  'TASKMEMO',
  'TASKPRED',
  'TASKRSRC',
  'TASKUSER',
  'UDFTYPE',
  'UDFVALUE',
  'UMEASURE',
])

type Marker = '%T' | '%F' | '%R' | '%E' | 'ERMHDR'

export interface XerVisitor {
  /** The `ERMHDR` line, split. It does not start with `%`, so a `^%` parser misses it (§2.3). */
  header?(fields: readonly string[], line: number): void
  table?(name: string, line: number): void
  /** `index` is this table's own name→position map — the one sanctioned reach into a row. */
  fields?(
    table: string,
    fields: readonly string[],
    index: ReadonlyMap<string, number>,
    line: number,
  ): void
  /**
   * One `%R`, as the raw text after the marker. Deliberately unsplit: `arity` is already
   * counted, so a collector that only wants a row count never touches the cells (§5.2).
   */
  row?(table: string, cells: string, arity: number, line: number): void
  end?(line: number): void
  issue?(issue: ParseIssue): void
}

/**
 * Reads the grammar and emits records. Throws `XerParseError` for the three failures that leave
 * nothing to publish: a `%F` outside a table, a `%R` with no `%F`, and a row that cannot be
 * reconciled to its table's declared arity.
 */
export function tokenize(text: string, visitor: XerVisitor): void {
  let lineNo = 0
  let table: string | null = null
  let fields: string[] | null = null

  // The open `%R`. Free text may carry a newline — nothing in the format escapes one — so a
  // line that does not begin with a marker continues the previous row and the arity is checked
  // once the row closes (§2.3). This is where a naive line-splitter silently corrupts real data.
  let pending: string | null = null
  let pendingLine = 0
  let pendingJoins = 0

  const closePending = (): void => {
    if (pending === null) return
    const declared = fields as string[]
    const arity = countCells(pending)
    if (arity !== declared.length) {
      throw new XerParseError(
        TOKENIZER_FAILURE_MESSAGE,
        `${table ?? '?'} row at line ${pendingLine} has ${arity} field${
          arity === 1 ? '' : 's'
        } against the ${declared.length} its %F declares`,
      )
    }
    if (pendingJoins > 0) {
      visitor.issue?.({
        severity: 'info',
        reason: `row joined from ${pendingJoins + 1} lines — free text carries a newline and the format has no escaping (§2.3)`,
        table: table ?? undefined,
        line: pendingLine,
      })
    }
    visitor.row?.(table as string, pending, arity, pendingLine)
    pending = null
    pendingJoins = 0
  }

  // The line ending that preceded the line being read. A continuation restores it verbatim, so
  // a joined value carries the bytes the file actually held.
  let separator = '\n'

  let pos = 0
  while (pos < text.length) {
    const newline = text.indexOf('\n', pos)
    const stop = newline === -1 ? text.length : newline
    // CRLF is the observed line ending. Only the *trailing* CR is stripped, because
    // `text-multiline` carries a lone CR inside a `task_name` and it is data (§2.3).
    const hadCr = stop > pos && text.charCodeAt(stop - 1) === 13
    const line = text.slice(pos, hadCr ? stop - 1 : stop)
    const before = separator
    separator = hadCr ? '\r\n' : '\n'
    pos = stop + 1
    lineNo++

    const marker = markerOf(line)
    if (marker === null) {
      if (pending === null) {
        if (line.length > 0) {
          visitor.issue?.({
            severity: 'error',
            reason: `line is not a record and there is no open row to continue it (${line.length} characters)`,
            line: lineNo,
          })
        }
        continue
      }
      pending += before + line
      pendingJoins++
      continue
    }

    closePending()

    if (marker === 'ERMHDR') {
      if (lineNo !== 1) {
        visitor.issue?.({ severity: 'warn', reason: 'ERMHDR after line 1', line: lineNo })
      }
      visitor.header?.(line.split('\t'), lineNo)
      continue
    }
    if (marker === '%T') {
      table = rest(line)
      fields = null
      if (table.length === 0) {
        visitor.issue?.({ severity: 'warn', reason: '%T declares no table name', line: lineNo })
      }
      visitor.table?.(table, lineNo)
      continue
    }
    if (marker === '%F') {
      if (table === null) {
        throw new XerParseError(
          TOKENIZER_FAILURE_MESSAGE,
          `%F at line ${lineNo} has no %T before it`,
        )
      }
      if (fields !== null) {
        visitor.issue?.({
          severity: 'warn',
          reason: 'second %F for one %T; the later field list governs the rows after it',
          table,
          line: lineNo,
        })
      }
      fields = rest(line).split('\t')
      visitor.fields?.(table, fields, indexOf(fields), lineNo)
      continue
    }
    if (marker === '%R') {
      if (fields === null) {
        throw new XerParseError(
          TOKENIZER_FAILURE_MESSAGE,
          `%R at line ${lineNo} has no %F before it${table === null ? ' and no %T' : ` in ${table}`}`,
        )
      }
      pending = rest(line)
      pendingLine = lineNo
      pendingJoins = 0
      continue
    }
    visitor.end?.(lineNo)
  }

  closePending()
}

/** A parsed `.xer`. Unknown tables are normal and are kept, not discarded (§2.5). */
export function parseXer(input: Uint8Array | string): XerFile {
  const issues: ParseIssue[] = []
  let suppressed = 0
  const record = (issue: ParseIssue): void => {
    if (issues.length < MAX_ISSUES) issues.push(issue)
    else suppressed++
  }

  let text: string
  if (typeof input === 'string') {
    text = input
  } else {
    const decoded = decodeCp1252WithReport(input)
    text = decoded.text
    if (decoded.undefinedByteCount > 0) {
      record({
        severity: 'info',
        reason: `${decoded.undefinedByteCount} byte(s) undefined in CP1252 (0x81, 0x8D, 0x8F, 0x90, 0x9D) decoded leniently — never a rejection (§2.3)`,
      })
    }
    if (decoded.utf8SequenceCount > 0) {
      record({
        severity: 'info',
        reason: `${decoded.utf8SequenceCount} run(s) also read as UTF-8 inside a CP1252 file; read as CP1252 (§2.3)`,
      })
    }
  }

  const builders = new Map<string, TableBuilder>()
  let header: XerHeader | null = null
  let terminated = false
  let current: TableBuilder | null = null
  // Set when a table is re-declared with a different `%F`: incoming cells are placed by name
  // into the first declaration's order, which is the §2.7 rule applied to the file's own drift.
  let remap: number[] | null = null

  tokenize(text, {
    header(fields) {
      header = headerFrom(fields)
      terminated = false
    },
    table(name) {
      current = builders.get(name) ?? null
      remap = null
      // `terminated` is a claim about the *end* of the file, so a table after an `%E` — two
      // exports concatenated — retracts it. The scan re-checks the same thing on the bytes (§5.3).
      terminated = false
      if (current === null) {
        current = { name, fields: [], index: new Map(), rows: [] }
        builders.set(name, current)
        if (!TABLES_SEEN_IN_REAL_EXPORTS.has(name)) {
          record({
            severity: 'info',
            reason: 'table is in no observed export and in no Oracle list; kept verbatim (§2.5)',
            table: name,
          })
        }
      }
    },
    fields(name, incoming, index) {
      const builder = current as TableBuilder
      if (builder.fields.length === 0) {
        builder.fields = [...incoming]
        builder.index = index
        return
      }
      if (sameFields(builder.fields, incoming)) {
        remap = null
        return
      }
      record({
        severity: 'warn',
        reason: 'table declared twice with different %F; later rows placed by field name (§2.7)',
        table: name,
      })
      remap = incoming.map((field) => builder.index.get(field) ?? -1)
    },
    row(_name, cells) {
      const builder = current as TableBuilder
      const split = cells.split('\t')
      if (remap === null) {
        builder.rows.push(split)
        return
      }
      const placed: XerCell[] = new Array(builder.fields.length).fill('')
      for (let i = 0; i < split.length; i++) {
        const target = remap[i] ?? -1
        if (target >= 0) placed[target] = split[i] as string
      }
      builder.rows.push(placed)
    },
    end() {
      if (terminated) record({ severity: 'warn', reason: 'more than one %E' })
      terminated = true
    },
    issue: record,
  })

  const tables = new Map<string, XerTable>()
  for (const [name, builder] of builders) {
    if (builder.fields.length === 0) {
      record({ severity: 'warn', reason: 'table declared with no %F and no rows', table: name })
    }
    tables.set(name, {
      name,
      fields: builder.fields,
      index: builder.index,
      rows: builder.rows,
    })
  }

  noteOpenEnumerations(tables, record)

  if (suppressed > 0) {
    issues.push({
      severity: 'info',
      reason: `${suppressed} further issue(s) not recorded (cap ${MAX_ISSUES})`,
    })
  }

  return { header, tables, issues, terminated }
}

interface TableBuilder {
  name: string
  fields: string[]
  index: ReadonlyMap<string, number>
  rows: XerCell[][]
}

/**
 * The header, positionally — the one place in the format where position is the contract, because
 * `ERMHDR` carries no field names. Position 4 is P6's export *type*, written as the literal
 * `Project`; the contract names that field `exportType` and it is reproduced here as-is rather
 * than reinterpreted. Position 8, the module, is reachable through `raw` (§2.3).
 */
function headerFrom(fields: readonly string[]): XerHeader {
  const at = (i: number): string | null => {
    const value = fields[i]
    return value === undefined || value === '' ? null : value
  }
  return {
    version: fields[1] ?? '',
    exportedOn: at(2),
    exportType: at(3),
    userLogin: at(4),
    userName: at(5),
    databaseName: at(6),
    currency: at(8),
    raw: [...fields],
  }
}

/**
 * Notes values outside the observed enumerations. These lists are incomplete by construction —
 * one programme cannot exhibit every code — so an unknown value is `info` and the raw string is
 * kept exactly as the file wrote it (§2.4). `unknown-table-and-enum.xer` holds this line.
 */
function noteOpenEnumerations(
  tables: ReadonlyMap<string, XerTable>,
  record: (issue: ParseIssue) => void,
): void {
  const checks: [string, string, readonly string[]][] = [
    ['TASK', 'task_type', TASK_TYPES],
    ['TASK', 'status_code', STATUS_CODES],
    ['TASKPRED', 'pred_type', RELATIONSHIP_TYPES],
  ]
  for (const [name, field, known] of checks) {
    const table = tables.get(name)
    const at = table?.index.get(field)
    if (table === undefined || at === undefined) continue
    const unknown = new Set<string>()
    for (const row of table.rows) {
      const value = row[at]
      if (value !== undefined && value !== '' && !known.includes(value)) unknown.add(value)
    }
    for (const value of unknown) {
      record({
        severity: 'info',
        reason: `${field} value ${value} is outside the observed set; kept as written (§2.4)`,
        table: name,
      })
    }
  }
}

function markerOf(line: string): Marker | null {
  if (line.charCodeAt(0) === 37 /* % */) {
    if (line.length !== 2 && line.charCodeAt(2) !== 9 /* tab */) return null
    switch (line.charCodeAt(1)) {
      case 84:
        return '%T'
      case 70:
        return '%F'
      case 82:
        return '%R'
      case 69:
        return '%E'
      default:
        return null
    }
  }
  // `ERMHDR` is the one record that does not start with `%` — a parser matching `^%` misses it.
  return line.startsWith('ERMHDR') ? 'ERMHDR' : null
}

/** Everything after the marker and its tab. `%E` alone carries nothing. */
function rest(line: string): string {
  return line.length > 2 ? line.slice(3) : ''
}

function countCells(row: string): number {
  let cells = 1
  for (let i = 0; i < row.length; i++) if (row.charCodeAt(i) === 9) cells++
  return cells
}

function indexOf(fields: readonly string[]): ReadonlyMap<string, number> {
  const index = new Map<string, number>()
  for (let i = 0; i < fields.length; i++) {
    const name = fields[i] as string
    if (!index.has(name)) index.set(name, i)
  }
  return index
}

function sameFields(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((name, i) => name === b[i])
}
