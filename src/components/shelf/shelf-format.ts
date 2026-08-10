/**
 * Everything the row prints or draws, as pure functions (§6.2).
 *
 * The row's rule is that **nothing in it may flow**: the same fact lands at the same x on
 * every row, and only two variable-length strings survive. That makes every slot a fixed
 * geometry computed from a number, which is what this file is — the row component places
 * boxes, and these decide what goes in them.
 *
 * Nothing here reads a blob. The curve, the float band, the activity track and the DCMA
 * strip are all computed from the `card` JSONB column and four typed columns, because the
 * shelf reads zero blobs and a 25-row page is one Postgres query (§6.4).
 */

import type { CardPayload } from '@/lib/contracts/card'
import { CARD_S_CURVE_POINTS } from '@/lib/contracts/card'
import { dayNumber } from '@/lib/derive/dates'

/**
 * `1,751`. Written out rather than taken from `Intl`, because a grid of counts must not
 * change shape with the server's locale data and this is the only grouping rule the site
 * has.
 */
export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** `41%`. `pct_complete` is `numeric(5,2)`; the slot prints whole percent. */
export function formatPercent(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return '—'
  return `${Math.round(pct)}%`
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/**
 * `Mar 24` — the window captions, as month-year.
 *
 * Parsed by string rather than through a `Date`: these columns are naive local wall-clock
 * as P6 wrote them, held in `date` string mode precisely so they are never round-tripped
 * through a JS `Date` and shifted by the server's zone (§3.4).
 */
export function formatMonthYear(date: string | null | undefined): string {
  if (!date) return '—'
  const m = /^(\d{4})-(\d{2})/.exec(date.trim())
  if (!m) return '—'
  const month = MONTHS[Number(m[2]) - 1]
  return month ? `${month} ${m[1]?.slice(2)}` : '—'
}

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/**
 * `March 2024` — the contributor page's joined date, which is a fact about an account
 * rather than about a programme, so it prints in full rather than in the row's shorthand.
 */
export function formatJoined(at: Date | string | null | undefined): string {
  if (!at) return '—'
  const iso = at instanceof Date ? at.toISOString() : String(at)
  const m = /^(\d{4})-(\d{2})/.exec(iso)
  const month = m ? MONTHS_LONG[Number(m[2]) - 1] : undefined
  return month && m ? `${month} ${m[1]}` : '—'
}

/**
 * `3mo` in 52px, right-aligned. Coarse on purpose: the slot answers *how old is this*, and
 * a shelf ordered newest-first already answers *which is older* by position.
 *
 * Accepts a string as well as a `Date` because the shelf's two queries are wrapped in
 * `unstable_cache` (§6.4) and a cached row comes back JSON-serialised.
 */
export function formatAge(uploadedAt: Date | string | null | undefined, now = new Date()): string {
  if (!uploadedAt) return '—'
  const then = uploadedAt instanceof Date ? uploadedAt : new Date(uploadedAt)
  const ms = now.getTime() - then.getTime()
  if (!Number.isFinite(ms)) return '—'
  const hours = Math.floor(ms / 3_600_000)
  if (hours < 1) return 'new'
  if (hours < 48) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 60) return `${days}d`
  const months = Math.floor(days / 30)
  if (months < 24) return `${months}mo`
  return `${Math.floor(days / 365)}y`
}

// --- slot 1: the float band -------------------------------------------------

/**
 * The three fills, in the order the sliver draws them (§6.2).
 *
 * Light-mode amber measures **2.11:1** against the surface, below the 3:1 floor, so the
 * printed percentages under the sliver are what make the band legible and **may not be
 * dropped for density**. Colour is never the only channel anywhere on this row.
 */
export const FLOAT_BANDS = [
  { key: 'neg', label: '<0d', fill: 'var(--neg)' },
  { key: 'ok', label: '0–44d', fill: 'var(--series)' },
  { key: 'high', label: '>44d', fill: 'var(--slack)' },
] as const

export type FloatBandKey = (typeof FLOAT_BANDS)[number]['key']

export interface FloatSegment {
  key: FloatBandKey
  label: string
  fill: string
  /** Percent, 0–100, as stored. */
  pct: number
  /** Fraction of the sliver's width, 0–1, normalised against the three together. */
  fraction: number
}

