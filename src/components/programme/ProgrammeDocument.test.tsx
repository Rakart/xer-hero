import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Derived } from '@/lib/contracts/derived'
import { broken, clean, perf20k, tender } from './fixture'
import { ProgrammeDocument } from './ProgrammeDocument'
import { Tombstone } from './Tombstone'
import type { ProgrammeView, TombstoneView } from './types'

/**
 * The page rendered end to end against four realistic `derived.json` objects.
 *
 * This is the only proof available that every branch renders, because there is no database
 * here to render against — so the four fixtures carry, between them, `wbs_depth: 1`, both
 * `error` states, a `skip`, an `unavailable`, a programme with zero issues, a check that
 * misses by half a percentage point, 12,829 null floats and a file with no relationships at
 * all.
 */

const NOW = new Date('2026-08-09T12:00:00Z')

function makeView(derived: Derived, overrides: Partial<ProgrammeView> = {}): ProgrammeView {
  return {
    programmeId: '11111111-1111-4111-8111-111111111111',
    slug: 'station-remodelling',
    title: 'Station remodelling — Stage 3',
    description: 'Stage 3 of the station remodelling, issued for tender.',
    sectorCode: 'rail',
    sectorLabel: 'Rail',
    licence: 'CC-BY-4.0',
    voteCount: 214,
    status: 'published',
    revision: {
      id: '22222222-2222-4222-8222-222222222222',
      revNo: 23,
      uploadedAt: '2026-05-09T09:00:00Z',
      uploaderDisplayName: 'planner-a3f92c',
      p6Version: '19.12',
      activityCount: derived.shape.activity_count,
      pctComplete: derived.progress.pct_complete,
      status: 'published',
      removalClass: null,
      changeNote: null,
    },
    isCurrentRevision: true,
    currentRevNo: 23,
    revisions: [
      {
        revNo: 23,
        uploadedAt: '2026-05-09T09:00:00Z',
        status: 'published',
        removalClass: null,
        uploaderDisplayName: 'planner-a3f92c',
        changeNote: 'May update',
      },
      {
        revNo: 22,
        uploadedAt: '2026-04-09T09:00:00Z',
        status: 'tombstoned',
        removalClass: 'A',
        uploaderDisplayName: 'planner-a3f92c',
        changeNote: null,
      },
      // Owner-visible state that must never reach a public control.
      {
        revNo: 24,
        uploadedAt: '2026-06-09T09:00:00Z',
        status: 'pending',
        removalClass: null,
        uploaderDisplayName: 'planner-a3f92c',
        changeNote: null,
      },
    ],
    derived,
    lineage: {
      parentSlug: 'depot-resignalling',
      parentTitle: 'Depot resignalling',
      parentRevNo: 4,
      parentUploader: 'northline',
      revisionCount: 23,
      forkCount: 3,
      familyCount: 4,
    },
    ancestors: [{ slug: 'depot-resignalling', title: 'Depot resignalling', status: 'published' }],
    downloadUrl: 'http://blob.test/p/1/r/2/original.xer.gz',
    activitiesUrl: 'http://blob.test/p/1/r/2/activities.json.gz',
    originalGzBytes: 932_864,
    citationUrl: 'https://xerhero.com/p/station-remodelling/r/23',
    ...overrides,
  }
}

const render = (derived: Derived, overrides?: Partial<ProgrammeView>) =>
  renderToStaticMarkup(<ProgrammeDocument view={makeView(derived, overrides)} now={NOW} />)

describe('every fixture renders without a hole in it', () => {
  const cases: Array<[string, Derived]> = [
    ['perf-20k', perf20k],
    ['tender', tender],
    ['broken', broken],
    ['clean', clean],
  ]

  for (const [name, derived] of cases) {
    it(`renders ${name} with no NaN, undefined or [object Object]`, () => {
      const html = render(derived)
      expect(html).not.toMatch(/NaN/)
      expect(html).not.toMatch(/undefined/)
      expect(html).not.toMatch(/\[object Object\]/)
      expect(html).toContain('Station remodelling')
    })

    it(`emits no duplicate element id on ${name}, and every in-page anchor resolves`, () => {
      const html = render(derived)
      const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])
      expect(new Set(ids).size).toBe(ids.length)
      const fragments = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1])
      for (const fragment of fragments) expect(ids).toContain(fragment)
    })

    it(`renders all eight fact tiles on ${name}`, () => {
      const html = render(derived)
      for (const label of [
        'Activities',
        'Complete',
        'Window',
        'Relationships',
        'WBS',
        'Resources',
        'Calendars',
        'DCMA 14-point',
      ]) {
        expect(html).toContain(label)
      }
    })
  }
})

