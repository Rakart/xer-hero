import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { XerCell, XerFile, XerTable } from '../contracts/xer'
import { parseXer } from '../xer'
import {
  DRIVING_TEST,
  floatBasedMarks,
  instantMinutes,
  readTasks,
  trace,
  traceDetail,
  traceIssues,
  writtenKind,
} from './tracer'

/**
 * The corpus is the only test data CI will ever have — real `.xer` files are commercial data
 * and permanently gitignored, so a GitHub Actions run can never see one and a fork PR gets no
 * secrets either.
 *
 * **Every golden carries three answers and the difference between them is the exercise**
 * (`fixtures/synthetic/README.md`):
 *
 * - `members` — the truth, walked by the generator over its own logic network.
 *   `driving_path_flag` in the file is written from this and from nothing else, so it plays
 *   the same oracle role P6's flag plays on a real file.
 * - `as_read_from_the_file` — **what this tracer must produce**: the demand each relationship
 *   *type* makes scored against the successor timestamp it constrains, lag as elapsed hours,
 *   relationships absent from the file absent from the walk, predecessors outside the file
 *   unresolvable.
 * - `float_based_tracer` — what `total_float_hr_cnt <= 0` would mark instead. **That is not
 *   the Longest Path and the corpus exists to say so.**
 *
 * The gap between the first two is the approximation §8.4 knowingly accepted, and it is
 * measured here rather than tuned away.
 */
const CORPUS = fileURLToPath(new URL('../../../fixtures/synthetic/corpus/', import.meta.url))

interface DrivingBranch {
  readonly task_code: string
  readonly driving_predecessors: readonly string[]
}

interface DrivingWalk {
  readonly state: string
  readonly seeds: readonly string[]
  readonly members: readonly string[]
  readonly branches: readonly DrivingBranch[]
  readonly truncated: boolean
  readonly cycle_count: number
  readonly path_continuous: boolean | null
  readonly open_chain_tails: readonly string[]
}

interface Golden {
  readonly driving_path?: DrivingWalk & {
    readonly as_read_from_the_file?: DrivingWalk
    readonly float_based_tracer: { readonly count: number }
  }
}

const files = new Map<string, XerFile>()
function fixture(name: string): XerFile {
  const cached = files.get(name)
  if (cached) return cached
  const parsed = parseXer(new Uint8Array(readFileSync(`${CORPUS}${name}.xer`)))
  files.set(name, parsed)
  return parsed
}

const goldens = new Map<string, Golden>()
function golden(name: string): Golden {
  const cached = goldens.get(name)
  if (cached) return cached
  const parsed = JSON.parse(readFileSync(`${CORPUS}${name}.expected.json`, 'utf8')) as Golden
  goldens.set(name, parsed)
  return parsed
}

const CORPUS_NAMES = readdirSync(CORPUS)
  .filter((f) => f.endsWith('.expected.json'))
  .map((f) => f.slice(0, -'.expected.json'.length))
  .sort()

/** `enc-zeroed-file` is the twenty-ninth and has no readable walk at all: nothing in it parses. */
const WALKABLE = CORPUS_NAMES.filter((n) => golden(n).driving_path?.as_read_from_the_file)

const codesOf = (name: string) => new Map(readTasks(fixture(name)).map((t) => [t.id, t.code]))

const named = (ids: Iterable<number>, codes: ReadonlyMap<number, string>) =>
  [...ids].map((id) => codes.get(id) ?? `#${id}`).sort()

// --- the corpus, on all six fields -------------------------------------------

