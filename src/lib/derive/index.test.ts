import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { DeriveInput } from '../contracts/derive'
import {
  DERIVED_MAX_BYTES,
  DERIVED_VERSION,
  DERIVED_WARN_BYTES,
  type Derived,
} from '../contracts/derived'
import { WBS_SUMMARY_CAP } from '../contracts/domain'
import { parseXer } from '../xer'
import type { WbsNode } from './activities'
import { readActivities, readWbs } from './activities'
import {
  CODE_TYPE_CAP,
  derive,
  derivedBytes,
  programmeWindow,
  wbsDepth,
  wbsSummary,
  withinSizeBudget,
} from './index'

const CORPUS = fileURLToPath(new URL('../../../fixtures/synthetic/corpus/', import.meta.url))
const corpusNames = readdirSync(CORPUS)
  .filter((n) => n.endsWith('.xer'))
  .map((n) => n.slice(0, -4))
  .sort()

interface Golden {
  assertions: {
    data_date: string | null
    activity_count: number
    status_mix: Record<string, number>
    activity_type_mix: Record<string, number>
    relationship_type_mix: Record<string, number>
    wbs: { node_count: number; max_depth: number }
    calendar_count: number
    calendars_in_use: number
    duration_working_days: Record<string, unknown>
    resource_count: number
    resource_assignment_count: number
    external_relationship_count: number
    float_hr: { negative: number; zero: number; null: number }
  }
}
const golden = (name: string) =>
  JSON.parse(readFileSync(`${CORPUS}${name}.expected.json`, 'utf8')) as Golden

const CONSTANTS = {
  programmeId: '11111111-1111-1111-1111-111111111111',
  revisionId: '22222222-2222-2222-2222-222222222222',
  parserVersion: '0.1.0',
  computedAt: '2026-08-09T00:00:00Z',
}

function run(name: string, overrides: Partial<DeriveInput> = {}) {
  const file = parseXer(readFileSync(`${CORPUS}${name}.xer`))
  return derive({ file, ...CONSTANTS, ...overrides })
}

// --- the corpus sweep --------------------------------------------------------

describe('every golden assertion this pipeline owns', () => {
  it('agrees with all 29 fixtures', () => {
    for (const name of corpusNames) {
      const { assertions: want } = golden(name)
      const { derived: got } = run(name)
      const at = (field: string) => `${name}.${field}`

      expect.soft(got.shape.activity_count, at('activity_count')).toBe(want.activity_count)
      expect.soft(got.progress.status_mix, at('status_mix')).toEqual(want.status_mix)
      expect
        .soft(got.distributions.activity_type_mix, at('activity_type_mix'))
        .toEqual(want.activity_type_mix)
      expect
        .soft(got.logic.relationship_type_mix, at('relationship_type_mix'))
        .toEqual(want.relationship_type_mix)
      expect.soft(got.shape.wbs_node_count, at('wbs_node_count')).toBe(want.wbs.node_count)
      // A depth of 1 is a correct answer, not an error: `wbs-flat` is a real tender's shape.
      expect.soft(got.shape.wbs_depth, at('wbs_depth')).toBe(want.wbs.max_depth)
      expect.soft(got.shape.calendar_count, at('calendar_count')).toBe(want.calendar_count)
      // A fact about the programme beside a fact about the file: `missing-calendar` reports
      // 2 in use against a `calendar_count` of 0.
      expect.soft(got.shape.calendars_in_use, at('calendars_in_use')).toBe(want.calendars_in_use)
      expect.soft(got.shape.resource_count, at('resource_count')).toBe(want.resource_count)
      expect
        .soft(got.shape.resource_assignment_count, at('resource_assignment_count'))
        .toBe(want.resource_assignment_count)
      expect
        .soft(got.logic.external_relationship_count, at('external_relationship_count'))
        .toBe(want.external_relationship_count)
      expect.soft(got.time.data_date, at('data_date')).toBe(want.data_date)
      expect
        .soft(got.distributions.float_histogram.null_count, at('float null'))
        .toBe(want.float_hr.null)

      const working = want.duration_working_days
      const expected = working.state ? working : { state: 'ok', ...working }
      expect.soft(got.time.duration_working_days, at('duration_working_days')).toEqual(expected)
    }
  })
})

// --- §2.7's identity ---------------------------------------------------------

