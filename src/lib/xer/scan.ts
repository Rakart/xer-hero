/**
 * The pre-upload scan (§5.2) and the rejections it decides (§5.3).
 *
 * **It is a scan, not a parse.** The upload screen needs the activity count, the P6 version, the
 * date range, the WBS shape, the multi-project check, the dedup hash and the metadata prefill —
 * and not one of those needs a table held whole. This collector splits `PROJECT`, `TASK`,
 * `PROJWBS` and `RSRC` and counts everything else, which is why the tables that make a `.xer`
 * big — `TASKACTV`, `UDFVALUE`, `TASKRSRC`, `TASKPRED` — cost a row counter apiece.
 *
 * It runs the same tokenizer as the full parse (§5.2, one tokenizer and two drivers), so the
 * rules are written once and run twice; only the collection strategy differs.
 *
 * The readability guard is decided **on the bytes, before anything is derived from them**
 * (§5.3), because a scan that counts what it recognises counts zero of everything on a wholly
 * zeroed file and reports success — one real file in 139 is 397,781 bytes of pure `NUL`.
 */

import { MAX_ACTIVITIES, MAX_FILE_BYTES } from '@/lib/contracts/domain'
import type { ParseIssue, XerHeader } from '@/lib/contracts/xer'
import { XerParseError } from '@/lib/contracts/xer'
import { decodeCp1252WithReport } from './decode'
import { TOKENIZER_FAILURE_MESSAGE, tokenize } from './parse'

/** Above twice the cap nothing is read: no single-project P6 export is that large (§5.3). */
export const NO_READ_ABOVE_BYTES = MAX_FILE_BYTES * 2

/** The panel enumerates values, not counts, and every list it feeds is bounded (§1). */
export const PERSONAL_DATA_LIST_CAP = 500

/** A screen cannot render ten thousand notes, and a hostile file will happily produce them. */
const MAX_ISSUES = 200

export interface ScanWbsShape {
  node_count: number
  max_depth: number
}

export interface ScanResource {
  name: string
  type: string
  email: string
  office_phone: string
  other_phone: string
  employee_code: string
  has_notes: boolean
}

/**
 * What the pre-publish personal-data panel renders (§7.9). Advisory: it blocks nothing, and
 * there is no server-side PI detector anywhere in the ingest path.
 */
export interface ScanPersonalData {
  export_login: string | null
  export_user_name: string | null
  project_add_by_name: string | null
  /** Distinct `create_user`/`update_user` across the tables that declare them. */
  edit_users: string[]
  resources: ScanResource[]
  /** Free text is a count and a label, never a judgement — nothing here has been reviewed. */
  free_text: { table: string; field: string; rows: number }[]
  /** True when any list above hit `PERSONAL_DATA_LIST_CAP`. */
  truncated: boolean
}

export interface ScanResult {
  bytes: number
  /**
   * SHA-256 hex over the file's bytes, or `null` where WebCrypto is absent — `crypto.subtle` is
   * gated on a secure origin, so a LAN-IP page loses the hash and nothing else (§5.2). Nothing
   * the client computes is persisted; ingest recomputes this from the decompressed bytes.
   */
  content_hash: string | null

  // --- readability, measured off the bytes (§5.3 reject 1) --------------------
  starts_with_ermhdr: boolean
  reaches_end_marker: boolean
  nul_byte_count: number
  trailing_nul_run: number
  /** Bytes before the trailing `NUL` run — how far the file reads correctly. */
  complete_bytes: number

  // --- the grammar -----------------------------------------------------------
  tokenizer_ok: boolean
  tokenizer_detail: string | null

  // --- the programme ---------------------------------------------------------
  p6_version: string | null
  exported_on: string | null
  header: XerHeader | null
  /** Every `%T` in declaration order with its `%R` count. Unknown tables included (§2.5). */
  table_row_counts: Record<string, number>
  activity_count: number
  /** The multi-project discriminator, never the `PROJECT` row count (§5.3). */
  distinct_task_proj_id: number
  project_row_count: number
  owning_proj_id: string | null
  /** `PROJECT.last_recalc_date` — not `scd_end_date`, not `sum_data_date` (§2.2). */
  data_date: string | null
  plan_start_date: string | null
  plan_end_date: string | null
  /** Naive local wall-clock as written; the format records no timezone anywhere (§2.3). */
  activity_date_range: { start: string | null; finish: string | null }
  wbs: ScanWbsShape
  calendar_count: number
  /** Distinct `TASK.clndr_id` — a fact about the programme, beside the file's count (§3.3). */
  calendars_in_use: number
  /** Root `PROJWBS.wbs_name`, falling back to `PROJECT.proj_short_name` (§5.4). */
  title_prefill: string | null
  /** `PROJECT.proj_short_name`, the P6 Project ID — the advisory same-project hint (§5.1). */
  p6_project_id: string | null
  personal_data: ScanPersonalData
  issues: ParseIssue[]
}

