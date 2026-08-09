/**
 * The `card` JSONB column — the row payload (§6.2).
 *
 * The load-bearing constraint of the whole hybrid-ingest bet: **the shelf reads zero blobs.**
 * A 25-row page is one Postgres query. Every graphic on a row comes out of this object, and
 * it is about 200 bytes.
 *
 * Because these are card fields rather than `derived.json` fields, a version bump that
 * changes them requires an **explicit backfill job** — the grid reads them for programmes
 * nobody ever opens, so lazy recompute would leave them permanently stale (§3.13).
 */

export interface CardPayload {
  /**
   * The window curve, normalised 0→1 over 16 points. Normalised rather than stored as
   * absolute counts so it renders without knowing the activity count and stays comparable
   * between revisions — the row's axis is **local**, never a shared calendar axis, because a
   * 14-month job smears to ~6% of a 17-year one and vintage is not a browsing signal.
   */
  s_curve: number[]

  /**
   * Percentages summing to 100. These print as three fixed numeric slots under the sliver and
   * **may not be dropped for density**: light-mode amber measures 2.11:1 against the surface,
   * below the 3:1 floor, so the numbers are what make the band legible.
   */
  float_mix: { neg: number; ok: number; high: number }

  /** Renders the `no WBS` badge at 1. A depth of 1 is a correct answer, not an error. */
  wbs_depth: number

  /** Renders the `⚠ partial` badge above 0. */
  issues_count: number
}

export const CARD_S_CURVE_POINTS = 16
