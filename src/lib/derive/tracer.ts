/**
 * The critical-path tracer — P6's Longest Path, walked backwards over the dates P6 already
 * wrote (§8.1–§8.7).
 *
 * **We trace, we do not schedule.** There is no forward pass, no backward pass and no
 * calendar arithmetic anywhere in this module: a CPM engine is out of scope, not deferred
 * (§8.1). Every quantity the driving test compares is a timestamp the file already carries or
 * an hour count already in the row, and the comparison is a subtraction of two numbers read
 * out of the bytes. That is what keeps `clndr_data` out of here — a zero-gap `FS` across a
 * weekend is Friday 16:00 → Monday 08:00, so the obvious `pred.EF + lag == succ.ES` test needs
 * working-time arithmetic to decide, and working-time arithmetic produces confidently wrong
 * dates when it is wrong (§8.4).
 *
 * Three rules a future reader will be tempted to "simplify", each with its measured cost:
 *
 * - **A driving path is a SET, not a chain.** Ties are all kept, because P6's own flag marks
 *   every branch and an ordered `task_code[]` cannot represent one. Keeping one predecessor
 *   per activity yields a subset of the truth that is indistinguishable from a correct answer
 *   on any file where nothing ties — `logic-driving-branch` and `logic-nonfs-drivers` exist to
 *   catch exactly that (§8.3).
 * - **The driving test is per relationship type.** `EF + lag` is exact for `FS` and simply
 *   wrong for the other three: each type constrains a *different* successor timestamp.
 *   Reverting to `EF + lag` for everything costs three corpus files and scores 22/24 on the
 *   byte-reading check that settled it (§8.4, §8.16).
 * - **`driving_path_flag` is a validation oracle and never the answer.** The set is always
 *   computed, even where P6 populated the flag, because a stat whose method flips depending on
 *   how the planner happened to export is not comparable across programmes — and the flag is
 *   the only ground truth this project will ever have, so spending it as an output would spend
 *   it forever. Disagreement is an `info` entry, never a different answer (§8.2).
 *
 * Longest Path is **not** Critical. Nothing here reads `total_float_hr_cnt` except
 * `floatBasedMarks`, which exists only so a test can assert the difference: a `tf <= 0` tracer
 * marks 23 activities against a truth of 10 on `logic-float-path`, and the two sets share no
 * member at all (§8.15, §3.6).
 *
 * No Node built-ins — the same code runs in the browser, beside the parser and the calendar
 * engine it sits on.
 */

import type { DerivedIssue } from '../contracts/derived'
import { EXEMPLAR_CAP, type RelationshipType } from '../contracts/domain'
import type { TraceResult } from '../contracts/trace'
import type { XerFile, XerTable } from '../contracts/xer'
import { cell, reader } from '../contracts/xer'
import { dayNumber, durationCalendarDays } from './dates'

// --- the driving test, per relationship type (§8.4) --------------------------

/** One of a row's two early-date columns. Which one a demand or a reference reads is §8.4's. */
export type DateColumn = 'early_start_date' | 'early_end_date'

/** The pair of columns one relationship type compares. */
export interface DrivingColumns {
  readonly demand: DateColumn
  readonly reference: DateColumn
}

/**
 * **The compared quantity is type-specific** (§8.4):
 *
 * | `pred_type` | demand | measured against |
 * |---|---|---|
 * | `PR_FS` | `pred.early_end_date + lag` | `succ.early_start_date` |
 * | `PR_SS` | `pred.early_start_date + lag` | `succ.early_start_date` |
 * | `PR_FF` | `pred.early_end_date + lag` | `succ.early_end_date` |
 * | `PR_SF` | `pred.early_start_date + lag` | `succ.early_end_date` |
 *
 * `EF + lag` is exact for `FS` and simply wrong for the other three: an `SS` constrains the
 * successor's *start* from the predecessor's *start*, `FF`/`SF` constrain its *finish*.
 *
 * This is a **strict generalisation**, not a replacement: on an all-`FS` successor the
 * reference is a constant that cancels and the argmax reduces to `EF + lag` exactly. 21 of the
 * 24 corpus goldens do not move by a single activity under it — which is precisely why an
 * implementation that drops it looks right on almost every file, and why three that do move
 * are kept in the corpus.
 */