describe('the name-mapping rule, end to end', () => {
  it('derives byte-identical objects from the 6.0 and 8.3 field sets', () => {
    // The same programme in both `%F` field sets, with the field *order* differing — so a
    // positional parser reads one of them wrong silently and produces a different object.
    // Ids and the timestamp are held constant because they are the only fields that are
    // properly not a function of the bytes.
    const a = run('ver-60-fieldset')
    const b = run('ver-83-fieldset')
    expect(a.derived).toEqual(b.derived)
    expect(JSON.stringify(a.derived)).toBe(JSON.stringify(b.derived))
    expect(JSON.stringify(a.activities)).toBe(JSON.stringify(b.activities))
    expect(JSON.stringify(a.row.card)).toBe(JSON.stringify(b.row.card))
  })

  it('still records the P6 version the two files disagree about', () => {
    // The one facet that *should* differ: `p6_version` is a fact about the export and is
    // recorded, never rejected on (§2.7). Everything computed from the rows is identical.
    expect(run('ver-60-fieldset').row.p6_version).toBe('6.0')
    expect(run('ver-83-fieldset').row.p6_version).toBe('8.3')
  })
})

// --- §3.4's stated invariants ------------------------------------------------

describe('the two duration fields count one window', () => {
  it('holds every invariant §3.4 states, on every fixture', () => {
    for (const name of corpusNames) {
      const { time } = run(name).derived
      const calendarDays = time.duration_calendar_days
      if (time.start_date === null || time.finish_date === null) {
        expect.soft(calendarDays, `${name} null window`).toBeNull()
        continue
      }
      // Inclusive: a programme starting and finishing on one date is 1, never 0.
      expect.soft(calendarDays, `${name} calendar days`).toBeGreaterThanOrEqual(1)
      const working = time.duration_working_days
      // The discriminant is optional on the ok branch, so narrow on the field itself.
      if ('days' in working) {
        expect.soft(working.days, `${name} working days`).toBeGreaterThanOrEqual(0)
        expect
          .soft(working.days, `${name} working <= calendar`)
          .toBeLessThanOrEqual(calendarDays as number)
        // The corpus's programme calendar is five-day, so equality — which is reachable
        // and correct on a calendar with no non-working date in the window — must not occur.
        expect.soft(working.days, `${name} five-day calendar`).toBeLessThan(calendarDays as number)
      }
    }
  })

  it('measures both fields on the window it publishes', () => {
    const { derived } = run('wbs-flat')
    const rows = readActivities(parseXer(readFileSync(`${CORPUS}wbs-flat.xer`))).rows
    expect(programmeWindow(rows)).toEqual({
      start: derived.time.start_date,
      finish: derived.time.finish_date,
    })
    // 328 working days over the 459-day span the corpus README names.
    expect(derived.time.duration_working_days).toMatchObject({ days: 328 })
    expect(derived.time.duration_calendar_days).toBe(460)
  })
})

// --- the groups --------------------------------------------------------------

describe('progress', () => {
  it('derives is_baseline from the data, never from a label', () => {
    // It decides which quality checks apply, so an unprogressed tender is a baseline
    // whatever it is called and a file with one actual start is not, however it is titled.
    expect(run('progress-none').derived.progress.is_baseline).toBe(true)
    expect(run('progress-full').derived.progress.is_baseline).toBe(false)
    expect(run('progress-full').derived.progress.pct_complete).toBe(100)
    expect(run('progress-none').derived.progress.pct_complete).toBe(0)
  })
})

describe('logic', () => {
  it('never ships critical_count without its threshold', () => {
    // "131 critical activities" and "1,265 critical activities" are answers to different
    // questions: the threshold is 0 on one real fixture and 168 hours on the other.
    for (const name of corpusNames) {
      const { logic } = run(name).derived
      expect.soft(logic.critical_threshold_hr, `${name} threshold`).toBeTypeOf('number')
      expect.soft(logic.critical_count, `${name} count`).toBeTypeOf('number')
    }
  })

  it('reports a cycle as an error state with an issues entry, and still publishes', () => {
    const { derived } = run('logic-cycle')
    expect(derived.logic.longest_path.state).toBe('error')
    expect(derived.logic.cycle_count).toBeGreaterThan(0)
    expect(
      derived.issues.some((i) => i.stat === 'logic.longest_path' && i.severity === 'error'),
    ).toBe(true)
    expect(derived.shape.activity_count).toBe(20) // the rest of the object is intact
  })

  it('skips the longest path on a 100%-complete programme', () => {
    // Neither error nor zero: there is no remaining work to span.
    expect(run('logic-complete-no-remaining').derived.logic.longest_path.state).toBe('skip')
  })

  it('truncates rather than breaking where the chain leaves the file', () => {
    const path = run('logic-external-driver').derived.logic.longest_path
    expect(path.state).toBe('ok')
    if (path.state === 'ok') expect(path.truncated).toBe(true)
  })

  it('publishes a computed provenance even where P6 exported an answer', () => {
    // A stat whose method flips per file cannot be compared across programmes; the flag is
    // a validation oracle and disagreement is an `info` entry and nothing more.
    const path = run('wbs-flat').derived.logic.longest_path
    if (path.state === 'ok') expect(path.provenance).toBe('computed')
  })
})