describe('the corpus, as read from the file (§8.3–§8.6)', () => {
  it('has 28 walkable fixtures and one that parses to nothing', () => {
    expect(CORPUS_NAMES.length).toBe(29)
    expect(WALKABLE.length).toBe(28)
    expect(CORPUS_NAMES.filter((n) => !WALKABLE.includes(n))).toEqual(['enc-zeroed-file'])
  })

  describe.each(WALKABLE)('%s', (name) => {
    const expected = golden(name).driving_path?.as_read_from_the_file as DrivingWalk
    const detail = traceDetail(fixture(name))
    const codes = codesOf(name)

    it('marks the same set', () => {
      expect(named(detail.members, codes)).toEqual([...expected.members].sort())
    })

    it('seeds where the readable walk seeds', () => {
      expect(named(detail.seeds, codes)).toEqual([...expected.seeds].sort())
    })

    it('reports the same state', () => {
      expect(detail.state).toBe(expected.state)
    })

    it('branches where the readable walk branches — a set, not a chain', () => {
      const branches = detail.branches
        .map((id) => ({
          task_code: codes.get(id) ?? `#${id}`,
          driving_predecessors: named(
            (detail.drivers.get(id) ?? []).map((d) => d.pred),
            codes,
          ),
        }))
        .sort((a, b) => a.task_code.localeCompare(b.task_code))
      expect(branches).toEqual(
        [...expected.branches]
          .map((b) => ({
            task_code: b.task_code,
            driving_predecessors: [...b.driving_predecessors].sort(),
          }))
          .sort((a, b) => a.task_code.localeCompare(b.task_code)),
      )
    })

    it('stops on the same chain tails', () => {
      expect(named(detail.tails, codes)).toEqual([...expected.open_chain_tails].sort())
    })

    it('agrees on truncated, cycle_count and path_continuous', () => {
      expect(detail.truncated).toBe(expected.truncated)
      expect(detail.cycleCount).toBe(expected.cycle_count)
      // The golden writes `null` where no walk ran; the contract has only a boolean, and a
      // walk that never ran cannot claim a chain runs unbroken to the finish (§8.6).
      expect(detail.pathContinuous).toBe(expected.path_continuous ?? false)
    })
  })
})

// --- the gap to the truth, measured (§8.4, and the corpus README) ------------

describe('agreement with the generator\u2019s own walk — the truth oracle', () => {
  const score = () => {
    let truthTotal = 0
    let readTotal = 0
    let common = 0
    let exact = 0
    const missed: string[] = []
    const inError: string[] = []
    for (const name of WALKABLE) {
      const truth = new Set(golden(name).driving_path?.members ?? [])
      const read = new Set(named(traceDetail(fixture(name)).members, codesOf(name)))
      truthTotal += truth.size
      readTotal += read.size
      for (const code of read) if (truth.has(code)) common++
      for (const code of truth) if (!read.has(code)) missed.push(`${name}:${code}`)
      for (const code of read) if (!truth.has(code)) inError.push(`${name}:${code}`)
      if (truth.size === read.size && [...truth].every((c) => read.has(c))) exact++
    }
    return { truthTotal, readTotal, common, exact, missed, inError }
  }

  /**
   * The corpus README states this aggregate as a fact about the *rule*, measured by an
   * independently written reader: 197 truth, 195 read, 191 common. Reproducing it to the
   * activity is what says this implementation is that rule rather than something near it.
   */
  it('scores 97.0% recall at 97.9% precision, 24 of 28 exact on membership', () => {
    const { truthTotal, readTotal, common, exact, missed, inError } = score()
    expect({ truthTotal, readTotal, common }).toEqual({
      truthTotal: 197,
      readTotal: 195,
      common: 191,
    })
    expect(Math.round((common / truthTotal) * 1000) / 10).toBe(97)
    expect(Math.round((common / readTotal) * 1000) / 10).toBe(97.9)
    expect(exact).toBe(24)
    // Six missed and four marked in error, and every one of them is a cause the golden's
    // `why` already names — a disagreement listed there is expected, not a defect.
    expect(missed.length).toBe(6)
    expect(inError.length).toBe(4)
    expect(inError.sort()).toEqual([
      'cal-default-unused:A001010',
      'logic-lag-nonworking:A001010',
      'multiproj-baseline-rows:A001050',
      'multiproj-baseline-rows:A001090',
    ])
  })

  /**
   * `logic-lag-nonworking` is the named one: multi-day `FS` lags on a five-day calendar, which
   * is the case §8.4 knowingly approximates by reading lag as **elapsed** hours. The fix is a
   * working-time model, which is the one thing this module refuses to build.
   */
  it('names lag-across-non-working-time as the cause it accepts', () => {
    const codes = codesOf('logic-lag-nonworking')
    const detail = traceDetail(fixture('logic-lag-nonworking'))
    const drivers = [...detail.drivers.entries()].find(([id]) => codes.get(id) === 'A001030')
    expect(
      named(
        (drivers?.[1] ?? []).map((d) => d.pred),
        codes,
      ),
    ).toEqual(['A001010'])
    // The truth says A001000 drives it; both walks reach every other activity the same way.
    expect(golden('logic-lag-nonworking').driving_path?.members).toContain('A001000')
  })
})

// --- Longest Path is not Critical (§8.15, §3.6) ------------------------------