export const DRIVING_TEST: Readonly<Record<RelationshipType, DrivingColumns>> = {
  PR_FS: { demand: 'early_end_date', reference: 'early_start_date' },
  PR_SS: { demand: 'early_start_date', reference: 'early_start_date' },
  PR_FF: { demand: 'early_end_date', reference: 'early_end_date' },
  PR_SF: { demand: 'early_start_date', reference: 'early_end_date' },
}

/**
 * An unknown `pred_type` is carried, never rejected (§2.4) — `unknown-table-and-enum` holds
 * that line. It falls back to the `FS` columns, which are 99.4% of real logic (`PR_FS` 174,458
 * of 175,524 relationships across the 67 distinct real files).
 */
function columnsFor(type: string): DrivingColumns {
  return Object.hasOwn(DRIVING_TEST, type)
    ? DRIVING_TEST[type as RelationshipType]
    : DRIVING_TEST.PR_FS
}

// --- what the file says ------------------------------------------------------

/** One `TASK` row, reduced to what the walk reads. Dates are kept raw *and* as instants. */
export interface TracedTask {
  readonly id: number
  readonly code: string
  readonly taskType: string
  readonly statusCode: string
  readonly projId: string
  readonly earlyStartDate: string
  readonly earlyEndDate: string
  /** Elapsed minutes since 1970-01-01 00:00, naive local. `null` where the cell is unreadable. */
  readonly earlyStartAt: number | null
  readonly earlyEndAt: number | null
  /** `driving_path_flag == 'Y'`. The oracle, never an input to the walk (§8.2). */
  readonly flagged: boolean
}

/** One `TASKPRED` row. `lagHours` is **elapsed** hours — the residue §8.4 leaves unfixed. */
export interface TracedRelationship {
  readonly succId: number
  readonly predId: number
  readonly type: string
  readonly lagHours: number
}

/**
 * A wall-clock instant as elapsed minutes since 1970-01-01, or `null`.
 *
 * **Naive local, no timezone, and no `new Date(string)` anywhere.** The `.xer` records no
 * offset, so converting would invent information (§3.4); the civil-day arithmetic is
 * `dates.ts`'s and only the clock is read here. The clock pattern is `\d{1,2}:\d{2}` and not
 * `\d\d:\d\d`, for the same reason it is in the calendar decoder: P6 does not zero-pad every
 * hour it writes (§2.6), and a padded pattern fails silently rather than loudly.
 *
 * Minutes rather than hours because the driving test ranks on **exact equality** — ties are
 * the whole point of §8.3 — and a format that writes `HH:MM` has nothing finer to say.
 */
export function instantMinutes(raw: string | null | undefined): number | null {
  if (!raw) return null
  const text = raw.trim()
  const day = dayNumber(text)
  if (day === null) return null
  // `dayNumber` matched `YYYY-MM-DD` anchored at the start, so the clock is what follows it.
  const clock = /^\s*(\d{1,2}):(\d{2})/.exec(text.slice(10))
  const hours = clock ? Number(clock[1]) : 0
  const minutes = clock ? Number(clock[2]) : 0
  return day * 1440 + hours * 60 + minutes
}

const integerId = (value: string | undefined): number | null => {
  if (value === undefined) return null
  const text = value.trim()
  if (text === '') return null
  const n = Number(text)
  return Number.isInteger(n) ? n : null
}

const finiteOrZero = (value: string | undefined): number => {
  if (value === undefined) return 0
  const text = value.trim()
  if (text === '') return 0
  const n = Number(text)
  return Number.isFinite(n) ? n : 0
}

/**
 * Every `TASK` row the walk can address, read **by field name** (§2.7).
 *
 * A row whose `task_id` is not an integer is dropped: the contract's member set is
 * `ReadonlySet<number>` and an id that cannot be one cannot be reported. No real or synthetic
 * export has produced such a row.
 */
