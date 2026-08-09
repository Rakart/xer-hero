/**
 * Total float: a stat, not a chart (§3.8, §6.7).
 *
 * The contract's nine fixed buckets draw as **a single spike on every programme that
 * exists, and a different spike each time** — 99.2% over 44 days on the 20,000-activity
 * fixture, 75.7% over 44 days on Fixture B, 69% negative on Fixture A. The bucket a reader
 * most needs is negative, and on the first of those it is 27 activities beside 7,117: a
 * sub-pixel segment. So the page draws a **band bar** for the shape and prints a **nine-row
 * table** for the values. The histogram stays in `derived.json` unchanged, because fixed
 * edges are what make a revision diff a subtraction.
 *
 * Bands are derived from the edges rather than from bucket indices on purpose: a contract
 * bump that moved an edge would silently recolour a hardcoded index, and the band colours
 * are shared with the shelf's sliver.
 */

import type { Histogram } from '@/lib/contracts/derived'
import { formatCount, formatPct } from './format'

export type FloatBand = 'negative' | 'ok' | 'high'

export interface Bucket {
  index: number
  label: string
  count: number
  /** Share of the bucketed population — the nulls are excluded, see below. */
  pct: number
  band: FloatBand
}

/** A proper minus sign; a hyphen beside an en dash range reads as a typo. */
const MINUS = '−'

function edgeLabel(value: number): string {
  return value < 0 ? `${MINUS}${Math.abs(value)}` : String(value)
}

/**
 * `(null, -20]` → `under −20d`, `(200, null]` → `over 200d`, `(0, 5]` → `0–5d`.
 * A bucket spanning zero is written with the word `to`, because `−20–0d` is unreadable.
 */
export function bucketLabel(lower: number | null, upper: number | null): string {
  if (lower === null && upper === null) return 'all'
  if (lower === null) return `under ${edgeLabel(upper as number)}d`
  if (upper === null) return `over ${edgeLabel(lower)}d`
  if (lower < 0 || upper <= 0) return `${edgeLabel(lower)} to ${edgeLabel(upper)}d`
  return `${edgeLabel(lower)}–${edgeLabel(upper)}d`
}

/**
 * The three bands the shelf's sliver already uses, read off the bucket's own edges.
 * `>44 days` is DCMA 8's threshold; negative float is DCMA 7's.
 */
export function bandOf(lower: number | null, upper: number | null): FloatBand {
  if (upper !== null && upper <= 0) return 'negative'
  if (lower !== null && lower >= 44) return 'high'
  return 'ok'
}

export function bucketsOf(histogram: Histogram): Bucket[] {
  const total = histogram.counts.reduce((sum, n) => sum + n, 0)
  return histogram.counts.map((count, index) => {
    const lower = histogram.edges[index] ?? null
    const upper = histogram.edges[index + 1] ?? null
    return {
      index,
      label: bucketLabel(lower, upper),
      count,
      pct: total > 0 ? (count / total) * 100 : 0,
      band: bandOf(lower, upper),
    }
  })
}

export interface BandTotals {
  negative: number
  ok: number
  high: number
  /** The bucketed population. **Not** the activity count — see `null_count`. */
  total: number
}

export function bandTotals(histogram: Histogram): BandTotals {
  const totals: BandTotals = { negative: 0, ok: 0, high: 0, total: 0 }
  for (const bucket of bucketsOf(histogram)) {
    totals[bucket.band] += bucket.count
    totals.total += bucket.count
  }
  return totals
}

export const BAND_LABEL: Record<FloatBand, string> = {
  negative: 'negative — behind',
  ok: '0–44 days',
  high: 'over 44 days',
}

/**
 * The null-float callout, verbatim from §6.7.
 *
 * It is not a footnote. An empty float is not a zero float: on the 20,000-activity fixture
 * 12,829 activities carry none because they are complete and P6 stopped calculating, and
 * coercing them to zero would report 12,829 spurious critical activities. Returning null
 * where there are none keeps the callout off programmes it would only puzzle.
 */
export function nullFloatSentence(histogram: Histogram): string | null {
  const nulls = histogram.null_count ?? 0
  if (nulls <= 0) return null
  return (
    `${formatCount(nulls)} activities have no float at all — they are complete, so P6 ` +
    `stopped calculating it. They are excluded from the histogram and from every float ` +
    `check; an empty float is not a zero float.`
  )
}

/** `69.0%` of the bucketed population, for the band key beside the bar. */
export function bandShare(totals: BandTotals, band: FloatBand): string {
  if (totals.total === 0) return formatPct(0)
  return formatPct((totals[band] / totals.total) * 100)
}