export type ScanGuard =
  | 'oversize'
  | 'unreadable'
  | 'not_xer'
  | 'tokenizer'
  | 'no_activities'
  | 'multi_project'
  | 'activity_cap'
  | 'byte_cap'

export type ScanVerdict =
  | { accept: true }
  | { accept: false; guard: ScanGuard; reason: string; message: string }

export interface ScanOptions {
  /** Off where no WebCrypto is reachable, or where the caller already holds the digest. */
  hash?: boolean
}

/**
 * One pass over the bytes produces everything. The byte facts are measured first and
 * independently of the tokenizer, because `enc-truncated-export` reports zero tokenizer problems
 * and correct arity on every row (§9.4).
 */
export async function scanXer(bytes: Uint8Array, options: ScanOptions = {}): Promise<ScanResult> {
  const collected = collect(bytes)
  const content_hash = options.hash === false ? null : await sha256Hex(bytes)
  return { ...collected, content_hash }
}

/** The same scan without the digest, for a caller that has no `crypto.subtle` or does not want one. */
export function scanXerSync(bytes: Uint8Array): ScanResult {
  return { ...collect(bytes), content_hash: null }
}

/**
 * The guards in the order §5.3 fixes, so "which fired" is never ambiguous. Size is checked by
 * the caller before any read; everything below it is a function of one `ScanResult`, which is
 * also what ingest re-evaluates from its own full parse.
 */
export function scanVerdict(scan: ScanResult): ScanVerdict {
  if (scan.bytes > NO_READ_ABOVE_BYTES) return oversizeVerdict(scan.bytes)

  if (!scan.reaches_end_marker || scan.nul_byte_count > 0) {
    return {
      accept: false,
      guard: 'unreadable',
      reason: unreadableReason(scan),
      message: unreadableMessage(scan),
    }
  }
  if (!scan.starts_with_ermhdr) {
    return {
      accept: false,
      guard: 'not_xer',
      reason: 'no ERMHDR on line 1',
      message: 'This is not a Primavera XER export.',
    }
  }
  if (!scan.tokenizer_ok) {
    return {
      accept: false,
      guard: 'tokenizer',
      reason: scan.tokenizer_detail ?? 'the %T/%F/%R grammar would not read',
      message: TOKENIZER_FAILURE_MESSAGE,
    }
  }
  if (scan.activity_count === 0) {
    return {
      accept: false,
      guard: 'no_activities',
      reason: 'TASK absent or empty',
      message: 'This export contains no activities.',
    }
  }
  if (scan.distinct_task_proj_id > 1) {
    return {
      accept: false,
      guard: 'multi_project',
      reason: 'distinct TASK.proj_id > 1',
      message: `This export contains ${scan.distinct_task_proj_id} projects — export a single project and upload again.`,
    }
  }
  if (scan.activity_count > MAX_ACTIVITIES) {
    return {
      accept: false,
      guard: 'activity_cap',
      reason: `activities ${scan.activity_count} > ${MAX_ACTIVITIES}`,
      message: `This export has ${group(scan.activity_count)} activities. xer-hero accepts up to ${group(MAX_ACTIVITIES)}.`,
    }
  }
  if (scan.bytes > MAX_FILE_BYTES) {
    return {
      accept: false,
      guard: 'byte_cap',
      reason: `raw size ${scan.bytes} > ${MAX_FILE_BYTES}`,
      // The activity count is named too: a file inside the activity cap and over the byte cap is
      // not mostly activities, which is a true and different thing to tell the uploader (§5.3).
      message: `This file is ${megabytes(scan.bytes)}. xer-hero accepts .xer exports up to ${megabytes(MAX_FILE_BYTES)}. It has ${group(scan.activity_count)} activities, which is inside the limit — the size is in the other tables (activity codes, resource assignments, user-defined text).`,
    }
  }
  return { accept: true }
}

