import { describe, expect, it } from 'vitest'
import { citation, isRoot, licenceLabel, TOMBSTONE_COPY, tombstoneKind } from './cite'

describe('citation', () => {
  const facts = {
    title: 'Station remodelling — Stage 3',
    handle: 'planner-a3f92c',
    revNo: 23,
    url: 'https://xerhero.com/p/station-remodelling/r/23',
    licence: 'CC-BY-4.0',
  }

  it('carries title, author, source and licence, and names the revision', () => {
    expect(citation(facts)).toBe(
      '"Station remodelling — Stage 3" (revision 23) by planner-a3f92c, from xer-hero — ' +
        'https://xerhero.com/p/station-remodelling/r/23 — licensed under CC BY 4.0 ' +
        '(https://creativecommons.org/licenses/by/4.0/).',
    )
  })

  it('passes an unexpected licence through rather than rewriting it', () => {
    expect(citation({ ...facts, licence: 'CC0-1.0' })).toContain('licensed under CC0-1.0')
  })
})

describe('licenceLabel', () => {
  it('reads the stored code as a byline', () => {
    expect(licenceLabel('CC-BY-4.0')).toBe('CC BY 4.0')
    expect(licenceLabel('CC0-1.0')).toBe('CC0-1.0')
  })
})

describe('tombstoneKind — the third line exists so a blameless owner is not rendered as accused', () => {
  it('attributes a Class A withdrawal to the uploader', () => {
    expect(tombstoneKind('A', false)).toBe('withdrawn')
    expect(tombstoneKind('A', true)).toBe('withdrawn')
    expect(tombstoneKind(null, false)).toBe('withdrawn')
  })

  it('separates the complained-about programme from the cascaded fork', () => {
    expect(tombstoneKind('B', false)).toBe('complaint')
    expect(tombstoneKind('B', true)).toBe('cascade')
  })
})

describe('TOMBSTONE_COPY', () => {
  it('names no case reference and no complainant anywhere', () => {
    for (const copy of Object.values(TOMBSTONE_COPY)) {
      expect(copy.line).not.toMatch(/case|reference|reported by|complainant/i)
    }
  })

  it('renders the three lines verbatim', () => {
    expect(TOMBSTONE_COPY.withdrawn.line).toBe('Withdrawn by uploader.')
    expect(TOMBSTONE_COPY.complaint.line).toBe(
      'Removed following a rights or personal-data complaint.',
    )
    expect(TOMBSTONE_COPY.cascade.line).toBe(
      'Removed because a programme it was forked from was removed following a complaint.',
    )
  })
})

describe('isRoot', () => {
  it('is a property of the parent pointer, not of the fork count', () => {
    expect(isRoot({ parentSlug: null })).toBe(true)
    expect(isRoot({ parentSlug: 'depot-resignalling' })).toBe(false)
  })
})