export function readTasks(file: XerFile): TracedTask[] {
  const table = file.tables.get('TASK')
  if (!table) return []
  const id = reader(table, 'task_id')
  if (!id) return []
  const code = reader(table, 'task_code')
  const type = reader(table, 'task_type')
  const status = reader(table, 'status_code')
  const proj = reader(table, 'proj_id')
  const start = reader(table, 'early_start_date')
  const end = reader(table, 'early_end_date')
  const flag = reader(table, 'driving_path_flag')

  const out: TracedTask[] = []
  for (const row of table.rows) {
    const taskId = integerId(id(row))
    if (taskId === null) continue
    const earlyStartDate = start?.(row) ?? ''
    const earlyEndDate = end?.(row) ?? ''
    out.push({
      id: taskId,
      code: code?.(row) ?? '',
      taskType: type?.(row) ?? '',
      statusCode: status?.(row) ?? '',
      projId: (proj?.(row) ?? '').trim(),
      earlyStartDate,
      earlyEndDate,
      earlyStartAt: instantMinutes(earlyStartDate),
      earlyEndAt: instantMinutes(earlyEndDate),
      flagged: (flag?.(row) ?? '').trim().toUpperCase() === 'Y',
    })
  }
  return out
}

/**
 * Every `TASKPRED` row, successor and predecessor both.
 *
 * **A relationship absent from the file is absent from the walk** — `missing-taskpred` carries
 * no such table at all, and its trace is one activity: its own seed, which is then a chain tail.
 */
export function readRelationships(file: XerFile): TracedRelationship[] {
  const table = file.tables.get('TASKPRED')
  if (!table) return []
  const succ = reader(table, 'task_id')
  const pred = reader(table, 'pred_task_id')
  if (!succ || !pred) return []
  const type = reader(table, 'pred_type')
  const lag = reader(table, 'lag_hr_cnt')

  const out: TracedRelationship[] = []
  for (const row of table.rows) {
    const succId = integerId(succ(row))
    const predId = integerId(pred(row))
    if (succId === null || predId === null) continue
    out.push({
      succId,
      predId,
      type: (type?.(row) ?? '').trim(),
      lagHours: finiteOrZero(lag?.(row)),
    })
  }
  return out
}

// --- the same-kind zero-lag floor (§8.5) -------------------------------------

/**
 * Which kind of instant a column of this row actually **writes** (§8.5, §8.14).
 *
 * ```
 * row.task_type == 'TT_FinMile'  ->  'finish'    # both date columns
 * row.task_type == 'TT_Mile'     ->  'start'     # both date columns
 * otherwise                      ->  the column's own kind
 * ```
 *
 * The precondition is stated on what the column writes, not on whether the row has zero span.
 * `early_start_date == early_end_date` is **not** a milestone test on a progressed programme:
 * 26,325 of one real programme's 105,028 `TT_Task` rows carry equal early dates and 26,307 of
 * those are `TK_Complete` (§8.14). The fixture generator still keys its own copy on that
 * withdrawn test; §8.5 says to build this one.
 */
export function writtenKind(taskType: string, column: DateColumn): 'start' | 'finish' {
  if (taskType === 'TT_FinMile') return 'finish'
  if (taskType === 'TT_Mile') return 'start'
  return column === 'early_end_date' ? 'finish' : 'start'
}

/**
 * The floor of §8.5: *drop a candidate whose demand is strictly earlier than its reference,
 * where the two are the same kind of instant and the lag is zero.*
 *
 * It can only ever remove a false positive — a candidate below its own reference cannot be the
 * argmax unless every candidate is, which is the case the truth already reports as *no driving
 * predecessor*: a chain tail held by a constraint or the project start. Worth +0.6pp precision
 * and one more exact file on the corpus, and it takes `external-relationship` from 62.5%
 * precision to 100%.
 *
 * **The same-kind guard is the load-bearing half.** Without it the floor fires on `FS` across
 * every non-working gap — Friday 16:00 demanded against a Monday 08:00 start is *negative* in
 * elapsed time and perfectly driving in working time — and 25 of the 28 walkable corpus files
 * come apart. Two instants of the same written kind order the same way in elapsed time as in
 * working time; two of different kinds do not, and that is the whole test.
 *
 * Keyed on `writtenKind`, which is why this is not simply "`SS` and `FF`": the net effect is
 * `PR_SS` and `PR_FF` **minus** `PR_FF` touching a `TT_Mile` and `PR_SS` touching a
 * `TT_FinMile`, **plus** every `PR_FF` milestone pair that occurs in reality. Oracle Primavera
 * Cloud's own validation forbids exactly the two pairs this excludes (PRM-003015125,
 * PRM-003015126) and forbids neither `FF` into a Finish Milestone. **Neither branch is executed
 * by any real file or by the corpus** — 0 of 143 `PR_FF` and 0 of 386 `PR_SS` on the 48 oracle
 * files touch a flagged row on either side — so it is kept because it is right, not because a
 * score chose it. An earlier `PR_FF` milestone exclusion keyed the other way round was
 * *inverted*: 124 of 124 real single-milestone `PR_FF` pairs are `FF` into a `TT_FinMile`,
 * which is the exact case it declined.
 */
