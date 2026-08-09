/**
 * The arithmetic behind the hand-rolled SVG (§4.1, §6.7).
 *
 * There is no charting library and that is a stack decision rather than a preference: any
 * chart whose data is known at request time renders as **server-generated SVG**, and a
 * runtime library enters only when interaction is the requirement. Every chart on this page
 * also needed behaviour a library would have fought — a data-date rule, a threshold mark,
 * fixed contract buckets, and a form switch from chart to table.
 *
 * The geometry lives here rather than inside the components so it can be tested without a
 * renderer, and so the S-curve's data-date rule — the one piece of arithmetic on the page
 * that can silently land in the wrong place — has a test of its own.
 */

import { parseNaiveDate, parseNaiveMonth } from './format'

export interface Scale {
  /** The axis top: a round number at or above the data's maximum, never the maximum. */
  top: number
  ticks: number[]
}

/**
 * Ticks land on round numbers. An axis topping out at the series maximum reads as though
 * the data were designed to fill the box.
 */
export function niceScale(max: number, want = 4): Scale {
  const raw = Math.max(1, max) / Math.max(1, want)
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 2.5, 5, 10].find((s) => s * magnitude >= raw) ?? 10) * magnitude
  const top = Math.ceil(Math.max(1, max) / step) * step
  const ticks: number[] = []
  for (let value = 0; value <= top + 1e-9; value += step) ticks.push(Math.round(value))
  return { top: top || 1, ticks }
}

/** `20000` → `20k`. Axis labels only; the tables print the exact number. */
export function axisLabel(value: number): string {
  if (value < 1000) return String(value)
  const thousands = Math.round(value / 100) / 10
  return `${String(thousands).replace(/\.0$/, '')}k`
}

/** `M0,10L1,9…` over a series, with the caller's scales. */
export function linePath(
  values: readonly number[],
  x: (index: number) => number,
  y: (value: number) => number,
): string {
  return values
    .map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`)
    .join('')
}

/**
 * Where the data-date rule falls on a monthly S-curve, as a **fractional** bucket index.
 *
 * Fractional because a rule snapped to a month boundary would sit up to fifteen days from
 * the date it claims to mark, and the elapsed-versus-remaining weighting either side of it
 * is the only thing on the chart that says which part of the curve has happened.
 *
 * Returns null where either the data date or the curve's origin is absent — a tender
 * programme has no data date at all, and drawing the rule at zero would assert that
 * everything is remaining as of the start, which is a different claim.
 */
export function dataDateIndex(from: string | null, dataDate: string | null): number | null {
  const origin = parseNaiveMonth(from)
  const date = parseNaiveDate(dataDate)
  if (!origin || !date) return null
  const months = (date.year - origin.year) * 12 + (date.month - origin.month)
  return months + (date.day - 1) / 30
}

export interface MonthTick {
  index: number
  label: string
}

/**
 * January of each year, which is what a 40-bucket monthly axis can carry without
 * overprinting. On a curve shorter than two years the first bucket is labelled too, so a
 * six-month tender is not left with a bare axis.
 */
export function yearTicks(from: string | null, bucketCount: number): MonthTick[] {
  const origin = parseNaiveMonth(from)
  if (!origin || bucketCount <= 0) return []
  const ticks: MonthTick[] = []
  for (let index = 0; index < bucketCount; index += 1) {
    const monthIndex0 = origin.month - 1 + index
    const month = ((monthIndex0 % 12) + 12) % 12
    if (month === 0)
      ticks.push({ index, label: String(origin.year + Math.floor(monthIndex0 / 12)) })
  }
  if (ticks.length === 0) ticks.push({ index: 0, label: String(origin.year) })
  return ticks
}

/**
 * A column's geometry inside a histogram band: capped at 24px wide, with the 2px gap
 * between fills that keeps two adjacent bars from reading as one.
 */
export function columnGeometry(
  bandWidth: number,
  maxWidth = 24,
  gap = 4,
): { width: number; offset: number } {
  const width = Math.max(1, Math.min(maxWidth, bandWidth - gap))
  return { width, offset: (bandWidth - width) / 2 }
}

/**
 * A rounded-cap column as a path: square feet, 4px radius at the top, so a one-pixel column
 * and a full-height one are the same mark. `radius` collapses on a short bar rather than
 * inverting it.
 */
export function columnPath(x: number, top: number, width: number, height: number): string {
  const radius = Math.max(0, Math.min(4, height))
  const bottom = top + height
  return (
    `M${x.toFixed(1)},${bottom.toFixed(1)} ` +
    `L${x.toFixed(1)},${(top + radius).toFixed(1)} ` +
    `Q${x.toFixed(1)},${top.toFixed(1)} ${(x + radius).toFixed(1)},${top.toFixed(1)} ` +
    `L${(x + width - radius).toFixed(1)},${top.toFixed(1)} ` +
    `Q${(x + width).toFixed(1)},${top.toFixed(1)} ${(x + width).toFixed(1)},${(top + radius).toFixed(1)} ` +
    `L${(x + width).toFixed(1)},${bottom.toFixed(1)} Z`
  )
}

/** A percentage clamped to the track it is drawn on. A 150% meter is a bug, not a mark. */
export function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

/**
 * The finish-to-start share DCMA 4 is about, computed once and shared by the meter and the
 * Relationships tile so the page cannot print two different numbers for it.
 */
export function finishToStartPct(
  mix: Record<string, number>,
  relationshipCount: number,
): number | null {
  if (!relationshipCount) return null
  const fs = mix.PR_FS ?? 0
  return (fs / relationshipCount) * 100
}
