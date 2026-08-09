import { describe, expect, it } from 'vitest'
import { mergePressed, parseProgrammeIds, VIEWER_MAX_IDS } from './viewer-state'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

describe('parseProgrammeIds', () => {
  it('reads a comma list and drops anything that is not a uuid', () => {
    expect(parseProgrammeIds(`${id(1)},nonsense,${id(2)}`)).toEqual([id(1), id(2)])
  })

  it('deduplicates and lowercases', () => {
    expect(parseProgrammeIds(`${id(1).toUpperCase()},${id(1)}`)).toEqual([id(1)])
  })

  it('caps at the shelf page size', () => {
    const many = Array.from({ length: 40 }, (_, n) => id(n)).join(',')
    expect(parseProgrammeIds(many)).toHaveLength(VIEWER_MAX_IDS)
  })

  it('answers an absent parameter with no ids', () => {
    expect(parseProgrammeIds(null)).toEqual([])
    expect(parseProgrammeIds('')).toEqual([])
  })
})

describe('mergePressed — the late-pressed rule (§6.13 rule 4)', () => {
  it('fills untouched controls from the snapshot', () => {
    const merged = mergePressed([id(1)], new Map(), [id(1), id(2)])
    expect(merged.get(id(1))).toBe(true)
    expect(merged.get(id(2))).toBe(false)
  })

  it('never overwrites a control the viewer touched before the response landed', () => {
    // The viewer pressed id(2) after paint; the snapshot predates the click and says unset.
    const merged = mergePressed([id(1)], new Map([[id(2), true]]), [id(1), id(2)])
    expect(merged.get(id(2))).toBe(true)
  })

  it('keeps a late un-press too — the same rule in the other direction', () => {
    const merged = mergePressed([id(1)], new Map([[id(1), false]]), [id(1)])
    expect(merged.get(id(1))).toBe(false)
  })

  it('reports only the ids it was asked about', () => {
    const merged = mergePressed([id(9)], new Map(), [id(1)])
    expect([...merged.keys()]).toEqual([id(1)])
  })
})