function flooredOut(
  pred: TracedTask,
  succ: TracedTask,
  columns: DrivingColumns,
  lagHours: number,
  gapMinutes: number,
): boolean {
  if (lagHours !== 0 || gapMinutes >= 0) return false
  return (
    writtenKind(pred.taskType, columns.demand) === writtenKind(succ.taskType, columns.reference)
  )
}

// --- the walk (§8.3) ---------------------------------------------------------

/** One driving predecessor, with the number that made it one. */
export interface DrivingRelationship {
  readonly pred: number
  readonly type: string
  readonly lagHours: number
  /** `demand − reference` in elapsed minutes. The argmax **and every tie** drive (§8.3). */
  readonly gapMinutes: number
}

/**
 * Everything the walk found. The corpus asserts on all six of membership, `state`, `branches`,
 * `truncated`, `cycle_count` and `path_continuous`, and `TraceResult` carries four of them;
 * `trace()` is this, narrowed to the contract.
 */
export interface TraceDetail {
  readonly state: TraceResult['state']
  readonly reason?: string
  /** Argmax on `early_end_date` over remaining work, **all ties kept, no tie-break** (§8.3). */
  readonly seeds: readonly number[]
  readonly members: ReadonlySet<number>
  /** Driving predecessors per visited activity. An empty list is a chain tail. */
  readonly drivers: ReadonlyMap<number, readonly DrivingRelationship[]>
  /** Members with more than one driving predecessor — the branches a chain cannot represent. */
  readonly branches: readonly number[]
  /** Members with none. Grounded or not, they are where the walk stopped. */
  readonly tails: readonly number[]
  readonly cycleCount: number
  /** Back edges, each as the path slice from the revisited node. Capped at `EXEMPLAR_CAP`. */
  readonly cycles: readonly (readonly number[])[]
  readonly truncated: boolean
  readonly remainingCount: number
  /** Earliest `early_start_date` and latest `early_end_date` on the set (§10.9). */
  readonly window: { readonly start: string; readonly finish: string } | null
  readonly pathContinuous: boolean
  readonly flag: TraceResult['flag']
  /**
   * Flagged rows that are not `TK_Complete` — the span-consistent oracle the ship gate scores
   * recall against, 3,447 of 5,180 across the 48 real oracle files (§8.16). The other 1,733 are
   * work P6's Longest Path runs back *through* and our span deliberately does not (§8.2), and
   * the walk cannot mark one because it drops `TK_Complete` before it scores anything.
   */
  readonly flaggedRemaining: number
  readonly flaggedRemainingAgreed: number
}

interface Frame {
  readonly id: number
  readonly drivers: readonly DrivingRelationship[]
  next: number
}

const WHITE = 0
const GREY = 1
const BLACK = 2

/** The key a lone `PROJECT` row is also filed under, so a task with no match still finds it. */
const SOLE_PROJECT = '\u0000sole'

/**
 * The trace, in full.
 *
 * ```
 * remaining := { t in tasks : t.status_code != 'TK_Complete' }
 * latest    := max over remaining of t.early_end_date          # wall-clock instant
 * seeds     := { t in remaining : t.early_end_date == latest }  # ALL of them, ties kept
 * members   := walk_back(seeds, driversOf)                      # WHITE/GREY/BLACK
 * ```
 *
 * **The span is remaining work as of the data date**, and that is a deliberate restriction of
 * P6's answer rather than a reproduction of it: P6's own Longest Path runs back through
 * completed work to the start of the programme, with the oldest flagged finish 341–1,376 days
 * behind the data date on the real set and the chain's tails `TK_Complete` on 45 of 48 files.
 * Everything downstream spends remaining work, and a span reaching 3.8 years behind the data
 * date would report a critical path most of which is already built (§8.3).
 *
 * **Seeding is argmax with no tie-break**, and the alternatives were priced: within one shift,
 * within 72 hours, and P6's own dropped seeds all mark the same 3,402 activities, while "every
 * remaining activity with no live successor" buys 15 activities of recall for 18,006 marks at
 * 16% precision. It is safe because 47 of 67 real files tie on the latest `early_end_date` and
 * 47 of 47 ties are mixed — a finish milestone beside the task it finishes with, written at the
 * same instant because P6 writes a finish milestone at its driver's finish (§8.3, §8.14). What
 * would reopen it is a programme whose finish milestone is written a working gap after the
 * tasks that drive it, where one of those is not a driving predecessor of the milestone.
 */
