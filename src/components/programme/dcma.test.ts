import { describe, expect, it } from 'vitest'
import type { DcmaCheck } from '@/lib/contracts/derived'
import {
  activityFilterFor,
  checkCount,
  checkPopulation,
  checkValue,
  marginSentence,
  parseThreshold,
  ratioSentence,
  stateMark,
  stateWord,
  stripCells,
  verdictSentence,
} from './dcma'
import { broken, clean, perf20k, tender } from './fixture'

const find = (checks: DcmaCheck[], num: number): DcmaCheck => {
  const check = checks.find((c) => c.num === num)
  if (!check) throw new Error(`no check ${num}`)
  return check
}

describe('parseThreshold', () => {
  it('reads the three shapes DCMA 1–10 write', () => {
    expect(parseThreshold('<=5%')).toEqual({ kind: 'max', limit: 5 })
    expect(parseThreshold('>=90%')).toEqual({ kind: 'min', limit: 90 })
    expect(parseThreshold('0')).toEqual({ kind: 'zero' })
    expect(parseThreshold('≤5%')).toEqual({ kind: 'max', limit: 5 })
  })

  it('returns null rather than guessing at an unknown shape', () => {
    expect(parseThreshold(undefined)).toBeNull()
    expect(parseThreshold('as agreed')).toBeNull()
  })
})

describe('the row never renders as a naked verdict', () => {
  it('carries mark, word, value and threshold for a fail', () => {
    const leads = find(perf20k.quality.checks, 2)
    expect(stateMark(leads.state)).toBe('✗')
    expect(stateWord(leads.state)).toBe('FAIL')
    expect(checkValue(leads)).toBe('2.1%')
    expect(leads.threshold).toBe('0')
  })

  it('renders skip as its own thing, not as fail', () => {
    const missed = find(perf20k.quality.checks, 11)
    expect(stateMark(missed.state)).toBe('–')
    expect(stateWord(missed.state)).toBe('NOT APPLICABLE')
    expect(checkValue(missed)).toBe('—')
    expect(marginSentence(missed)).toBeNull()
    expect(missed.reason).toBeTruthy()
  })

  it('adds check 1 halves into its count', () => {
    expect(checkCount(find(perf20k.quality.checks, 1))).toBe(688 + 1297)
    expect(checkCount(find(perf20k.quality.checks, 4))).toBeUndefined()
  })

  it('names the population each percentage is out of', () => {
    const counts = { activities: 20_000, relationships: 34_000 }
    expect(checkPopulation('high_float', counts)).toEqual({ size: 20_000, unit: 'activities' })
    expect(checkPopulation('leads', counts)).toEqual({ size: 34_000, unit: 'relationships' })
    expect(checkPopulation('cpli', counts)).toBeNull()
  })
})

describe('marginSentence', () => {
  it('makes half a percentage point legible on the check that misses by it', () => {
    // Fixture B's check 4: 89.5% against a 90% floor.
    expect(marginSentence(find(tender.quality.checks, 4))).toBe('0.5 points short of the 90% floor')
  })

  it('distinguishes a near miss from a fifteenfold breach', () => {
    expect(marginSentence(find(tender.quality.checks, 6))).toBe('15.1× the 5% limit')
    expect(marginSentence(find(perf20k.quality.checks, 3))).toBe('0.8 points under the 5% limit')
  })

  it('says what a zero threshold means in words', () => {
    expect(marginSentence(find(perf20k.quality.checks, 7))).toBe(
      '27 where the standard allows none',
    )
    expect(marginSentence(find(perf20k.quality.checks, 9))).toBe(
      'none, which is what the standard allows',
    )
  })

  it('reads a min-threshold pass as a margin over the floor', () => {
    expect(marginSentence(find(perf20k.quality.checks, 4))).toBe('2.0 points over the 90% floor')
  })
})

describe('verdictSentence', () => {
  it('names the failing checks and their values', () => {
    expect(verdictSentence(perf20k.quality)).toBe(
      'This programme fails 4 of the 10 checks that apply to it: leads at 2.1%, ' +
        'high float at 35.6%, negative float at 0.1%, high duration at 5.8%.',
    )
  })

  it('reports a clean run without celebrating it', () => {
    const sentence = verdictSentence(clean.quality)
    expect(sentence).toBe('This programme passes all 10 of the checks that apply to it.')
    expect(sentence).not.toMatch(/good|excellent|high quality|best/i)
  })

  it('does not invent a ratio when nothing applies', () => {
    expect(verdictSentence(broken.quality)).toContain('no ratio to report')
  })
})

describe('ratioSentence', () => {
  it('states that skipped checks leave both sides of the ratio', () => {
    expect(ratioSentence(perf20k.quality)).toContain('excluded from both sides of the ratio')
    expect(ratioSentence({ ...perf20k.quality, skipped: 0 })).toContain('out of 14')
  })
})

describe('activityFilterFor', () => {
  it('offers the table deep link only where the payload can express the predicate', () => {
    expect(activityFilterFor('high_float')).toBe('high_float')
    expect(activityFilterFor('negative_float')).toBe('negative_float')
    expect(activityFilterFor('high_duration')).toBe('high_duration')
  })

  it('refuses it for relationship-level checks, whose table is not in the cut', () => {
    expect(activityFilterFor('leads')).toBeNull()
    expect(activityFilterFor('lags')).toBeNull()
    expect(activityFilterFor('relationship_types')).toBeNull()
    expect(activityFilterFor('resources')).toBeNull()
  })
})

describe('stripCells', () => {
  it('always has fourteen cells, in check order', () => {
    const cells = stripCells(perf20k.quality)
    expect(cells).toHaveLength(14)
    expect(cells[0]).toBe('pass')
    expect(cells[1]).toBe('fail')
    expect(cells[13]).toBe('skip')
  })

  it('fills a missing check as skip rather than as a pass', () => {
    expect(stripCells({ ...perf20k.quality, checks: [] })).toEqual(Array(14).fill('skip'))
  })
})
