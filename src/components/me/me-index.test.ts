import { describe, expect, it } from 'vitest'
import {
  type MeLineInput,
  meLineAction,
  meLineChip,
  meLineClause,
  meLineLinks,
  meLineState,
  shortAge,
} from './me-index'

describe('shortAge', () => {
  const now = new Date('2026-08-09T12:00:00Z')
  const ago = (ms: number) => new Date(now.getTime() - ms)

  it('fits the fixed slot at every scale', () => {
    expect(shortAge(ago(30_000), now)).toBe('now')
    expect(shortAge(ago(2 * 60_000), now)).toBe('2m')
    expect(shortAge(ago(3 * 3_600_000), now)).toBe('3h')
    expect(shortAge(ago(8 * 86_400_000), now)).toBe('8d')
    expect(shortAge(ago(95 * 86_400_000), now)).toBe('3mo')
    expect(shortAge(ago(800 * 86_400_000), now)).toBe('2y')
  })
})

const line = (over: Partial<MeLineInput> = {}): MeLineInput => ({
  programmeStatus: 'published',
  revisionStatus: 'published',
  removalClass: null,
  parentTombstoned: false,
  ...over,
})

describe('meLineState — the six states of §6.12', () => {
  it('reads an ordinary published programme', () => {
    expect(meLineState(line())).toBe('published')
  })

  it('reads a programme mid-ingest, including one with no revision row yet', () => {
    expect(meLineState(line({ revisionStatus: 'pending' }))).toBe('pending')
    expect(meLineState(line({ revisionStatus: null }))).toBe('pending')
  })

  it('reads a failed upload', () => {
    expect(meLineState(line({ revisionStatus: 'failed' }))).toBe('failed')
  })

  it('reads a Class A withdrawal as the owner’s own act', () => {
    expect(meLineState(line({ programmeStatus: 'tombstoned', removalClass: 'A' }))).toBe(
      'withdrawn',
    )
  })

  it('reads a complained-about Class B removal', () => {
    expect(meLineState(line({ programmeStatus: 'tombstoned', removalClass: 'B' }))).toBe('removed')
  })

  it('separates a cascaded fork, so a blameless owner is never rendered as accused', () => {
    expect(
      meLineState(
        line({ programmeStatus: 'tombstoned', removalClass: 'B', parentTombstoned: true }),
      ),
    ).toBe('cascaded')
  })
})

describe('the line’s slots', () => {
  it('draws no chip and no clause for the common case', () => {
    expect(meLineChip('published')).toBeNull()
    expect(meLineClause('published', null)).toBeNull()
  })

  it('renders failure_reason inline, verbatim', () => {
    expect(meLineClause('failed', 'The export contains no activities.')).toBe(
      'The export contains no activities.',
    )
  })

  it('offers `Upload again` on a failure and on nothing else', () => {
    expect(meLineAction('failed')).toEqual({ href: '/upload', label: 'Upload again →' })
    expect(meLineAction('pending')).toBeNull()
    expect(meLineAction('published')).toBeNull()
  })

  it('links the title only where /p/{slug} does not 404', () => {
    expect(meLineLinks('published')).toBe(true)
    expect(meLineLinks('withdrawn')).toBe(true)
    expect(meLineLinks('pending')).toBe(false)
    expect(meLineLinks('failed')).toBe(false)
  })

  it('names both Class B lines `Removed`, with different clauses', () => {
    expect(meLineChip('removed')).toBe('Removed')
    expect(meLineChip('cascaded')).toBe('Removed')
    expect(meLineClause('removed', null)).not.toBe(meLineClause('cascaded', null))
  })
})