export function traceDetail(file: XerFile): TraceDetail {
  const tasks = readTasks(file)
  const byId = new Map<number, TracedTask>(tasks.map((t) => [t.id, t]))
  const preds = new Map<number, TracedRelationship[]>()
  for (const rel of readRelationships(file)) {
    const list = preds.get(rel.succId)
    if (list) list.push(rel)
    else preds.set(rel.succId, [rel])
  }

  const flagPresent = file.tables.get('TASK')?.index.has('driving_path_flag') ?? false
  const remaining = tasks.filter((t) => t.statusCode !== 'TK_Complete')
  const nothingWalked = (state: TraceResult['state'], reason: string): TraceDetail =>
    complete({
      state,
      reason,
      seeds: [],
      members: new Set<number>(),
      drivers: new Map(),
      branches: [],
      tails: [],
      cycleCount: 0,
      cycles: [],
      truncated: false,
      remainingCount: remaining.length,
      // A walk that never ran traced no chain, so it cannot claim one runs unbroken to the
      // finish. The corpus golden calls this case `null`; the contract has only a boolean, and
      // a consumer that needs "not applicable" reads `state` (§8.6).
      pathContinuous: false,
      tasks,
      flagPresent,
    })

  if (tasks.length === 0) {
    // An absent `TASK` table and one whose `%F` list has no `task_id` are the same absence to a
    // walk: `enc-zeroed-file` is 397,781 bytes of `NUL` and parses to no tables at all.
    return nothingWalked('unavailable', 'no readable TASK rows, so there is nothing to walk')
  }
  // §8.6's first degradation: a 100%-complete programme is `skip`, which is neither an error
  // nor a zero. `logic-complete-no-remaining` and `progress-full` hold that line.
  if (remaining.length === 0) return nothingWalked('skip', 'no remaining work at the data date')

  const dated = remaining.filter((t) => t.earlyEndAt !== null)
  if (dated.length === 0) {
    // §8.6's second: never scheduled, so the dates the walk reads are simply not there.
    return nothingWalked('unavailable', 'no remaining activity carries an early_end_date')
  }

  let latest = Number.NEGATIVE_INFINITY
  for (const t of dated) {
    if (t.earlyEndAt !== null && t.earlyEndAt > latest) latest = t.earlyEndAt
  }
  const seeds = dated.filter((t) => t.earlyEndAt === latest)

  let truncated = false

  /**
   * ```
   * visible    := t.preds where the TASKPRED row exists in this file
   * live       := visible where pred.status_code != 'TK_Complete'
   * resolvable := live where pred is a TASK row in this file
   * truncated  |= |resolvable| != |live|
   * pool       := resolvable minus the §8.5 floor
   * best       := max over pool of (demand − reference)          # ties ALL kept
   * ```
   *
   * Dropping `TK_Complete` from the candidate pool **before** anything is scored is what makes
   * the walk unable to mark a completed row, and therefore what makes precision identical to
   * the decimal under both readings of the recall denominator (§8.8).
   */
  const driversOf = (succ: TracedTask): DrivingRelationship[] => {
    const visible = preds.get(succ.id) ?? []
    let live = 0
    let resolvable = 0
    const pool: DrivingRelationship[] = []
    for (const rel of visible) {
      const pred = byId.get(rel.predId)
      if (pred?.statusCode === 'TK_Complete') continue
      live++
      // A predecessor in another project is *unresolvable*, not absent: the chain reached past
      // the edge of the file and says so. The 67 distinct real files carry zero external
      // relationships, so this is a corpus-only shape and production will never test it (§8.6).
      if (!pred) continue
      resolvable++
      const columns = columnsFor(rel.type)
      const demand = columns.demand === 'early_end_date' ? pred.earlyEndAt : pred.earlyStartAt
      const reference = columns.reference === 'early_end_date' ? succ.earlyEndAt : succ.earlyStartAt
      if (demand === null || reference === null) continue
      // Whole minutes on both sides, so the argmax's ties are exact rather than approximate.
      const gapMinutes = demand + Math.round(rel.lagHours * 60) - reference
      if (flooredOut(pred, succ, columns, rel.lagHours, gapMinutes)) continue
      pool.push({ pred: rel.predId, type: rel.type, lagHours: rel.lagHours, gapMinutes })
    }
    if (resolvable !== live) truncated = true
    if (pool.length === 0) return []
    let best = Number.NEGATIVE_INFINITY
    for (const candidate of pool) {
      if (candidate.gapMinutes > best) best = candidate.gapMinutes
    }
    // **Every relationship scoring exactly `best` is kept.** A tracer that takes the first is a
    // subset of the truth that no file without a tie can tell apart from a correct answer.
    return pool.filter((candidate) => candidate.gapMinutes === best)
  }

  const colour = new Map<number, number>()
  const members = new Set<number>()
  const drivers = new Map<number, readonly DrivingRelationship[]>()
  const branches: number[] = []
  const tails: number[] = []
  const cycles: number[][] = []
  let cycleCount = 0

  const open = (task: TracedTask): Frame => {
    colour.set(task.id, GREY)
    members.add(task.id)
    const found = driversOf(task)
    drivers.set(task.id, found)
    if (found.length === 0) tails.push(task.id)
    if (found.length > 1) branches.push(task.id)
    return { id: task.id, drivers: found, next: 0 }
  }

  // Iterative DFS with three colours. The visited set the walk needs anyway makes cycle
  // detection free, which is why a cyclic file yields a *finding* rather than a stack overflow
  // (§8.6) — and 20,000 activities deep would overflow a recursive one.
  for (const seed of seeds) {
    if ((colour.get(seed.id) ?? WHITE) !== WHITE) continue
    const stack: Frame[] = [open(seed)]
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      if (!frame) break
      const edge = frame.drivers[frame.next]
      if (!edge) {
        colour.set(frame.id, BLACK)
        stack.pop()
        continue
      }
      frame.next++
      const seen = colour.get(edge.pred) ?? WHITE
      if (seen === GREY) {
        // A back edge into the current path. P6 will not schedule a cyclic network, so a cyclic
        // file is one that was never successfully scheduled — a fact about the programme, and
        // on a broken file the most interesting thing on the page.
        cycleCount++
        // The slice costs a scan of the current path, so it is taken only while there are
        // exemplars left to fill: the count is uncapped, the members are not (§8.6).
        if (cycles.length < EXEMPLAR_CAP) {
          const from = stack.findIndex((f) => f.id === edge.pred)
          if (from >= 0) cycles.push([...stack.slice(from).map((f) => f.id), edge.pred])
        }
        continue
      }
      if (seen === BLACK) continue
      const task = byId.get(edge.pred)
      if (!task) continue
      stack.push(open(task))
    }
  }

  // --- continuity (§8.6) ---
  //
  // `logic.path_continuous` is a stat *about the programme*, not a check. It carries what DCMA
  // check 12 was for from **outside** `checks_applicable`, because a fifteenth check would make
  // `checks_passed / checks_applicable` incomparable with every published DCMA number.
  //
  // ```
  // continuous  := no cycles and not truncated and every chain tail is grounded
  // grounded(t) := t.status_code == 'TK_Active'
  //             or t.early_start_date <= PROJECT.last_recalc_date       # the data date
  //             or t has a predecessor in this file with status_code == 'TK_Complete'
  // ```
  //
  // Read as an absolute this fails 2 of 48 real files on which our marked set is *identical* to
  // P6's and P6's own chain stops in the same place. A hole in someone else's schedule is not
  // our defect, which is why the ship gate reads it as an agreement clause (§8.16).
  const dataDates = readDataDates(file)
  const grounded = (id: number): boolean => {
    const task = byId.get(id)
    if (!task) return false
    if (task.statusCode === 'TK_Active') return true
    const dataDate = dataDates.get(task.projId) ?? dataDates.get(SOLE_PROJECT)
    if (dataDate !== undefined && task.earlyStartAt !== null && task.earlyStartAt <= dataDate) {
      return true
    }
    for (const rel of preds.get(id) ?? []) {
      if (byId.get(rel.predId)?.statusCode === 'TK_Complete') return true
    }
    return false
  }

  return complete({
    state: cycleCount > 0 ? 'error' : 'ok',
    reason:
      cycleCount > 0
        ? `${cycleCount} logic cycle(s) on the driving chain — a cyclic network was never scheduled`
        : undefined,
    seeds: seeds.map((t) => t.id),
    members,
    drivers,
    branches,
    tails,
    cycleCount,
    cycles,
    truncated,
    remainingCount: remaining.length,
    pathContinuous: cycleCount === 0 && !truncated && tails.every(grounded),
    tasks,
    flagPresent,
  })
}

