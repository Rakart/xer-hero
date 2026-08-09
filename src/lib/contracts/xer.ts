/**
 * The parser's output shape — the seam between `lib/xer` and everything downstream.
 *
 * One rule shapes this whole file, and it is the rule that survives version drift (§2.7):
 * **never index a field by position.** Between the 6.0 and 8.3 exports of the same
 * programme, `TASK` moves from 61 fields to 60 and `PROJECT` from 71 to 66, and the field
 * *order* differs too — so a positional parser reads correct data from one file and wrong
 * data from the other, silently, with no arity mismatch to catch it. Rows are therefore
 * opaque `string[]` reachable only through the table's own `%F` index, and callers are
 * expected to build their name→index lookup once per table per file.
 */

/** A raw cell. Every value in a `.xer` is text; typing happens downstream. */
export type XerCell = string

/**
 * One table as the file declared it: a `%T` name, a `%F` field list, and its `%R` rows.
 *
 * `index` is the `Map<fieldName, position>` built from this file's own `%F` line. It is
 * the only sanctioned way to reach a cell.
 */
export interface XerTable {
  readonly name: string
  readonly fields: readonly string[]
  readonly index: ReadonlyMap<string, number>
  readonly rows: readonly (readonly XerCell[])[]
}

/**
 * The `ERMHDR` line. Present on every well-formed export and the source of `p6_version`,
 * which is a facet column — recorded, never rejected on (§2.7).
 */
export interface XerHeader {
  /** e.g. `"8.3"`. Never a rejection reason. */
  readonly version: string
  /** Export date as written, naive local wall-clock. */
  readonly exportedOn: string | null
  /**
   * P6's export *type* — the literal `Project` on every file measured. It is **not** a human
   * project name: `ERMHDR` carries none at all, and the title prefill comes from the root
   * `PROJWBS.wbs_name` (§5.4). The field was called `projectName` in this contract's first
   * draft, which invited exactly the wrong read.
   */
  readonly exportType: string | null
  /** Fields that feed the pre-publish personal-data panel only (§2.5, §7.9). */
  readonly userLogin: string | null
  readonly userName: string | null
  readonly databaseName: string | null
  readonly currency: string | null
  /** Every field of the header line, in order, for anything the panel needs later. */
  readonly raw: readonly string[]
}

/** Severity vocabulary shared with `derived.json`'s `issues[]` (§3.10). */
export type IssueSeverity = 'info' | 'warn' | 'error'

/**
 * Something the parser noticed but did not reject on. Only tokenizer failure rejects an
 * upload (§3.10) — if `%T`/`%F`/`%R` cannot be read there is nothing to publish. Everything
 * else is recorded and the programme publishes anyway.
 */
export interface ParseIssue {
  readonly severity: IssueSeverity
  readonly reason: string
  /** Table the issue was found in, where it belongs to one. */
  readonly table?: string
  /** 1-based line number in the decoded text, for `failure_detail` — position, never bytes. */
  readonly line?: number
}

/** A parsed `.xer`. Unknown tables are normal and are kept, not discarded (§2.5). */
export interface XerFile {
  readonly header: XerHeader | null
  /** Keyed by `%T` name, in the order the file declared them. */
  readonly tables: ReadonlyMap<string, XerTable>
  readonly issues: readonly ParseIssue[]
  /** True when the file ended with `%E`. A truncated export does not (§9.2). */
  readonly terminated: boolean
}

/** Thrown only for the failures that make a file unpublishable (§3.10). */
export class XerParseError extends Error {
  readonly detail: string
  constructor(message: string, detail = '') {
    super(message)
    this.name = 'XerParseError'
    this.detail = detail
  }
}

/**
 * Reads one cell by field name.
 *
 * Returns `undefined` when the field is **absent from this file's `%F` list** — a real
 * distinction from a field that is present and empty, which returns `''`. §3.10 turns that
 * difference into two different states ("absent from source" versus a bare value), so the
 * parser must not flatten it.
 */
export function cell(table: XerTable, row: readonly XerCell[], field: string): XerCell | undefined {
  const i = table.index.get(field)
  if (i === undefined) return undefined
  return row[i]
}

/**
 * Builds a reusable accessor for one field of one table — the `Map<fieldName, index>` rule
 * (§2.7) applied once rather than per row. Returns `null` when the field is absent from the
 * file, which lets a caller decide between a fallback and an `issues[]` entry once instead
 * of on every row.
 */
export function reader(
  table: XerTable,
  field: string,
): ((row: readonly XerCell[]) => XerCell) | null {
  const i = table.index.get(field)
  if (i === undefined) return null
  return (row) => row[i] ?? ''
}

/** Every field name the table declared carries a value, keyed. For small tables and debug. */
export function toRecord(table: XerTable, row: readonly XerCell[]): Record<string, XerCell> {
  const out: Record<string, XerCell> = {}
  for (let i = 0; i < table.fields.length; i++) {
    const name = table.fields[i]
    if (name !== undefined) out[name] = row[i] ?? ''
  }
  return out
}