describe('the float-based tracer is a different answer (§8.15)', () => {
  it.each(WALKABLE)('%s reproduces the golden\u2019s float count', (name) => {
    expect(floatBasedMarks(fixture(name)).size).toBe(
      golden(name).driving_path?.float_based_tracer.count,
    )
  })

  /**
   * `logic-float-path` is the corpus's strongest statement of the claim: 19 of its rows carry
   * float <= 0 where 10 drive, and the file's own `float_path = 1` chain — the lowest-total-float
   * chain at −160 h — shares no member with `driving_path_flag = Y` at all.
   */
  it('marks 23 where the Longest Path marks 10, on the fixture built to say so', () => {
    const detail = traceDetail(fixture('logic-float-path'))
    const float = floatBasedMarks(fixture('logic-float-path'))
    expect(detail.members.size).toBe(10)
    expect(float.size).toBe(23)
    expect([...detail.members].filter((id) => !float.has(id)).length + float.size).toBeGreaterThan(
      detail.members.size,
    )
    expect([...float].every((id) => detail.members.has(id))).toBe(false)
  })

  it('marks 19 where 4 drive on a file P6 never ran Longest Path over', () => {
    // `logic-no-longest-path` is how most real exports arrive: `driving_path_flag` empty on
    // every row. The trace still runs, and its answer is not the float set's.
    const detail = traceDetail(fixture('logic-no-longest-path'))
    expect(detail.flag.flagged).toBe(0)
    expect(detail.state).toBe('ok')
    expect(detail.members.size).toBe(4)
    expect(floatBasedMarks(fixture('logic-no-longest-path')).size).toBe(19)
  })

  it('never reads total_float_hr_cnt: blanking the column changes nothing', () => {
    for (const name of ['logic-float-path', 'float-negative', 'logic-driving-branch']) {
      const before = traceDetail(fixture(name)).members
      const after = traceDetail(blankColumn(fixture(name), 'TASK', 'total_float_hr_cnt')).members
      expect([...after].sort()).toEqual([...before].sort())
    }
  })
})

// --- the flag is an oracle, never an input (§8.2) -----------------------------

describe('driving_path_flag is a validation oracle (§8.2)', () => {
  it('blanking the flag on every fixture changes not one member', () => {
    for (const name of WALKABLE) {
      const before = traceDetail(fixture(name))
      const after = traceDetail(blankColumn(fixture(name), 'TASK', 'driving_path_flag'))
      expect([...after.members].sort()).toEqual([...before.members].sort())
      expect(after.flag.flagged).toBe(0)
      // …and the oracle numbers move, which is the only thing that may.
      expect(after.flag.agreed).toBe(0)
      expect(after.flag.onlyComputed).toBe(after.members.size)
    }
  })

  it('reports the flag as absent from source when it is absent from the %F list', () => {
    const file = fileOf(
      table(
        'TASK',
        ['task_id', 'task_code', 'status_code', 'early_end_date'],
        [['1', 'A', 'TK_NotStart', '2026-01-05 16:00']],
      ),
    )
    expect(trace(file).flag).toEqual({
      present: false,
      flagged: 0,
      agreed: 0,
      onlyFlag: 0,
      onlyComputed: 1,
    })
  })

  it('counts the oracle both ways, and the span-consistent way separately', () => {
    // `logic-driving-branch` flags all 13 of its members, so the two readings coincide there.
    const detail = traceDetail(fixture('logic-driving-branch'))
    expect(detail.flag).toEqual({
      present: true,
      flagged: 13,
      agreed: 13,
      onlyFlag: 0,
      onlyComputed: 0,
    })
    expect(detail.flaggedRemaining).toBe(13)
    expect(detail.flaggedRemainingAgreed).toBe(13)
  })

  it('emits an info entry on divergence and never a different answer', () => {
    // Blanking one flagged row makes P6 and the trace disagree by one, and nothing else moves.
    const file = clearCell(fixture('logic-driving-branch'), 'TASK', 'driving_path_flag', 0)
    const result = trace(file)
    expect(result.members.size).toBe(13)
    const issues = traceIssues(result)
    expect(issues.map((i) => i.severity)).toEqual(['info'])
    expect(issues[0]?.stat).toBe('logic.longest_path')
    expect(issues[0]?.reason).toContain('validation oracle')
  })
})

// --- the driving test, per relationship type (§8.4) ---------------------------