/**
 * `File.size` first, because it is free. A file between the cap and twice the cap is still
 * scanned so the byte rejection can name the activity count; above that nothing is read (§5.3).
 */
export function sizeOnlyVerdict(sizeBytes: number): ScanVerdict | null {
  return sizeBytes > NO_READ_ABOVE_BYTES ? oversizeVerdict(sizeBytes) : null
}

function oversizeVerdict(sizeBytes: number): ScanVerdict {
  return {
    accept: false,
    guard: 'oversize',
    reason: `raw size ${sizeBytes} > ${NO_READ_ABOVE_BYTES}, not read`,
    message: `This file is ${megabytes(sizeBytes)}. xer-hero accepts .xer exports up to ${megabytes(MAX_FILE_BYTES)}.`,
  }
}

function unreadableReason(scan: ScanResult): string {
  if (scan.nul_byte_count === scan.bytes && scan.bytes > 0) {
    return `no %E end marker, and ${group(scan.nul_byte_count)} NUL bytes`
  }
  if (!scan.reaches_end_marker && scan.trailing_nul_run > 0) {
    return 'no %E end marker; the file stops on a table boundary and is zero-padded'
  }
  return scan.reaches_end_marker ? 'NUL bytes in a file that ends with %E' : 'no %E end marker'
}

/**
 * Two messages, chosen by whether an `ERMHDR` was ever seen (§5.3). Both end on the same
 * instruction because both have the same fix, and neither calls the planner's data invalid.
 */
function unreadableMessage(scan: ScanResult): string {
  const tail = 'Download or re-export the file, then try again.'
  if (scan.bytes > 0 && scan.nul_byte_count === scan.bytes) {
    return `This file is not a complete P6 export. Every one of its ${group(scan.bytes)} bytes is zero — there is no header, no data and no end-of-file marker in it at all. That is what an interrupted download or a file-sync error leaves behind, not anything P6 wrote. ${tail}`
  }
  if (!scan.starts_with_ermhdr) {
    return `This file is not a complete P6 export. It carries no P6 header and no end-of-file marker, so there is nothing in it to read as a programme. ${tail}`
  }
  return `This file is not a complete P6 export. It reads correctly for its first ${group(scan.complete_bytes)} bytes and then stops — no end-of-file marker, and ${group(scan.trailing_nul_run)} zero bytes on the end. There is no way to tell how much of the programme is missing, so the ${group(scan.activity_count)} activities it does show cannot be taken as the whole of it. ${tail}`
}

// --- collection --------------------------------------------------------------

type Collected = Omit<ScanResult, 'content_hash'>

