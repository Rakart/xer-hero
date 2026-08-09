import { describe, expect, it } from 'vitest'
import { broken, clean, perf20k, tender } from './fixture'
import { bannerEntries, isPartiallyAnalysed, MISSING_WORD, noteEntries, readStat } from './states'

describe('readStat', () => {
  it('narrows an ok stat to its value', () => {
    const result = readStat(perf20k.logic.longest_path)
    expect('ok' in result && result.ok.state === 'ok').toBe(true)
  })

  it('narrows each missing state to its own reason', () => {
    const skipped = readStat(tender.logic.longest_path)
    expect('missing' in skipped && skipped.missing.state).toBe('skip')
    expect('missing' in skipped && skipped.missing.reason).toContain('no progress')

    const errored = readStat(broken.logic.longest_path)
    expect('missing' in errored && errored.missing.state).toBe('error')

    const unavailable = readStat<{ days: number }>({
      state: 'unavailable',
      reason: 'no CALENDAR table in the file',
    })
    expect('missing' in unavailable && unavailable.missing.state).toBe('unavailable')
  })
})

describe('MISSING_WORD', () => {
  it('gives each state a different phrase — skip is not fail and is not blank', () => {
    const words = new Set(Object.values(MISSING_WORD))
    expect(words.size).toBe(3)
    expect(MISSING_WORD.skip).not.toBe(MISSING_WORD.unavailable)
    expect(Object.values(MISSING_WORD).some((w) => w.toLowerCase().includes('fail'))).toBe(false)
  })
})

describe('bannerEntries — only error-state stats reach the banner (§3.10)', () => {
  it('stays empty for a programme whose only issue is info', () => {
    expect(bannerEntries(tender)).toEqual([])
    expect(isPartiallyAnalysed(tender)).toBe(false)
  })

  it('stays empty for a programme with no issues at all', () => {
    expect(bannerEntries(clean)).toEqual([])
    expect(bannerEntries(perf20k)).toEqual([])
  })

  it('lists both error stats once each, with their reasons', () => {
    const entries = bannerEntries(broken)
    expect(entries.map((e) => e.stat)).toEqual(['time.duration_working_days', 'logic.longest_path'])
    expect(entries[0]?.reason).toBe('clndr_data parse failed for clndr_id 42')
    expect(isPartiallyAnalysed(broken)).toBe(true)
  })

  it('does not promote a warn issue into the banner', () => {
    expect(bannerEntries(broken).some((e) => e.stat === 'shape.wbs_summary')).toBe(false)
  })
})

describe('noteEntries', () => {
  it('gives the non-banner issues a home rather than dropping them', () => {
    expect(noteEntries(tender).map((i) => i.severity)).toEqual(['info'])
    expect(noteEntries(broken).map((i) => i.stat)).toEqual(['shape.wbs_summary'])
    expect(noteEntries(clean)).toEqual([])
  })
})