describe('the driving test is per relationship type (§8.4)', () => {
  it('demands a different instant per type, measured against a different one', () => {
    expect(DRIVING_TEST).toEqual({
      PR_FS: { demand: 'early_end_date', reference: 'early_start_date' },
      PR_SS: { demand: 'early_start_date', reference: 'early_start_date' },
      PR_FF: { demand: 'early_end_date', reference: 'early_end_date' },
      PR_SF: { demand: 'early_start_date', reference: 'early_end_date' },
    })
  })

  /**
   * `logic-nonfs-drivers` puts `SS`, `FF` and `SF` **on** the driving chain rather than merely
   * in the file, with no lags anywhere, so relationship type is the only possible cause of a
   * disagreement. An `EF + lag` reader misses two activities, loses a branch and invents two.
   */
  it('reaches the SF and FF drivers an EF + lag reader cannot', () => {
    const codes = codesOf('logic-nonfs-drivers')
    const detail = traceDetail(fixture('logic-nonfs-drivers'))
    const driversOf = (code: string) => {
      const id = [...codes.entries()].find(([, c]) => c === code)?.[0]
      return (detail.drivers.get(id ?? -1) ?? []).map((d) => ({
        pred: codes.get(d.pred),
        type: d.type,
      }))
    }
    expect(driversOf('A001180')).toEqual([{ pred: 'A001140', type: 'PR_FS' }])
    expect(driversOf('A001140').sort((a, b) => (a.pred ?? '').localeCompare(b.pred ?? ''))).toEqual(
      [
        { pred: 'A001100', type: 'PR_SF' },
        { pred: 'A001130', type: 'PR_SF' },
      ],
    )
  })

  /**
   * **A driving set is not time-ordered**, so no client-side render may reconstruct the path by
   * sorting the set by date. `logic-nonfs-drivers` carries two `SF` predecessors that start
   * *and finish* after the activity they drive (§8.3).
   */
  it('keeps a predecessor that starts after the activity it drives', () => {
    const tasks = new Map(readTasks(fixture('logic-nonfs-drivers')).map((t) => [t.code, t]))
    const pred = tasks.get('A001100')
    const succ = tasks.get('A001140')
    expect(pred?.earlyStartAt).toBeGreaterThan(succ?.earlyEndAt ?? 0)
  })

  it('treats an unknown pred_type as FS rather than rejecting it', () => {
    // §2.4: an unknown enum is counted and carried, never a rejection. `PR_FS` is 99.4% of real
    // logic, so it is the only defensible fallback.
    const file = twoTaskFile('PR_XX', 0, {
      pred: { es: '2026-01-05 08:00', ef: '2026-01-09 16:00' },
      succ: { es: '2026-01-12 08:00', ef: '2026-01-16 16:00' },
    })
    const detail = traceDetail(file)
    expect(detail.members.size).toBe(2)
    expect(detail.drivers.get(2)?.[0]).toMatchObject({ pred: 1, type: 'PR_XX' })
  })

  it('reads every field by name: the 6.0 and 8.3 field sets trace identically', () => {
    // §2.7 — `TASK` moves from 61 fields to 60 between the two exports of one programme and the
    // field *order* differs, so a positional read is wrong on one of them silently.
    const six = named(traceDetail(fixture('ver-60-fieldset')).members, codesOf('ver-60-fieldset'))
    const eight = named(traceDetail(fixture('ver-83-fieldset')).members, codesOf('ver-83-fieldset'))
    expect(six).toEqual(eight)
    expect(six.length).toBe(7)
  })
})

// --- the span is remaining work (§8.3, §8.8) ----------------------------------