function collect(bytes: Uint8Array): Collected {
  const readability = readabilityOf(bytes)
  const decoded = decodeCp1252WithReport(bytes)
  const issues: ParseIssue[] = []

  let header: XerHeader | null = null
  const rowCounts: Record<string, number> = {}
  const projIds = new Set<string>()
  const clndrIds = new Set<string>()
  const editUsers = new Set<string>()
  const wbsNodes: { id: string; parent: string; name: string; isProjectNode: boolean }[] = []
  const resources: ScanResource[] = []
  const projects: Record<string, string>[] = []
  let activityCount = 0
  let rsrcNoteRows = 0
  let start: string | null = null
  let finish: string | null = null
  let truncatedLists = false

  // Only the small tables are split. Everything else costs one counter per row (§5.2).
  const SPLIT = new Set(['PROJECT', 'TASK', 'PROJWBS', 'RSRC'])
  let table = ''
  let split = false
  let index: ReadonlyMap<string, number> = new Map()

  const at = (cells: string[], field: string): string => {
    const i = index.get(field)
    return i === undefined ? '' : (cells[i] ?? '')
  }

  let tokenizerOk = true
  let tokenizerDetail: string | null = null

  try {
    tokenize(decoded.text, {
      header(fields) {
        header = headerOf(fields)
      },
      table(name) {
        table = name
        split = SPLIT.has(name)
        index = new Map()
        rowCounts[name] ??= 0
      },
      fields(_name, _list, built) {
        index = built
      },
      row(_name, cells) {
        rowCounts[table] = (rowCounts[table] ?? 0) + 1
        if (!split) return
        const values = cells.split('\t')
        if (table === 'TASK') {
          activityCount++
          projIds.add(at(values, 'proj_id'))
          const clndr = at(values, 'clndr_id')
          if (clndr !== '') clndrIds.add(clndr)
          const began = at(values, 'act_start_date') || at(values, 'early_start_date')
          const ended = at(values, 'act_end_date') || at(values, 'early_end_date')
          // Dates sort lexicographically because `YYYY-MM-DD HH:MM` is fixed-width (§2.3).
          if (began !== '' && (start === null || began < start)) start = began
          if (ended !== '' && (finish === null || ended > finish)) finish = ended
          addUser(editUsers, at(values, 'create_user'))
          addUser(editUsers, at(values, 'update_user'))
          return
        }
        if (table === 'PROJECT') {
          projects.push({
            proj_id: at(values, 'proj_id'),
            proj_short_name: at(values, 'proj_short_name'),
            last_recalc_date: at(values, 'last_recalc_date'),
            plan_start_date: at(values, 'plan_start_date'),
            plan_end_date: at(values, 'plan_end_date'),
            add_by_name: at(values, 'add_by_name'),
          })
          addUser(editUsers, at(values, 'create_user'))
          addUser(editUsers, at(values, 'update_user'))
          return
        }
        if (table === 'PROJWBS') {
          wbsNodes.push({
            id: at(values, 'wbs_id'),
            parent: at(values, 'parent_wbs_id'),
            name: at(values, 'wbs_name'),
            isProjectNode: at(values, 'proj_node_flag') === 'Y',
          })
          return
        }
        if (resources.length < PERSONAL_DATA_LIST_CAP) {
          const notes = at(values, 'rsrc_notes')
          if (notes !== '') rsrcNoteRows++
          resources.push({
            name: at(values, 'rsrc_name'),
            type: at(values, 'rsrc_type'),
            email: at(values, 'email_addr'),
            office_phone: at(values, 'office_phone'),
            other_phone: at(values, 'other_phone'),
            employee_code: at(values, 'employee_code'),
            has_notes: notes !== '',
          })
        } else {
          truncatedLists = true
        }
      },
      issue(issue) {
        if (issues.length < MAX_ISSUES) issues.push(issue)
      },
    })
  } catch (error) {
    // A tokenizer failure is a verdict here, not an exception: readability is decided before it
    // and a zeroed file must be told apart from a corrupt one (§5.3).
    if (!(error instanceof XerParseError)) throw error
    tokenizerOk = false
    tokenizerDetail = error.detail || error.message
  }

  if (decoded.undefinedByteCount > 0) {
    issues.push({
      severity: 'info',
      reason: `${decoded.undefinedByteCount} byte(s) undefined in CP1252 decoded leniently — never a rejection (§2.3)`,
    })
  }

  const owning = owningProject(projects, projIds)
  const rootWbs =
    wbsNodes.find((node) => node.isProjectNode) ?? wbsNodes.find((n) => n.parent === '')
  const parsedHeader = header as XerHeader | null

  return {
    bytes: bytes.length,
    ...readability,
    tokenizer_ok: tokenizerOk,
    tokenizer_detail: tokenizerDetail,
    p6_version: parsedHeader?.version || null,
    exported_on: parsedHeader?.exportedOn ?? null,
    header: parsedHeader,
    table_row_counts: rowCounts,
    activity_count: activityCount,
    distinct_task_proj_id: projIds.size,
    project_row_count: projects.length,
    owning_proj_id: owning?.proj_id ?? null,
    data_date: owning?.last_recalc_date || null,
    plan_start_date: owning?.plan_start_date || null,
    plan_end_date: owning?.plan_end_date || null,
    activity_date_range: { start, finish },
    wbs: { node_count: wbsNodes.length, max_depth: wbsDepth(wbsNodes) },
    calendar_count: rowCounts.CALENDAR ?? 0,
    calendars_in_use: clndrIds.size,
    title_prefill: rootWbs?.name || owning?.proj_short_name || null,
    p6_project_id: owning?.proj_short_name || null,
    personal_data: {
      export_login: parsedHeader?.userLogin ?? null,
      export_user_name: parsedHeader?.userName ?? null,
      project_add_by_name: owning?.add_by_name || null,
      edit_users: [...editUsers].slice(0, PERSONAL_DATA_LIST_CAP),
      resources,
      free_text: freeText(rowCounts, rsrcNoteRows),
      truncated: truncatedLists || editUsers.size > PERSONAL_DATA_LIST_CAP,
    },
    issues,
  }
}

