import { describe, expect, it } from 'vitest'
import { OG_DEFAULTS, ogStrings, programmeHead, programmePath, revisionHead } from './crawl'

describe('programmeHead', () => {
  it('self-canonicalises a published programme with no robots meta', () => {
    expect(programmeHead('station-remodelling', false)).toEqual({
      canonicalPath: '/p/station-remodelling',
      noindex: false,
    })
  })

  it('keeps a tombstone at its URL and takes it out of the index', () => {
    expect(programmeHead('station-remodelling', true)).toEqual({
      canonicalPath: '/p/station-remodelling',
      noindex: true,
    })
  })
})

describe('revisionHead', () => {
  it('canonicalises the current revision to the bare route', () => {
    expect(revisionHead('slug', 23, { isCurrent: true, tombstoned: false })).toEqual({
      canonicalPath: '/p/slug',
      noindex: false,
    })
  })

  it('self-canonicalises a superseded revision — it is not a duplicate', () => {
    expect(revisionHead('slug', 7, { isCurrent: false, tombstoned: false })).toEqual({
      canonicalPath: '/p/slug/r/7',
      noindex: true,
    })
  })

  it('self-canonicalises a tombstoned revision even when it is the current one', () => {
    expect(revisionHead('slug', 23, { isCurrent: true, tombstoned: true })).toEqual({
      canonicalPath: '/p/slug/r/23',
      noindex: true,
    })
  })
})

describe('the two governing rules', () => {
  /** Every route class this page owns, paired with the URL it was emitted from. */
  const cases = [
    { from: programmePath('slug'), rules: programmeHead('slug', false) },
    { from: programmePath('slug'), rules: programmeHead('slug', true) },
    {
      from: '/p/slug/r/23',
      rules: revisionHead('slug', 23, { isCurrent: true, tombstoned: false }),
    },
    {
      from: '/p/slug/r/7',
      rules: revisionHead('slug', 7, { isCurrent: false, tombstoned: false }),
    },
    { from: '/p/slug/r/7', rules: revisionHead('slug', 7, { isCurrent: false, tombstoned: true }) },
  ]

  it('never emits a canonical pointing elsewhere together with a noindex', () => {
    for (const { from, rules } of cases) {
      const pointsElsewhere = rules.canonicalPath !== from
      expect(pointsElsewhere && rules.noindex).toBe(false)
    }
  })

  it('always emits a canonical, on every class', () => {
    for (const { rules } of cases) expect(rules.canonicalPath.startsWith('/p/')).toBe(true)
  })
})

describe('ogStrings — a fixed template over Postgres columns', () => {
  const facts = {
    title: 'Station remodelling — Stage 3',
    activityCount: 1751,
    sectorLabel: 'Rail',
    p6Version: '19.12',
    pctComplete: 41,
    handle: 'planner-a3f92c',
  }

  it('builds the published description', () => {
    expect(ogStrings(facts).description).toBe(
      '1,751 activities · Rail · P6 19.12 · 41% complete · uploaded by planner-a3f92c · CC-BY 4.0',
    )
  })

  it('renders a blank sector as Unsectored rather than omitting the slot', () => {
    expect(ogStrings({ ...facts, sectorLabel: null }).description).toContain('Unsectored')
  })

  it('renders zero progress as Not started', () => {
    expect(ogStrings({ ...facts, pctComplete: 0 }).description).toContain('Not started')
    expect(ogStrings({ ...facts, pctComplete: null }).description).toContain('Not started')
  })

  it('names the revision in the title on a revision URL only', () => {
    expect(ogStrings(facts).title).toBe('Station remodelling — Stage 3')
    expect(ogStrings({ ...facts, revNo: 7 }).title).toBe('Station remodelling — Stage 3 — rev 7')
  })

  it('has site defaults available for a tombstone', () => {
    expect(OG_DEFAULTS.title).toBe('xer-hero')
    expect(OG_DEFAULTS.description).toBe('Public Primavera P6 programmes. Browse, download, fork.')
  })
})