describe('the span is remaining work as of the data date (§8.3)', () => {
  /**
   * `TK_Complete` leaves the candidate pool **before** anything is scored, which is what makes
   * the walk structurally unable to mark a completed row — and therefore what makes precision
   * identical to the decimal under both readings of the recall denominator (§8.8). Only two
   * corpus files are progressed at all and neither has a completed predecessor that would win
   * an argmax, so this pair is hand-built: the completed row demands 16 hours below its
   * successor's start and the live one demands three weeks below it.
   */
  it('drops a completed predecessor even where it would win the argmax', () => {
    const file = fileOf(
      table(
        'TASK',
        ['task_id', 'task_code', 'task_type', 'status_code', 'early_start_date', 'early_end_date'],
        [
          ['1', 'DONE', 'TT_Task', 'TK_Complete', '2026-01-26 08:00', '2026-02-01 16:00'],
          ['2', 'LIVE', 'TT_Task', 'TK_NotStart', '2026-01-12 08:00', '2026-01-16 16:00'],
          ['3', 'SEED', 'TT_Task', 'TK_NotStart', '2026-02-02 08:00', '2026-02-06 16:00'],
        ],
      ),
      table(
        'TASKPRED',
        ['task_pred_id', 'task_id', 'pred_task_id', 'pred_type', 'lag_hr_cnt'],
        [
          ['9', '3', '1', 'PR_FS', '0'],
          ['10', '3', '2', 'PR_FS', '0'],
        ],
      ),
    )
    const detail = traceDetail(file)
    expect(detail.drivers.get(3)).toMatchObject([{ pred: 2 }])
    expect([...detail.members].sort()).toEqual([2, 3])
    // A completed predecessor is not an *external* one: nothing was left unresolved.
    expect(detail.truncated).toBe(false)
    expect(detail.remainingCount).toBe(2)
  })

  it('marks no completed row on any corpus fixture', () => {
    for (const name of WALKABLE) {
      const complete = new Set(
        readTasks(fixture(name))
          .filter((t) => t.statusCode === 'TK_Complete')
          .map((t) => t.id),
      )
      const members = traceDetail(fixture(name)).members
      expect([...members].filter((id) => complete.has(id))).toEqual([])
    }
  })

  /**
   * The restriction is deliberate and it is measured: P6's own Longest Path runs back *through*
   * completed work to the start of the programme — 1,733 of 5,180 flagged rows across the 48
   * real oracle files are `TK_Complete`, and 1,669 of those were already complete when the flag
   * was written. `flaggedRemaining` is the part of P6's answer we elected to reproduce.
   */
  it('scores the oracle against the span, not against P6’s whole flagged set', () => {
    const detail = traceDetail(fixture('logic-no-longest-path'))
    expect(detail.flag.flagged).toBe(0)
    expect(detail.flaggedRemaining).toBe(0)
    const progressed = traceDetail(fixture('float-negative'))
    expect(progressed.flaggedRemaining).toBeLessThanOrEqual(progressed.flag.flagged)
    expect(progressed.flaggedRemainingAgreed).toBe(progressed.flag.agreed)
  })
})

// --- ties (§8.3) --------------------------------------------------------------

describe('a driving path is a set, not a chain (§8.3)', () => {
  it('keeps both predecessors on all three branches of the fixture built for it', () => {
    const codes = codesOf('logic-driving-branch')
    const detail = traceDetail(fixture('logic-driving-branch'))
    expect(named(detail.branches, codes)).toEqual(['A001070', 'A001180', 'A001190'])
    for (const id of detail.branches) {
      expect((detail.drivers.get(id) ?? []).length).toBe(2)
    }
    // Keeping one predecessor per activity would drop three activities and still look like a
    // chain — which is exactly what no file without a tie can tell apart from a right answer.
    const kept = new Set(detail.members)
    const oneEach = new Set<number>()
    const walk = (id: number) => {
      if (oneEach.has(id)) return
      oneEach.add(id)
      const first = (detail.drivers.get(id) ?? [])[0]
      if (first) walk(first.pred)
    }
    for (const seed of detail.seeds) walk(seed)
    expect(oneEach.size).toBeLessThan(kept.size)
  })

  it('seeds on every activity tying the latest early_end_date, with no tie-break', () => {
    // 47 of 67 real files tie on the latest finish and 47 of 47 ties are mixed — a finish
    // milestone beside the task it finishes with, written at the same instant (§8.3, §8.14).
    const codes = codesOf('cal-flat-no-0x7f')
    const detail = traceDetail(fixture('cal-flat-no-0x7f'))
    expect(named(detail.seeds, codes)).toEqual(['A001130', 'A001170', 'A001190'])
    const finishes = new Set(
      readTasks(fixture('cal-flat-no-0x7f'))
        .filter((t) => detail.seeds.includes(t.id))
        .map((t) => t.earlyEndAt),
    )
    expect(finishes.size).toBe(1)
  })
})

// --- the same-kind zero-lag floor (§8.5) -------------------------------------

