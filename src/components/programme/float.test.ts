import { describe, expect, it } from 'vitest'
import { broken, perf20k, tender } from './fixture'
import { bandOf, bandShare, bandTotals, bucketLabel, bucketsOf, nullFloatSentence } from './float'

describe('bucketLabel', () => {
  it('writes the open bounds as words', () => {
    expect(bucketLabel(null, -20)).toBe('under −20d')
    expect(bucketLabel(200, null)).toBe('over 200d')
  })

  it('writes a bucket spanning zero with "to" rather than a double dash', () => {
    expect(bucketLabel(-20, 0)).toBe('−20 to 0d')
    expect(bucketLabel(0, 5)).toBe('0–5d')
    expect(bucketLabel(44, 100)).toBe('44–100d')
  })
})

describe('bandOf — read off the edges, never off the index', () => {
  it('puts every non-positive bucket in the negative band', () => {
    expect(bandOf(null, -20)).toBe('negative')
    expect(bandOf(-20, 0)).toBe('negative')
  })

  it('puts the DCMA-8 threshold and above in the high band', () => {
    expect(bandOf(44, 100)).toBe('high')
    expect(bandOf(200, null)).toBe('high')
  })

  it('keeps the bucket that ends at 44 in the middle band', () => {
    expect(bandOf(20, 44)).toBe('ok')
    expect(bandOf(0, 5)).toBe('ok')
  })
})

describe('bucketsOf', () => {
  it('produces one row per count, with the contract nine', () => {
    const buckets = bucketsOf(perf20k.distributions.float_histogram)
    expect(buckets).toHaveLength(9)
    expect(buckets.map((b) => b.label)).toEqual([
      'under −20d',
      '−20 to 0d',
      '0–5d',
      '5–10d',
      '10–20d',
      '20–44d',
      '44–100d',
      '100–200d',
      'over 200d',
    ])
  })

  it('percentages are of the bucketed population, not of the activity count', () => {
    const buckets = bucketsOf(perf20k.distributions.float_histogram)
    const sum = buckets.reduce((total, b) => total + b.pct, 0)
    expect(sum).toBeCloseTo(100, 6)
    // 6,254 of 7,171 bucketed activities — not of 20,000, which would read 31%.
    expect(buckets[8]?.pct).toBeCloseTo(87.2, 1)
  })

  it('survives a histogram of zeros without dividing by zero', () => {
    const buckets = bucketsOf(broken.distributions.float_histogram)
    expect(buckets.every((b) => b.pct === 0)).toBe(true)
  })
})

describe('bandTotals', () => {
  it('reproduces the single-spike shape that made this a table', () => {
    const totals = bandTotals(perf20k.distributions.float_histogram)
    expect(totals).toEqual({ negative: 27, ok: 27, high: 7117, total: 7171 })
    expect(bandShare(totals, 'high')).toBe('99.2')
  })

  it('reproduces Fixture B', () => {
    const totals = bandTotals(tender.distributions.float_histogram)
    expect(totals.negative).toBe(0)
    expect(bandShare(totals, 'high')).toBe('75.7')
  })
})

describe('nullFloatSentence', () => {
  it('states verbatim that an empty float is not a zero float', () => {
    const sentence = nullFloatSentence(perf20k.distributions.float_histogram)
    expect(sentence).toContain('12,829 activities have no float at all')
    expect(sentence).toContain('an empty float is not a zero float')
  })

  it('stays off a programme with no null floats', () => {
    expect(nullFloatSentence(tender.distributions.float_histogram)).toBeNull()
  })
})
