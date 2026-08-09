/**
 * The `card` JSONB payload — the browse row's whole graphic budget (§6.2).
 *
 * The load-bearing constraint of the hybrid-ingest bet is that **the shelf reads zero
 * blobs**: a 25-row page is one Postgres query, and every sliver, curve and badge on a row
 * comes out of this ~200-byte object. Nothing here may grow with activity count.
 *
 * Because these are card fields rather than `derived.json` fields, a version bump that
 * changes them needs an **explicit backfill** — the grid reads them for programmes nobody
 * ever opens, so lazy recompute would leave them permanently stale (§3.13).
 */

import { CARD_S_CURVE_POINTS, type CardPayload } from '../contracts/card'
import type { SCurve } from '../contracts/derived'
import type { ActivityRow } from './activities'
import { floatMix, type HoursPerDay, highThresholdHours } from './float'

/**
 * The window curve at 16 points, normalised 0→1.
 *
 * Normalised rather than stored as absolute counts so it renders without knowing the
 * activity count and stays comparable between revisions — the row's axis is **local**, never
 * a shared calendar axis, because a 14-month job smears to ~6% of a 17-year one and vintage
 * is not a browsing signal.
 *
 * Resampled from the monthly cumulative finishes by position on the *time* axis, so the
 * shape a reader compares is the shape of the programme rather than the shape of however
 * many months it happens to occupy. Three decimal places: the sliver is 262 px wide and no
 * viewer can resolve a fourth.
 */
export function cardSCurve(curve: SCurve): number[] {
  const points = new Array<number>(CARD_S_CURVE_POINTS).fill(0)
  const cumulative = curve.cumulative
  const total = cumulative[cumulative.length - 1] ?? 0
  if (cumulative.length === 0 || total <= 0) return points
  for (let i = 0; i < CARD_S_CURVE_POINTS; i++) {
    const t = i / (CARD_S_CURVE_POINTS - 1)
    const index = Math.round(t * (cumulative.length - 1))
    points[i] = Math.round(((cumulative[index] ?? 0) / total) * 1000) / 1000
  }
  return points
}

export interface CardInput {
  readonly activities: readonly ActivityRow[]
  readonly sCurve: SCurve
  readonly hoursPerDay: HoursPerDay
  /** A depth of 1 is a correct answer, not an error — it renders the `no WBS` badge. */
  readonly wbsDepth: number
  /** Above 0 renders the `⚠ partial` badge. */
  readonly issuesCount: number
}

export function buildCard(input: CardInput): CardPayload {
  return {
    s_curve: cardSCurve(input.sCurve),
    // The same three bands DCMA 6 and 7 and the float histogram read, from one module, so
    // the row's sliver and the detail page's scorecard cannot describe two programmes.
    float_mix: floatMix(
      input.activities.map((row) => row.total_float_hr_cnt),
      highThresholdHours(input.hoursPerDay),
    ),
    wbs_depth: input.wbsDepth,
    issues_count: input.issuesCount,
  }
}