describe('the same-kind zero-lag floor (§8.5)', () => {
  it('writes a milestone\u2019s kind into both of its date columns', () => {
    expect(writtenKind('TT_FinMile', 'early_start_date')).toBe('finish')
    expect(writtenKind('TT_FinMile', 'early_end_date')).toBe('finish')
    expect(writtenKind('TT_Mile', 'early_start_date')).toBe('start')
    expect(writtenKind('TT_Mile', 'early_end_date')).toBe('start')
    expect(writtenKind('TT_Task', 'early_start_date')).toBe('start')
    expect(writtenKind('TT_Task', 'early_end_date')).toBe('finish')
    // `TT_LOE` and `TT_WBS` are not milestones, and neither is a zero-span `TT_Task`.
    expect(writtenKind('TT_LOE', 'early_end_date')).toBe('finish')
  })

  const weekend = {
    pred: { es: '2026-01-05 08:00', ef: '2026-01-09 16:00' },
    succ: { es: '2026-01-12 08:00', ef: '2026-01-16 16:00' },
  }

  it('drops an SS candidate demanding strictly less than its reference', () => {
    const detail = traceDetail(twoTaskFile('PR_SS', 0, weekend))
    expect(detail.drivers.get(2)).toEqual([])
    expect(detail.tails).toEqual([2])
    expect(detail.members.size).toBe(1)
  })

  /**
   * **The guard is the load-bearing half.** An `FS` compares a finish against a start, and a
   * zero-gap `FS` across a weekend is Friday 16:00 → Monday 08:00 — 64 elapsed hours *negative*
   * and perfectly driving in working time. Flooring it takes 25 of the 28 walkable corpus files
   * apart.
   */
  it('never drops an FS candidate, however far below its reference it lands', () => {
    const detail = traceDetail(twoTaskFile('PR_FS', 0, weekend))
    expect(detail.drivers.get(2)).toMatchObject([{ pred: 1, gapMinutes: -64 * 60 }])
  })

  it('never drops an SF candidate either', () => {
    const detail = traceDetail(twoTaskFile('PR_SF', 0, weekend))
    expect(detail.drivers.get(2)?.length).toBe(1)
  })

  it('does not apply where the lag is non-zero', () => {
    const detail = traceDetail(twoTaskFile('PR_SS', -8, weekend))
    expect(detail.drivers.get(2)?.length).toBe(1)
  })

  /**
   * The two milestone branches the net effect names: `PR_SS` touching a `TT_FinMile` and
   * `PR_FF` touching a `TT_Mile` compare a start against a written finish, so the floor must
   * not fire. **Neither branch is executed by any real file or by the corpus** — Oracle
   * Primavera Cloud forbids both pairs outright — so these are the only tests they will get.
   */
  it('spares an SS whose successor writes a finish into early_start_date', () => {
    const detail = traceDetail(
      twoTaskFile('PR_SS', 0, weekend, { succType: 'TT_FinMile', succDates: '2026-01-12 08:00' }),
    )
    expect(detail.drivers.get(2)?.length).toBe(1)
  })

  it('spares an FF whose predecessor writes a start into early_end_date', () => {
    const detail = traceDetail(
      twoTaskFile('PR_FF', 0, weekend, { predType: 'TT_Mile', predDates: '2026-01-09 08:00' }),
    )
    expect(detail.drivers.get(2)?.length).toBe(1)
  })

  it('applies to an FF between two finish milestones, which is the pair that does occur', () => {
    // 124 of 124 real single-milestone `PR_FF` relationships are an `FF` into a `TT_FinMile`;
    // the withdrawn rule excluded exactly that like-for-like case.
    const detail = traceDetail(
      twoTaskFile('PR_FF', 0, weekend, {
        predType: 'TT_FinMile',
        predDates: '2026-01-09 16:00',
        succType: 'TT_FinMile',
        succDates: '2026-01-16 16:00',
      }),
    )
    expect(detail.drivers.get(2)).toEqual([])
  })

  it('is worth a false positive on the fixture that measured it', () => {
    // `external-relationship` goes from 62.5% precision to 100% under the floor (§8.5).
    const detail = traceDetail(fixture('external-relationship'))
    expect(named(detail.members, codesOf('external-relationship'))).toEqual(
      [...(golden('external-relationship').driving_path?.members ?? [])].sort(),
    )
  })
})

// --- degradation, cycles and continuity (§8.6) --------------------------------

