/**
 * `activities.json` → rows, a WBS tree, and the predicates the toolbar applies (§3.12, §6.7).
 *
 * All of it is pure and none of it issues a request. That is the whole shape of the
 * decision: the browser fetches **one** 340 KB object, spends 25 ms turning it into a
 * sortable in-memory table, and then **issues no further requests** — sort, filter, search,
 * WBS selection and the exemplar deep-links are all local. An API alternative pays a round
 * trip per sort and per keystroke, 50–150 ms each, forever.
 *
 * Two conversions happen here and both are stated on the page rather than hidden:
 * durations and floats arrive in **hours** and are printed in **days at eight hours**, the
 * same convention DCMA checks 6 and 8 use and the one 44 of 54 real `CALENDAR` rows decode
 * to. Nothing here recomputes a published statistic — the charts above the table stay
 * programme-level for exactly that reason.
 */

import type { ActivitiesPayload, ActivityColumns, WbsTuple } from '@/lib/contracts/activities'
import { MILESTONE_TYPES } from '@/lib/contracts/domain'
import { FALLBACK_HOURS_PER_DAY } from './format'

export interface ActivityRow {
  /** Position in the payload, used as the React key: `task_code` is not unique in a `.xer`. */
  index: number
  code: string
  name: string
  wbsId: number | null
  wbsCode: string
  taskType: string
  statusCode: string
  isMilestone: boolean
  /** Days at eight hours. `null` on a non-task type, which has no duration to report. */
  durationDays: number | null
  /** Days at eight hours. `null` is meaningful: an empty float is not a zero float. */
  floatDays: number | null
  start: string | null
  finish: string | null
  /** Our own computed driving-path membership, never the file's `driving_path_flag`. */
  driving: boolean
  /** Lowercased `code name`, built once so a keystroke is a substring test and not a join. */
  haystack: string
}

const MILESTONES = new Set<string>(MILESTONE_TYPES)

function hoursToDays(hours: number | null | undefined): number | null {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return null
  return Math.round(hours / FALLBACK_HOURS_PER_DAY)
}

/**
 * The status column. `Done` / `Active` / `—`, and an unknown code renders as itself rather
 * than as a blank — §2.4's rule that P6 enumerations may never be treated as closed.
 */
export function statusLabel(code: string): string {
  if (code === 'TK_Complete') return 'Done'
  if (code === 'TK_Active') return 'Active'
  if (code === 'TK_NotStart') return '—'
  return code
}

export function buildRows(
  payload: ActivitiesPayload,
  wbsCodes: Map<number, string>,
): ActivityRow[] {
  const columns: ActivityColumns = payload.activities
  const count = columns.task_id.length
  const rows: ActivityRow[] = new Array(count)
  for (let index = 0; index < count; index += 1) {
    const code = columns.task_code[index] ?? ''
    const name = columns.task_name[index] ?? ''
    const wbsId = columns.wbs_id[index] ?? null
    const taskType = columns.task_type[index] ?? ''
    const isMilestone = MILESTONES.has(taskType)
    rows[index] = {
      index,
      code,
      name,
      wbsId,
      wbsCode: wbsId === null ? '' : (wbsCodes.get(wbsId) ?? ''),
      taskType,
      statusCode: columns.status_code[index] ?? '',
      isMilestone,
      durationDays: isMilestone ? null : hoursToDays(columns.target_drtn_hr_cnt[index]),
      floatDays: hoursToDays(columns.total_float_hr_cnt[index]),
      start: columns.act_start_date[index] ?? columns.early_start_date[index] ?? null,
      finish: columns.act_end_date[index] ?? columns.early_end_date[index] ?? null,
      driving: columns.driving_path[index] === true,
      haystack: `${code} ${name}`.toLowerCase(),
    }
  }
  return rows
}

// --- the WBS tree -----------------------------------------------------------

export interface WbsNode {
  id: number
  parentId: number | null
  code: string
  name: string
  depth: number
  children: WbsNode[]
  /** Activities attached to this node alone. */
  own: number
  /** Activities in this node **and its whole subtree** — see below. */
  total: number
}

export interface WbsTree {
  roots: WbsNode[]
  byId: Map<number, WbsNode>
  /** `wbs_id` → `wbs_short_name`, for the table's WBS column. */
  codes: Map<number, string>
  nodeCount: number
}

/**
 * Counts are **rolled up from the subtree**, or every branch node reads 0 and the tree
 * looks broken — on the real 1,800-node tree almost every node with a number on it is a
 * branch.
 *
 * A node whose parent is missing from the payload is treated as a root rather than dropped:
 * losing a subtree silently is worse than showing one at the wrong indent.
 */