/**
 * A `.xer` is readable only if its last record is `%E` and it carries no `NUL` byte anywhere.
 * Both halves are byte facts and both are O(1)-ish beside the read that already happens (§2.3).
 */
function readabilityOf(bytes: Uint8Array): {
  starts_with_ermhdr: boolean
  reaches_end_marker: boolean
  nul_byte_count: number
  trailing_nul_run: number
  complete_bytes: number
} {
  let nul = 0
  for (let i = 0; i < bytes.length; i++) if (bytes[i] === 0) nul++

  let tail = bytes.length
  while (tail > 0 && bytes[tail - 1] === 0) tail--

  let end = bytes.length
  while (end > 0) {
    const byte = bytes[end - 1] as number
    if (byte !== 10 && byte !== 13) break
    end--
  }
  const reaches =
    end >= 2 &&
    bytes[end - 1] === 0x45 /* E */ &&
    bytes[end - 2] === 0x25 /* % */ &&
    (end === 2 || bytes[end - 3] === 10)

  return {
    starts_with_ermhdr: startsWith(bytes, 'ERMHDR'),
    reaches_end_marker: reaches,
    nul_byte_count: nul,
    trailing_nul_run: bytes.length - tail,
    complete_bytes: tail,
  }
}

function startsWith(bytes: Uint8Array, ascii: string): boolean {
  if (bytes.length < ascii.length) return false
  for (let i = 0; i < ascii.length; i++) {
    if (bytes[i] !== ascii.charCodeAt(i)) return false
  }
  return true
}

/**
 * The project that owns the activities. A baseline-bearing export carries several `PROJECT`
 * rows and is not multi-project, so the row that matters is the one `TASK.proj_id` names (§5.3).
 */
function owningProject(
  projects: Record<string, string>[],
  taskProjIds: ReadonlySet<string>,
): Record<string, string> | undefined {
  const owned = projects.find((row) => taskProjIds.has(row.proj_id ?? ''))
  return owned ?? projects[0]
}

/** Depth counted through `parent_wbs_id`, with a visited guard: 1 is a correct answer (§3.3). */
function wbsDepth(nodes: { id: string; parent: string }[]): number {
  if (nodes.length === 0) return 0
  const parents = new Map<string, string>()
  for (const node of nodes) parents.set(node.id, node.parent)
  let deepest = 0
  for (const node of nodes) {
    const seen = new Set<string>([node.id])
    let depth = 1
    let cursor = parents.get(node.id) ?? ''
    while (cursor !== '' && parents.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor)
      depth++
      cursor = parents.get(cursor) ?? ''
    }
    if (depth > deepest) deepest = depth
  }
  return deepest
}

function addUser(into: Set<string>, value: string): void {
  if (value !== '' && into.size < PERSONAL_DATA_LIST_CAP) into.add(value)
}

function freeText(
  rowCounts: Record<string, number>,
  rsrcNoteRows: number,
): { table: string; field: string; rows: number }[] {
  const out: { table: string; field: string; rows: number }[] = []
  if (rsrcNoteRows > 0) out.push({ table: 'RSRC', field: 'rsrc_notes', rows: rsrcNoteRows })
  for (const [table, field] of [
    ['TASKMEMO', 'task_memo'],
    ['DOCUMENT', 'author_name'],
    ['UDFVALUE', 'udf_text'],
  ] as const) {
    const rows = rowCounts[table] ?? 0
    if (rows > 0) out.push({ table, field, rows })
  }
  return out
}

function headerOf(fields: readonly string[]): XerHeader {
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

// --- formatting --------------------------------------------------------------
//
// Written out rather than taken from `toLocaleString`, because §5.2 asserts a byte-identical
// serialised `ScanResult` across three browser engines and Node, and locale data is not that.

function group(value: number): string {
  const digits = String(Math.trunc(Math.abs(value)))
  let out = ''
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ','
    out += digits[i]
  }
  return value < 0 ? `-${out}` : out
}

function megabytes(value: number): string {
  const mb = value / (1024 * 1024)
  const rounded = Math.round(mb * 10) / 10
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} MB`
}

async function sha256Hex(bytes: Uint8Array): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle
  if (subtle === undefined) return null
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const digest = await subtle.digest('SHA-256', copy.buffer)
  const view = new Uint8Array(digest)
  let hex = ''
  for (let i = 0; i < view.length; i++) hex += (view[i] as number).toString(16).padStart(2, '0')
  return hex
}