describe('degradation, cycles and continuity (§8.6)', () => {
  it('skips a 100%-complete programme, which is neither error nor zero', () => {
    const result = trace(fixture('logic-complete-no-remaining'))
    expect(result.state).toBe('skip')
    expect(result.reason).toBe('no remaining work at the data date')
    expect(result.members.size).toBe(0)
    expect(result.shareOfRemainingPct).toBeNull()
    expect(result.durationCalendarDays).toBeNull()
    expect(traceIssues(result)).toEqual([])
  })

  it('is unavailable where nothing parses at all', () => {
    const result = trace(fixture('enc-zeroed-file'))
    expect(result.state).toBe('unavailable')
    expect(result.reason).toContain('no readable TASK rows')
    // `unavailable` is *absent from source*, not a computation failure, so it raises no issue.
    expect(traceIssues(result)).toEqual([])
  })

  it('is unavailable where remaining rows carry no early_end_date', () => {
    const file = fileOf(
      table(
        'TASK',
        ['task_id', 'task_code', 'status_code', 'early_start_date', 'early_end_date'],
        [
          ['1', 'A', 'TK_NotStart', '', ''],
          ['2', 'B', 'TK_NotStart', '', ''],
        ],
      ),
    )
    const result = trace(file)
    expect(result.state).toBe('unavailable')
    expect(result.reason).toBe('no remaining activity carries an early_end_date')
  })

  it('reports a cycle as a finding, with the state and the count, and still returns a set', () => {
    const result = trace(fixture('logic-cycle'))
    expect(result.state).toBe('error')
    expect(result.cycleCount).toBe(1)
    expect(result.members.size).toBe(8)
    expect(result.pathContinuous).toBe(false)
    const issues = traceIssues(result)
    expect(issues[0]).toMatchObject({ stat: 'logic.longest_path', severity: 'error' })
    expect(issues[0]?.reason).toContain('ingest still succeeds')
  })

  it('records the cycle as the path slice from the revisited node', () => {
    const detail = traceDetail(fixture('logic-cycle'))
    const codes = codesOf('logic-cycle')
    const cycle = (detail.cycles[0] ?? []).map((id) => codes.get(id))
    expect(cycle[0]).toBe('A001190')
    expect(cycle[cycle.length - 1]).toBe('A001190')
    expect(cycle.length).toBe(9)
  })

  it('truncates rather than breaks where the chain leaves the file', () => {
    const result = trace(fixture('logic-external-driver'))
    expect(result.state).toBe('ok')
    expect(result.truncated).toBe(true)
    expect(result.pathContinuous).toBe(false)
    expect(traceIssues(result).map((i) => i.reason)).toContain(
      'the driving chain reached a predecessor outside this file',
    )
  })

  it('does not truncate on an external relationship the chain never reaches', () => {
    // `external-relationship` carries a `pred_proj_id` pointing outside the file — legitimate,
    // not corruption — on an activity no driving walk visits.
    expect(trace(fixture('external-relationship')).truncated).toBe(false)
  })

  it('is discontinuous where the only tail is ungrounded', () => {
    // `missing-taskpred` has no `TASKPRED` table at all, so the seed is its own chain tail and
    // it starts long after the data date.
    const result = trace(fixture('missing-taskpred'))
    expect(result.members.size).toBe(1)
    expect(result.pathContinuous).toBe(false)
  })

  it('grounds a tail that starts on or before the data date', () => {
    const result = trace(fixture('logic-driving-branch'))
    expect(result.pathContinuous).toBe(true)
  })

  it('grounds a tail on its own project\u2019s data date where activities span two', () => {
    // `multiproj-two-proj-id` must be rejected at ingest for spanning two `TASK.proj_id`, but
    // the trace still runs and each activity is grounded against its own `PROJECT` row.
    expect(trace(fixture('multiproj-two-proj-id')).pathContinuous).toBe(true)
  })
})

// --- what the trace produces (§8.7) -------------------------------------------

describe('what the trace produces (§8.7)', () => {
  it('counts calendar days inclusively over the chain\u2019s own window', () => {
    const result = trace(fixture('logic-driving-branch'))
    expect(traceDetail(fixture('logic-driving-branch')).window).toEqual({
      start: '2026-01-05 08:00',
      finish: '2026-07-30 16:00',
    })
    expect(result.durationCalendarDays).toBe(207)
    expect(result.shareOfRemainingPct).toBe(65)
  })

  it('reports the share of remaining activities to one place', () => {
    expect(trace(fixture('wbs-flat')).shareOfRemainingPct).toBe(95)
    expect(trace(fixture('logic-external-driver')).shareOfRemainingPct).toBe(31.6)
    expect(trace(fixture('wbs-flat')).durationCalendarDays).toBe(460)
  })

  it('narrows the detail to the contract without changing an answer', () => {
    const detail = traceDetail(fixture('logic-nonfs-drivers'))
    const result = trace(fixture('logic-nonfs-drivers'))
    expect(result.state).toBe(detail.state)
    expect([...result.members].sort()).toEqual([...detail.members].sort())
    expect(result.truncated).toBe(detail.truncated)
    expect(result.cycleCount).toBe(detail.cycleCount)
    expect(result.pathContinuous).toBe(detail.pathContinuous)
    expect(result.flag).toEqual(detail.flag)
    expect(result.reason).toBeUndefined()
  })
})

// --- instants (§3.4, §2.6) ----------------------------------------------------