/**
 * The sliver's three segments. The percentages are stored summing to 100, but a row is
 * drawn from whatever the card holds, so the fractions are normalised rather than trusted.
 */
export function floatSegments(mix: CardPayload['float_mix'] | null | undefined): FloatSegment[] {
  const pcts = {
    neg: clampPct(mix?.neg),
    ok: clampPct(mix?.ok),
    high: clampPct(mix?.high),
  }
  const total = pcts.neg + pcts.ok + pcts.high
  return FLOAT_BANDS.map((band) => ({
    key: band.key,
    label: band.label,
    fill: band.fill,
    pct: pcts[band.key],
    fraction: total > 0 ? pcts[band.key] / total : 0,
  }))
}

function clampPct(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

// --- slot 5: the upvote magnitude bar ---------------------------------------

/**
 * Votes that fill the bar. Fixed rather than taken from the page's maximum: a bar scaled to
 * whatever happens to be on this page would mean something different on page 2, and the
 * column is there to be compared down *and* across pages.
 */
export const VOTE_BAR_FULL_SCALE = 400

/**
 * √-scaled, 0–1. The square root is what makes the bar readable at the bottom of a
 * long-tailed distribution: at launch nearly every programme carries 0 or 1 vote — a self
 * vote is permitted and reorders nothing — and a linear bar would draw all of them as
 * nothing at all.
 */
export function voteMagnitude(votes: number | null | undefined): number {
  if (!votes || votes <= 0) return 0
  return Math.min(1, Math.sqrt(votes) / Math.sqrt(VOTE_BAR_FULL_SCALE))
}

// --- slot 8: the activity track ---------------------------------------------

/** One slot per 1,000 activities, and the track is always ten slots wide. */
export const ACTIVITY_TRACK_SLOTS = 10
export const ACTIVITY_SLOT_SIZE = 1000

export interface ActivityTrack {
  filled: number
  /** Over 10,000: the track saturates, its fill darkens and the count prints a `+`. */
  saturated: boolean
  label: string
}

/**
 * **Empty slots stay drawn.** Free-floating blocks of 1,000 render a 310-activity
 * programme as a blank cell, and a blank cell reads as missing data rather than "small" —
 * so the track is ten boxes whatever the count, and any programme with activities in it
 * fills at least one.
 */
export function activityTrack(count: number | null | undefined): ActivityTrack {
  if (count === null || count === undefined || !Number.isFinite(count)) {
    return { filled: 0, saturated: false, label: '—' }
  }
  const n = Math.max(0, Math.trunc(count))
  const saturated = n > ACTIVITY_TRACK_SLOTS * ACTIVITY_SLOT_SIZE
  return {
    filled: Math.min(ACTIVITY_TRACK_SLOTS, Math.ceil(n / ACTIVITY_SLOT_SIZE)),
    saturated,
    // The `+` marks a saturated track, not an approximate count: the exact number is
    // printed in front of it and is what `sort=size` orders on.
    label: saturated ? `${formatCount(n)}+` : formatCount(n),
  }
}

// --- slot 9: the window curve -----------------------------------------------

export interface WindowGeometry {
  /** The 16 card points as `x y` pairs in the given box, or `null` when there is no curve. */
  points: { x: number; y: number }[] | null
  /** The data date as a fraction of the window, 0–1, or `null` when a date is missing. */
  elapsed: number | null
}

/**
 * The curve on a **local axis**, normalised to its own column.
 *
 * A shared calendar axis is rejected: vintage is not a browsing signal and a 14-month job
 * smears to ~6% of a 17-year axis. The absolute dates print as text at the ends and the
 * reader compares *shape*.
 *
 * One line, never two. Planned-versus-actual needs baseline tables no v1 file carries — the
 * same absence that skips DCMA 11, 13 and 14 — so progress is a marker on one curve.
 */
export function windowGeometry(
  card: CardPayload | null | undefined,
  dates: { start: string | null; finish: string | null; data: string | null },
  box: { width: number; height: number },
): WindowGeometry {
  const curve = card?.s_curve
  const points =
    Array.isArray(curve) && curve.length >= 2
      ? curve.map((value, index) => ({
          x: (index / (curve.length - 1)) * box.width,
          y: box.height - Math.max(0, Math.min(1, value)) * box.height,
        }))
      : null

  return { points, elapsed: elapsedFraction(dates) }
}

/**
 * Where the data-date rule stands, as a fraction of the window.
 *
 * Day arithmetic through `dayNumber`, which reads the naive `YYYY-MM-DD` by string: the
 * fraction is a ratio of two day counts and never becomes an instant, so no zone is
 * involved at any point.
 */
export function elapsedFraction(dates: {
  start: string | null
  finish: string | null
  data: string | null
}): number | null {
  const start = dayNumber(dates.start)
  const finish = dayNumber(dates.finish)
  const data = dayNumber(dates.data)
  if (start === null || finish === null || data === null) return null
  const span = finish - start
  if (span <= 0) return null
  return Math.max(0, Math.min(1, (data - start) / span))
}

/** The card holds 16 points; a card written by an older contract may not. */
export function hasFullCurve(card: CardPayload | null | undefined): boolean {
  return Array.isArray(card?.s_curve) && card.s_curve.length === CARD_S_CURVE_POINTS
}

// --- slot 11: the DCMA strip ------------------------------------------------

/** The full check set. Applicable runs 10 without a baseline to 14 with (§6.3). */
export const DCMA_CHECK_COUNT = 14

export type DcmaCell = 'pass' | 'fail' | 'skip'

/**
 * Fourteen cells, and the printed ratio that always rides beside them.
 *
 * Pass-green ↔ fail-red is ΔE 4.1 under deuteranopia — an all-pairs FAIL — so colour is
 * never the only channel: a pass is filled, a fail is an outline, a skip is a dashed
 * outline, and the denominator is printed. A 10-check programme is then never mistaken for
 * a failing 14-check one.
 */
export function dcmaCells(
  passed: number | null | undefined,
  applicable: number | null | undefined,
): DcmaCell[] {
  // An unscored revision still draws fourteen cells, all `skip`. The row's governing rule is
  // that **empty slots stay drawn** (§6.2): a blank cell reads as missing data, and here the
  // data genuinely is missing, which is what a full row of dashes says. Returning `[]` would
  // collapse the slot and make an unscored programme look like a narrower row.
  if (passed === null || passed === undefined || !applicable) {
    return Array.from({ length: DCMA_CHECK_COUNT }, () => 'skip' as const)
  }
  const applied = Math.max(0, Math.min(DCMA_CHECK_COUNT, Math.trunc(applicable)))
  const ok = Math.max(0, Math.min(applied, Math.trunc(passed)))
  return Array.from({ length: DCMA_CHECK_COUNT }, (_, index) => {
    if (index >= applied) return 'skip'
    return index < ok ? 'pass' : 'fail'
  })
}

/** `6/10` — the printed ratio, never a percentage and never a word. */
export function dcmaRatio(
  passed: number | null | undefined,
  applicable: number | null | undefined,
): string {
  if (passed === null || passed === undefined || !applicable) return '—'
  return `${Math.trunc(passed)}/${Math.trunc(applicable)}`
}

// --- slot 2: the badges -----------------------------------------------------

export interface RowBadge {
  label: string
  title: string
}

/**
 * The two badges the row carries, and there are no others.
 *
 * **Baseline is cut from the shelf entirely** — no `is_baseline` badge, no "baseline · not
 * started" caption; an unprogressed tender simply reads `0%`. And there is no badge of any
 * other kind anywhere on this site: a badge is a guarantee wearing a different word.
 */
export function rowBadges(card: CardPayload | null | undefined): RowBadge[] {
  const badges: RowBadge[] = []
  if ((card?.issues_count ?? 0) > 0) {
    badges.push({
      label: '⚠ partial',
      title: `${card?.issues_count} thing${card?.issues_count === 1 ? '' : 's'} in this file could not be read`,
    })
  }
  if (card?.wbs_depth === 1) {
    badges.push({ label: 'no WBS', title: 'One WBS node: the programme is a flat list' })
  }
  return badges
}