export function buildWbsTree(
  tuples: readonly WbsTuple[],
  wbsIds: readonly (number | null)[],
): WbsTree {
  const byId = new Map<number, WbsNode>()
  const codes = new Map<number, string>()
  for (const [id, parentId, shortName, name] of tuples) {
    byId.set(id, {
      id,
      parentId,
      code: shortName,
      name,
      depth: 0,
      children: [],
      own: 0,
      total: 0,
    })
    codes.set(id, shortName)
  }

  const roots: WbsNode[] = []
  for (const node of byId.values()) {
    const parent = node.parentId === null ? undefined : byId.get(node.parentId)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  for (const id of wbsIds) {
    if (id === null) continue
    const node = byId.get(id)
    if (node) node.own += 1
  }

  const assign = (node: WbsNode, depth: number): number => {
    node.depth = depth
    let total = node.own
    for (const child of node.children) total += assign(child, depth + 1)
    node.total = total
    return total
  }
  for (const root of roots) assign(root, 0)

  return { roots, byId, codes, nodeCount: byId.size }
}

/** Selecting a node filters the table to its **whole subtree**, never to the node alone. */
export function subtreeIds(tree: WbsTree, rootId: number): Set<number> {
  const ids = new Set<number>()
  const walk = (node: WbsNode) => {
    ids.add(node.id)
    for (const child of node.children) walk(child)
  }
  const start = tree.byId.get(rootId)
  if (start) walk(start)
  return ids
}

// --- the toolbar's predicates ----------------------------------------------

export type StatusFilter = 'all' | 'TK_NotStart' | 'TK_Active' | 'TK_Complete'

/** The three DCMA checks whose population the activity columns can actually express. */
export type CheckFilter = 'high_float' | 'negative_float' | 'high_duration'

export interface TableFilters {
  query: string
  status: StatusFilter
  /** The `Float ≤ 0` pill. */
  floatAtOrBelowZero: boolean
  /** The `Longest path (N)` chip, over our own computed boolean. */
  drivingOnly: boolean
  wbsSubtree: Set<number> | null
  check: CheckFilter | null
}

export const EMPTY_FILTERS: TableFilters = {
  query: '',
  status: 'all',
  floatAtOrBelowZero: false,
  drivingOnly: false,
  wbsSubtree: null,
  check: null,
}

/** DCMA 6 and 8 both flag over 44 days; DCMA 7 flags anything below zero. */
export function matchesCheck(row: ActivityRow, check: CheckFilter): boolean {
  if (check === 'negative_float') return row.floatDays !== null && row.floatDays < 0
  if (check === 'high_float') return row.floatDays !== null && row.floatDays > 44
  return row.durationDays !== null && row.durationDays > 44
}

export function filterRows(rows: readonly ActivityRow[], filters: TableFilters): ActivityRow[] {
  const query = filters.query.trim().toLowerCase()
  const out: ActivityRow[] = []
  for (const row of rows) {
    if (filters.wbsSubtree && (row.wbsId === null || !filters.wbsSubtree.has(row.wbsId))) continue
    if (filters.status !== 'all' && row.statusCode !== filters.status) continue
    if (filters.floatAtOrBelowZero && !(row.floatDays !== null && row.floatDays <= 0)) continue
    if (filters.drivingOnly && !row.driving) continue
    if (filters.check && !matchesCheck(row, filters.check)) continue
    if (query && !row.haystack.includes(query)) continue
    out.push(row)
  }
  return out
}

export type SortKey =
  | 'code'
  | 'name'
  | 'wbsCode'
  | 'statusCode'
  | 'durationDays'
  | 'floatDays'
  | 'start'
  | 'finish'

/**
 * Nulls sort last in **both** directions. A column of dates whose empty cells lead when you
 * reverse it makes the reversal look like a different filter.
 */
export function sortRows(
  rows: readonly ActivityRow[],
  key: SortKey,
  direction: 1 | -1,
): ActivityRow[] {
  const sorted = [...rows]
  sorted.sort((a, b) => {
    const left = a[key]
    const right = b[key]
    if (left === null || left === '') return right === null || right === '' ? a.index - b.index : 1
    if (right === null || right === '') return -1
    if (left < right) return -1 * direction
    if (left > right) return 1 * direction
    return a.index - b.index
  })
  return sorted
}

/** `1,222 rows of 20,000` — the count is a fact about the filter, so it is always printed. */
export function rowCountLabel(shown: number, total: number): string {
  const rows = `${shown.toLocaleString('en-GB')} row${shown === 1 ? '' : 's'}`
  return shown === total ? rows : `${rows} of ${total.toLocaleString('en-GB')}`
}

/**
 * The virtualised window: 23 DOM rows for 20,000, with six rows of overscan either side so
 * a fast scroll does not expose the seam.
 */
export function windowRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  count: number,
  overscan = 6,
): { first: number; last: number } {
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const last = Math.min(count, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan)
  return { first, last: Math.max(first, last) }
}