describe('instants are naive local wall-clock (§3.4)', () => {
  it('reads a P6 timestamp as elapsed minutes with no timezone in it', () => {
    const midnight = instantMinutes('2026-01-05')
    expect(instantMinutes('2026-01-05 08:00')).toBe((midnight ?? 0) + 480)
    expect(instantMinutes('2026-01-06 08:00')).toBe((midnight ?? 0) + 1440 + 480)
  })

  it('accepts an unpadded hour, which \\d\\d:\\d\\d would drop silently', () => {
    expect(instantMinutes('2026-01-05 8:00')).toBe(instantMinutes('2026-01-05 08:00'))
  })

  it('returns null for an empty or unreadable cell rather than a wrong instant', () => {
    expect(instantMinutes('')).toBeNull()
    expect(instantMinutes(undefined)).toBeNull()
    expect(instantMinutes('not a date')).toBeNull()
    expect(instantMinutes('2026-13-01 08:00')).toBeNull()
  })

  it('does not shift across a daylight-saving boundary', () => {
    // A UTC-converting reader moves one of these by an hour; the `.xer` records no offset, so
    // both are exactly one civil day apart and nothing else.
    const before = instantMinutes('2026-03-28 12:00') ?? 0
    const after = instantMinutes('2026-03-29 12:00') ?? 0
    expect(after - before).toBe(1440)
  })
})

// --- helpers ------------------------------------------------------------------

function table(
  name: string,
  fields: readonly string[],
  rows: readonly (readonly XerCell[])[],
): XerTable {
  const index = new Map<string, number>(fields.map((field, i) => [field, i]))
  return { name, fields, index, rows }
}

function fileOf(...tables: readonly XerTable[]): XerFile {
  return {
    header: null,
    tables: new Map(tables.map((t) => [t.name, t])),
    issues: [],
    terminated: true,
  }
}

/** The same file with one column emptied — how a test proves a column is never an input. */
function blankColumn(file: XerFile, tableName: string, field: string): XerFile {
  const source = file.tables.get(tableName)
  if (!source) return file
  const at = source.index.get(field)
  if (at === undefined) return file
  const rows = source.rows.map((row) => row.map((cell, i) => (i === at ? '' : cell)))
  const tables = new Map(file.tables)
  tables.set(tableName, { ...source, rows })
  return { ...file, tables }
}

/** The same file with one cell of one row emptied. */
function clearCell(file: XerFile, tableName: string, field: string, rowIndex: number): XerFile {
  const source = file.tables.get(tableName)
  if (!source) return file
  const at = source.index.get(field)
  if (at === undefined) return file
  const rows = source.rows.map((row, i) =>
    i === rowIndex ? row.map((cell, j) => (j === at ? '' : cell)) : row,
  )
  const tables = new Map(file.tables)
  tables.set(tableName, { ...source, rows })
  return { ...file, tables }
}

interface TwoTaskShape {
  readonly pred: { readonly es: string; readonly ef: string }
  readonly succ: { readonly es: string; readonly ef: string }
}

interface TwoTaskTypes {
  readonly predType?: string
  readonly predDates?: string
  readonly succType?: string
  readonly succDates?: string
}

/**
 * Two activities and one relationship, hand-built.
 *
 * The §8.5 floor's milestone branches are **executed by no real file and by no corpus fixture**,
 * so a hand-built pair is the only way they are ever exercised. A milestone row writes one
 * instant into both date columns (§8.14), which is what `predDates`/`succDates` set.
 */
function twoTaskFile(
  type: string,
  lagHours: number,
  shape: TwoTaskShape,
  types: TwoTaskTypes = {},
): XerFile {
  const predType = types.predType ?? 'TT_Task'
  const succType = types.succType ?? 'TT_Task'
  const predEs = types.predDates ?? shape.pred.es
  const predEf = types.predDates ?? shape.pred.ef
  const succEs = types.succDates ?? shape.succ.es
  const succEf = types.succDates ?? shape.succ.ef
  return fileOf(
    table(
      'TASK',
      [
        'task_id',
        'proj_id',
        'task_code',
        'task_type',
        'status_code',
        'early_start_date',
        'early_end_date',
        'driving_path_flag',
      ],
      [
        ['1', '1', 'PRED', predType, 'TK_NotStart', predEs, predEf, ''],
        ['2', '1', 'SUCC', succType, 'TK_NotStart', succEs, succEf, ''],
      ],
    ),
    table(
      'TASKPRED',
      ['task_pred_id', 'task_id', 'pred_task_id', 'pred_type', 'lag_hr_cnt'],
      [['9', '2', '1', type, String(lagHours)]],
    ),
  )
}