describe('the 20,000-activity fixture', () => {
  const html = render(perf20k)

  it('prints the verdict sentence with the failing checks and their values', () => {
    expect(html).toContain(
      'This programme fails 4 of the 10 checks that apply to it: leads at 2.1%',
    )
  })

  it('never prints critical_count without critical_threshold_hr', () => {
    expect(html).toContain('activities are <b>critical</b>')
    expect(html).toContain('hours’ total float')
    expect(html).toContain('not comparable with another programme')
  })

  it('prints the longest-path provenance sentence verbatim, and the warning', () => {
    expect(html).toContain(
      'computed by this site from the file’s own dates — P6 did not export a Longest Path',
    )
    expect(html).toContain('Longest path is not the same thing as critical')
  })

  it('prints the null-float callout', () => {
    expect(html).toContain('12,829 activities have no float at all')
    expect(html).toContain('an empty float is not a zero float')
  })

  it('draws float as a band bar plus the exact nine-row table, not as a histogram', () => {
    for (const label of ['under −20d', '−20 to 0d', '20–44d', 'over 200d']) {
      expect(html).toContain(label)
    }
    expect(html).toContain('99.2')
  })

  it('carries mark, word, value and threshold on every check row', () => {
    expect(html).toContain('PASS')
    expect(html).toContain('FAIL')
    expect(html).toContain('NOT APPLICABLE')
    expect(html).toContain('target &lt;=5%')
    expect(html).toContain('7.1× the 5% limit')
    expect(html).toContain('27 where the standard allows none')
  })

  it('offers the table deep link only for the checks the payload can express', () => {
    expect(html).toContain('data-activity-filter="high_float"')
    expect(html).toContain('data-activity-filter="negative_float"')
    // Leads is a relationship-level check and `TASKPRED` is out of the cut.
    expect(html).not.toContain('data-activity-filter="leads"')
    expect(html).toContain('no relationship table')
  })

  it('states the S-curve is one line and why', () => {
    expect(html).toContain('One line, not two')
    expect(html).toContain('baseline tables this file does not carry')
  })

  it('shows no partially-analysed banner on a programme with no issues', () => {
    expect(html).not.toContain('Partially analysed')
  })

  it('keeps pending revisions out of the public selector', () => {
    expect(html).not.toContain('r24')
  })
})

describe('the tender fixture — wbs_depth 1 is a correct answer', () => {
  const html = render(tender)

  it('replaces the WBS panel rather than emptying it', () => {
    expect(html).toContain('No work breakdown structure')
    expect(html).toContain('This is a real shape, not a parse failure')
    expect(html).toContain('All 3,344 activities sit under a single node')
  })

  it('reads the WBS tile as none / single node', () => {
    expect(html).toContain('none')
    expect(html).toContain('single node')
  })

  it('promises no treemap and no WBS chart anywhere', () => {
    expect(html.toLowerCase()).not.toContain('treemap')
  })

  it('prints a skipped longest path as not applicable, with its reason', () => {
    expect(html).toContain('not applicable')
    expect(html).toContain('the programme has no progress')
  })

  it('makes the half-point miss on check 4 legible', () => {
    expect(html).toContain('89.5%')
    expect(html).toContain('target &gt;=90%')
    expect(html).toContain('0.5 points short of the 90% floor')
  })

  it('renders no data date rather than inventing one', () => {
    expect(html).toContain('no data date')
  })
})

describe('the broken fixture — the four states rendered distinctly', () => {
  const html = render(broken)

  it('raises the partially-analysed banner for error states only', () => {
    expect(html).toContain('Partially analysed')
    expect(html).toContain('clndr_data parse failed for clndr_id 42')
    expect(html).toContain('the driving chain contains a cycle')
    expect(html).toContain('Everything else on this page computed normally')
  })

  it('keeps a warn-severity issue out of the banner and gives it a home', () => {
    expect(html).toContain('PROJWBS names 0 nodes')
  })

  it('renders skip as its own thing with its reason, never as a fail', () => {
    expect(html).toContain('NOT APPLICABLE')
    expect(html).toContain('no relationships in the file')
  })

  it('survives no relationships, no window and no float without dividing by zero', () => {
    expect(html).toContain('no relationships')
    expect(html).toContain('no window in the file')
    expect(html).toContain('no ratio to report')
  })

  it('still prints the critical threshold beside the count', () => {
    expect(html).toContain('168')
  })
})