/**
 * `PROJECT.last_recalc_date` — the data date — per `proj_id`.
 *
 * Nothing else in the file dates the schedule: `last_tasksum_date`, `sum_data_date`,
 * `last_baseline_update_date`, `apply_actuals_date` and `next_data_date` are empty on all 67
 * distinct real exports, and `add_date` is when the project was created (§8.2).
 *
 * Keyed by project because `multiproj-two-proj-id` carries activities under two of them, and
 * `multiproj-baseline-rows` carries three `PROJECT` rows of which one owns the activities. A
 * file with a single `PROJECT` row files it under `SOLE_PROJECT` as well, so a task whose
 * `proj_id` column is absent still finds the only data date the file has.
 */
function readDataDates(file: XerFile): Map<string, number> {
  const table: XerTable | undefined = file.tables.get('PROJECT')
  const out = new Map<string, number>()
  if (!table) return out
  for (const row of table.rows) {
    const at = instantMinutes(cell(table, row, 'last_recalc_date'))
    if (at === null) continue
    out.set((cell(table, row, 'proj_id') ?? '').trim(), at)
    if (table.rows.length === 1) out.set(SOLE_PROJECT, at)
  }
  return out
}

/** The parts of the detail that are the same arithmetic in every state. */
function complete(
  parts: Omit<TraceDetail, 'window' | 'flag' | 'flaggedRemaining' | 'flaggedRemainingAgreed'> & {
    readonly tasks: readonly TracedTask[]
    readonly flagPresent: boolean
  },
): TraceDetail {
  const { tasks, flagPresent, ...walk } = parts
  let start: TracedTask | null = null
  let startAt = Number.POSITIVE_INFINITY
  let finish: TracedTask | null = null
  let finishAt = Number.NEGATIVE_INFINITY
  let flagged = 0
  let agreed = 0
  let onlyFlag = 0
  let flaggedRemaining = 0
  let flaggedRemainingAgreed = 0
  for (const task of tasks) {
    const member = walk.members.has(task.id)
    if (task.flagged) {
      flagged++
      if (member) agreed++
      else onlyFlag++
      if (task.statusCode !== 'TK_Complete') {
        flaggedRemaining++
        if (member) flaggedRemainingAgreed++
      }
    }
    if (!member) continue
    if (task.earlyStartAt !== null && task.earlyStartAt < startAt) {
      startAt = task.earlyStartAt
      start = task
    }
    if (task.earlyEndAt !== null && task.earlyEndAt > finishAt) {
      finishAt = task.earlyEndAt
      finish = task
    }
  }
  return {
    ...walk,
    window: start && finish ? { start: start.earlyStartDate, finish: finish.earlyEndDate } : null,
    flag: {
      present: flagPresent,
      flagged,
      agreed,
      onlyFlag,
      onlyComputed: walk.members.size - agreed,
    },
    flaggedRemaining,
    flaggedRemainingAgreed,
  }
}