describe('shape', () => {
  it('summarises the first level only, excluding the project node', () => {
    const nodes = readWbs(parseXer(readFileSync(`${CORPUS}progress-full.xer`)))
    const rows = readActivities(parseXer(readFileSync(`${CORPUS}progress-full.xer`))).rows
    const summary = wbsSummary(nodes, rows)
    expect(summary.entries.map((e) => e.name)).toEqual([
      'Station Fitout',
      'Handover',
      'Substructure',
    ])
    // The first-level entry counts its whole subtree, so the three add up to the programme.
    expect(summary.entries.reduce((a, e) => a + e.activity_count, 0)).toBe(rows.length)
    expect(summary.truncated).toBe(false)
  })

  it('summarises nothing where the programme has no breakdown at all', () => {
    // A summary whose one entry is the whole programme is not a breakdown — the same true
    // statement the `no WBS` badge makes.
    const { shape } = run('wbs-flat').derived
    expect(shape.wbs_depth).toBe(1)
    expect(shape.wbs_summary).toEqual([])
    expect(shape.wbs_summary_truncated).toBe(false)
  })

  it('caps the summary at twenty and keeps the largest', () => {
    const nodes: WbsNode[] = [
      {
        wbs_id: 1,
        parent_wbs_id: null,
        wbs_short_name: 'P',
        wbs_name: 'Project',
        proj_node_flag: true,
      },
      ...Array.from({ length: 25 }, (_, i) => ({
        wbs_id: i + 2,
        parent_wbs_id: 1,
        wbs_short_name: `N${i}`,
        wbs_name: `Node ${i}`,
        proj_node_flag: false,
      })),
    ]
    const summary = wbsSummary(nodes, [])
    expect(summary.entries).toHaveLength(WBS_SUMMARY_CAP)
    expect(summary.truncated).toBe(true)
  })

  it('stops walking a WBS parent loop rather than hanging', () => {
    const looped: WbsNode[] = [
      { wbs_id: 1, parent_wbs_id: 2, wbs_short_name: 'a', wbs_name: 'a', proj_node_flag: false },
      { wbs_id: 2, parent_wbs_id: 1, wbs_short_name: 'b', wbs_name: 'b', proj_node_flag: false },
    ]
    expect(wbsDepth(looped)).toBe(2)
  })
})

describe('codes', () => {
  it('enumerates types and never their values', () => {
    // A code type with hundreds of values would dominate the file; `TASKACTV` is the largest
    // table in both real fixtures at ~14 assignments per activity.
    const { codes, shape } = run('wbs-flat').derived
    expect(codes.types.length).toBeLessThanOrEqual(CODE_TYPE_CAP)
    expect(codes.types.length).toBeLessThanOrEqual(shape.activity_code_type_count)
    for (const type of codes.types) {
      expect.soft(Object.keys(type).sort()).toEqual(['assigned_pct', 'name', 'value_count'])
      expect.soft(type.assigned_pct).toBeLessThanOrEqual(100)
    }
  })
})

// --- §3.10 and §3.11 ---------------------------------------------------------