describe('a programme with zero issues', () => {
  const html = render(clean)

  it('has nothing to apologise for', () => {
    expect(html).not.toContain('Partially analysed')
    expect(html).toContain('This programme passes all 10 of the checks that apply to it.')
  })

  it('reports a truncated longest path honestly', () => {
    expect(html).toContain('truncated at that point')
  })

  it('never drops the calendar clause, even at a seven-day week', () => {
    expect(html).toContain('7-day week')
  })
})

describe('a superseded revision', () => {
  it('says so and links to the current one', () => {
    const html = render(perf20k, { isCurrentRevision: false, currentRevNo: 23 })
    expect(html).toContain('which is not the current one')
    expect(html).toContain('href="/p/station-remodelling"')
  })
})

describe('§7.4 — nothing is worded as a guarantee', () => {
  const banned = [
    'verified',
    'certified',
    'vetted',
    'curated',
    'quality-assured',
    'trusted by',
    'we ensure',
    'we guarantee',
    'rest assured',
    'free forever',
    'coming soon',
    'safe to use',
    'ready to use',
  ]

  for (const [name, derived] of [
    ['perf-20k', perf20k],
    ['tender', tender],
    ['broken', broken],
    ['clean', clean],
  ] as Array<[string, Derived]>) {
    it(`uses none of the banned vocabulary on ${name}`, () => {
      const html = render(derived).toLowerCase()
      for (const word of banned) expect(html).not.toContain(word)
    })
  }

  it('states the publication posture without softening it', () => {
    const html = render(perf20k)
    expect(html).toContain('Published exactly as uploaded')
    expect(html).toContain('The download serves the original bytes')
    expect(html).toContain('not a barrier')
  })

  it('carries rel=nofollow on the download link', () => {
    expect(render(perf20k)).toContain('rel="nofollow"')
  })
})

describe('Compare… is present and inert', () => {
  it('renders disabled, visibly so', () => {
    const html = render(perf20k)
    expect(html).toContain('Compare…')
    expect(html).toContain('Not in v1')
    expect(html).toMatch(/Compare/)
    expect(html).toContain('disabled')
  })
})

describe('the tombstone', () => {
  const base: TombstoneView = {
    slug: 'station-remodelling',
    title: 'Station remodelling — Stage 3',
    uploaderDisplayName: 'planner-a3f92c',
    sectorLabel: 'Rail',
    revNo: 23,
    removalClass: 'A',
    hasTombstonedAncestor: false,
    ancestors: [],
  }

  it('renders the withdrawal line for a Class A', () => {
    const html = renderToStaticMarkup(<Tombstone view={base} />)
    expect(html).toContain('Withdrawn by uploader.')
    expect(html).toContain('Station remodelling')
    expect(html).toContain('planner-a3f92c')
  })

  it('renders the complaint line for a Class B, naming nobody', () => {
    const html = renderToStaticMarkup(<Tombstone view={{ ...base, removalClass: 'B' }} />)
    expect(html).toContain('Removed following a rights or personal-data complaint.')
    expect(html).not.toMatch(/case|complainant/i)
  })

  it('renders the cascade line for a fork, which is not an accusation', () => {
    const html = renderToStaticMarkup(
      <Tombstone view={{ ...base, removalClass: 'B', hasTombstonedAncestor: true }} />,
    )
    expect(html).toContain(
      'Removed because a programme it was forked from was removed following a complaint.',
    )
  })

  it('offers no download and no fork', () => {
    const html = renderToStaticMarkup(<Tombstone view={base} />)
    expect(html).not.toContain('original.xer.gz')
    expect(html).toContain('nothing here to download')
  })

  it('renders the breadcrumb unlinked', () => {
    const html = renderToStaticMarkup(<Tombstone view={base} />)
    expect(html).not.toContain('href="/"')
  })
})