// --- the contract (§8.7) -----------------------------------------------------

/** One place to a percentage — the convention `activity_share_pct` already uses. */
const onePlace = (value: number) => Math.round(value * 1000) / 10

/**
 * The tracer, narrowed to `TraceResult` — the seam every consumer reads (§8.7).
 *
 * Provenance downstream is **always `computed`**, never `from-file`, on every state and on
 * every file, including the ones where P6 exported an answer of its own. The accepted cost is
 * stated plainly in §8.1: on a file where P6 gave an answer we may publish a different one, and
 * the divergence lands as an `info` entry in `issues[]` (see `traceIssues`).
 */
export function trace(file: XerFile): TraceResult {
  const detail = traceDetail(file)
  const result: TraceResult = {
    state: detail.state,
    members: detail.members,
    truncated: detail.truncated,
    cycleCount: detail.cycleCount,
    pathContinuous: detail.pathContinuous,
    // Calendar days, both ends counted, over the chain's own window — the same convention and
    // the same name as `time.duration_calendar_days`. Deliberately not working days: a chain
    // crosses many activities and a working-day count needs *one* calendar to be measured on.
    durationCalendarDays: detail.window
      ? durationCalendarDays(detail.window.start, detail.window.finish)
      : null,
    shareOfRemainingPct:
      detail.remainingCount > 0 ? onePlace(detail.members.size / detail.remainingCount) : null,
    flag: detail.flag,
  }
  return detail.reason === undefined ? result : { ...result, reason: detail.reason }
}