describe('ingest never fails on a stat error', () => {
  it('publishes a programme whose calendar table is gone', () => {
    const { derived } = run('missing-calendar')
    expect(derived.time.duration_working_days).toEqual({
      state: 'unavailable',
      reason: 'no CALENDAR table, so there is no shift pattern to convert on',
    })
    // `unavailable` is *absent from source*, not a failed computation, so it raises nothing.
    expect(derived.issues.filter((i) => i.stat === 'time.duration_working_days')).toEqual([])
    expect(derived.quality.applicable).toBe(10)
  })

  it('publishes a programme with no relationships at all', () => {
    const { derived } = run('missing-taskpred')
    expect(derived.shape.relationship_count).toBe(0)
    expect(derived.logic.relationship_type_mix).toEqual({})
    expect(derived.quality.applicable).toBe(7)
  })

  it('produces a readable object even from a file with nothing in it', () => {
    const { derived, activities, row } = run('enc-zeroed-file')
    expect(derived.version).toBe(DERIVED_VERSION)
    expect(derived.shape.activity_count).toBe(0)
    expect(activities.activities.task_id).toEqual([])
    expect(row.checks_applicable).toBe(0)
  })
})

describe('the size budget', () => {
  it('keeps every fixture far under the warning threshold', () => {
    for (const name of corpusNames) {
      const bytes = derivedBytes(run(name).derived)
      expect.soft(bytes, `${name} bytes`).toBeLessThan(DERIVED_WARN_BYTES)
    }
  })

  it('degrades the stats rather than the upload above the ceiling', () => {
    // Every capped list exists to keep the figure flat as programme size grows; reaching
    // the ceiling means something uncapped got in, and the repair drops the lists.
    const { derived } = run('logic-float-path')
    const bloated: Derived = {
      ...derived,
      codes: {
        types: Array.from({ length: 4000 }, (_, i) => ({
          name: `Code type with a long name ${i}`,
          value_count: i,
          assigned_pct: 50,
        })),
        truncated: false,
      },
    }
    expect(derivedBytes(bloated)).toBeGreaterThan(DERIVED_MAX_BYTES)
    const minimal = withinSizeBudget(bloated)
    expect(derivedBytes(minimal)).toBeLessThan(DERIVED_MAX_BYTES)
    // The scalars survive; only the lists go, and each says it was truncated.
    expect(minimal.shape.activity_count).toBe(derived.shape.activity_count)
    expect(minimal.shape.wbs_depth).toBe(derived.shape.wbs_depth)
    expect(minimal.time).toEqual(derived.time)
    expect(minimal.progress).toEqual(derived.progress)
    expect(minimal.logic).toEqual(derived.logic)
    expect(minimal.quality.passed).toBe(derived.quality.passed)
    expect(minimal.quality.checks.map((c) => c.state)).toEqual(
      derived.quality.checks.map((c) => c.state),
    )
    expect(minimal.quality.checks.every((c) => c.examples === undefined)).toBe(true)
    expect(minimal.shape.wbs_summary).toEqual([])
    expect(minimal.shape.wbs_summary_truncated).toBe(true)
    expect(minimal.distributions.s_curve.cumulative).toEqual([])
    expect(minimal.codes.types).toEqual([])
    expect(minimal.codes.truncated).toBe(true)
    expect(minimal.issues.at(-1)?.stat).toBe('derived')
    expect(minimal.issues.at(-1)?.reason).toMatch(/upload is unaffected/)
  })
})

// --- the row payload ---------------------------------------------------------

describe('the revision facets', () => {
  it('are the typed columns the shelf sorts, ranges and facets on', () => {
    const { row, derived } = run('progress-full')
    expect(row).toMatchObject({
      p6_version: '8.3',
      activity_count: derived.shape.activity_count,
      start_date: derived.time.start_date,
      finish_date: derived.time.finish_date,
      data_date: derived.time.data_date,
      pct_complete: derived.progress.pct_complete,
      is_baseline: derived.progress.is_baseline,
      checks_passed: derived.quality.passed,
      checks_applicable: derived.quality.applicable,
      derived_version: DERIVED_VERSION,
    })
  })

  it('records the issue count the row badges on', () => {
    const { row, derived } = run('logic-cycle')
    expect(row.card.issues_count).toBe(derived.issues.length)
    expect(row.card.issues_count).toBeGreaterThan(0)
  })
})

// --- reproducibility ---------------------------------------------------------

describe('a derive is reproducible', () => {
  it('stamps only what it was given, and repeats exactly', () => {
    const a = run('float-negative')
    const b = run('float-negative')
    expect(JSON.stringify(a.derived)).toBe(JSON.stringify(b.derived))
    expect(a.derived.computed_at).toBe(CONSTANTS.computedAt)
    expect(a.derived.parser_version).toBe(CONSTANTS.parserVersion)
    expect(a.derived.programme_id).toBe(CONSTANTS.programmeId)
    expect(a.derived.revision_id).toBe(CONSTANTS.revisionId)
  })
})