/**
 * The `issues[]` entries the trace owes (§3.10, §8.2, §8.6).
 *
 * Three, and no more. **Divergence from `driving_path_flag` is `info` and nothing else** — it
 * never changes the answer, because P6's flag is its Longest Path (which spans completed work
 * back to the start of the programme) and ours is the remaining span, so the two are different
 * objects that agree 98.6% of the time on the part they share. A cycle is the one `error`, and
 * `error` is the only severity that reaches the detail page's *partially analysed* banner:
 * `unavailable` is *absent from source* and raises nothing, exactly as the calendar decoder's
 * `unavailable` does. **Ingest never fails on a stat error.**
 */
export function traceIssues(result: TraceResult): DerivedIssue[] {
  const issues: DerivedIssue[] = []
  if (result.state === 'error') {
    issues.push({
      stat: 'logic.longest_path',
      severity: 'error',
      reason: `${result.cycleCount} logic cycle(s) on the driving chain; ingest still succeeds`,
    })
  }
  if (result.truncated) {
    issues.push({
      stat: 'logic.longest_path',
      severity: 'info',
      reason: 'the driving chain reached a predecessor outside this file',
    })
  }
  const { present, flagged, agreed, onlyFlag, onlyComputed } = result.flag
  if (present && flagged > 0 && (onlyFlag > 0 || onlyComputed > 0)) {
    issues.push({
      stat: 'logic.longest_path',
      severity: 'info',
      reason:
        `computed Longest Path differs from driving_path_flag: ${agreed} of ${flagged} flagged ` +
        `rows marked, ${onlyFlag} flagged and not marked, ${onlyComputed} marked and not ` +
        'flagged. The flag is a validation oracle, never the answer (§8.2)',
    })
  }
  return issues
}

/**
 * What a `total_float_hr_cnt <= 0` tracer would mark instead — **not** the Longest Path, and
 * here only so a test can assert the difference (§8.15, §3.6).
 *
 * Exported rather than buried in the test because it is the single mistake this module exists
 * to avoid, and a reader who finds it here finds the reason with it: *the critical set is the
 * longest path* is the classic P6 reporting error, and the two are different concepts with
 * separate fields and separate provenance. On `logic-float-path` this marks 23 activities
 * against a driving set of 10, and that file's own `float_path = 1` chain — the
 * lowest-total-float chain, 9 activities at −160 h — shares **no member at all** with the 10
 * rows carrying `driving_path_flag = Y` at zero float. On `logic-no-longest-path` it marks 19
 * where 4 drive. Nothing in `trace()` calls this, and nothing ever should.
 */
export function floatBasedMarks(file: XerFile): Set<number> {
  const table = file.tables.get('TASK')
  const out = new Set<number>()
  if (!table) return out
  const id = reader(table, 'task_id')
  const float = reader(table, 'total_float_hr_cnt')
  if (!id || !float) return out
  for (const row of table.rows) {
    const taskId = integerId(id(row))
    const value = float(row).trim()
    if (taskId === null || value === '') continue
    const hours = Number(value)
    if (Number.isFinite(hours) && hours <= 0) out.add(taskId)
  }
  return out
}
