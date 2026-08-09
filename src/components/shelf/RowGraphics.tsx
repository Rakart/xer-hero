/**
 * The five graphics on a shelf row, as hand-rolled inline SVG in server components.
 *
 * No charting library and no new dependency: every one of these is a handful of rects and
 * one polyline, they render on the server into the cached HTML, and a library would put
 * kilobytes of client JavaScript on the one page whose whole design argument is that a
 * 25-row page costs one Postgres query and no blob reads (§6.4).
 *
 * Two rules run through all of them:
 *
 * - **Nothing may flow.** Every box below is a fixed pixel size matching its slot in
 *   §6.2's table, so the same fact lands at the same x on every row and the eye can compare
 *   down a column. That is also why each `viewBox` is in real pixels rather than in
 *   percentages — no scaling, no half-pixel edges.
 * - **Colour is never the only channel.** The float band prints its three percentages, the
 *   DCMA strip prints its ratio and separates pass from fail by fill-versus-outline, and
 *   the activity track separates present from absent by position in a track that is always
 *   drawn.
 *
 * No element here carries a generated `id`: 25 rows share one document, and a `clipPath`
 * or gradient id would either collide or need a hook that server components do not have.
 * The elapsed portion of the window curve is built as its own path instead.
 */

import styles from './ShelfRow.module.css'
import {
  ACTIVITY_TRACK_SLOTS,
  type ActivityTrack,
  DCMA_CHECK_COUNT,
  type DcmaCell,
  type FloatSegment,
} from './shelf-format'

/** The drawn band on every row, and the caption line under it. */
export const ROW_BAND = 30
export const ROW_CAPTION = 14

// --- slot 1: the float distribution sliver ----------------------------------

const FLOAT_W = 128

/**
 * 30px of sliver over three fixed numeric slots (the numbers are the row's job, not this
 * one's). The fills are `#d03b3b` negative, `#2a78d6` 0–44 days, `#eda100` over 44 —
 * carried as the palette's `--neg`, `--series` and `--slack`.
 */
export function FloatSliver({ segments }: { segments: FloatSegment[] }) {
  const total = segments.reduce((n, segment) => n + segment.fraction, 0)
  if (total <= 0) {
    return (
      <svg className={styles.svg} width={FLOAT_W} height={ROW_BAND} aria-hidden="true">
        <rect
          x={0.5}
          y={0.5}
          width={FLOAT_W - 1}
          height={ROW_BAND - 1}
          fill="none"
          stroke="var(--grid)"
        />
      </svg>
    )
  }

  let x = 0
  return (
    <svg className={styles.svg} width={FLOAT_W} height={ROW_BAND} aria-hidden="true">
      {segments.map((segment) => {
        const width = segment.fraction * FLOAT_W
        const rect = (
          <rect key={segment.key} x={x} y={0} width={width} height={ROW_BAND} fill={segment.fill} />
        )
        x += width
        return rect
      })}
    </svg>
  )
}

// --- slot 5: the upvote magnitude bar ---------------------------------------

const VOTE_W = 88
const BAR_H = 6

/**
 * √-scaled against a fixed full scale, so the bar means the same thing on page 6 as on
 * page 1. It is **not a control** — the pill above it is — which is why it stays drawn
 * while the viewer response is in flight: the count is a fact about the catalogue, not
 * about the viewer (§6.13).
 */
export function VoteMagnitude({ magnitude }: { magnitude: number }) {
  return (
    <svg className={styles.svg} width={VOTE_W} height={BAR_H} aria-hidden="true">
      <rect x={0} y={0} width={VOTE_W} height={BAR_H} rx={1} fill="var(--grid)" />
      {magnitude > 0 ? (
        <rect
          x={0}
          y={0}
          width={Math.max(2, magnitude * VOTE_W)}
          height={BAR_H}
          rx={1}
          fill="var(--series)"
        />
      ) : null}
    </svg>
  )
}

// --- slot 8: the activity track ---------------------------------------------

const ACTIVITY_W = 108
const ACTIVITY_H = 10
const ACTIVITY_GAP = 2
const ACTIVITY_SLOT_W =
  (ACTIVITY_W - ACTIVITY_GAP * (ACTIVITY_TRACK_SLOTS - 1)) / ACTIVITY_TRACK_SLOTS

/**
 * Ten slots, one per 1,000 activities, and **the empty ones stay drawn**: free-floating
 * blocks rendered a 310-activity programme as a blank cell, and a blank cell reads as
 * missing data rather than as "small".
 *
 * Over 10,000 the fill strengthens — `--series-250` to `--series`, which is darker in light
 * and brighter in dark, in both cases the more emphatic of the pair — and the count beside
 * it takes a `+`.
 */
export function ActivityTrackBar({ track }: { track: ActivityTrack }) {
  const fill = track.saturated ? 'var(--series)' : 'var(--series-250)'
  return (
    <svg className={styles.svg} width={ACTIVITY_W} height={ACTIVITY_H} aria-hidden="true">
      {Array.from({ length: ACTIVITY_TRACK_SLOTS }, (_, index) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: the track is ten fixed positions
          key={index}
          x={index * (ACTIVITY_SLOT_W + ACTIVITY_GAP)}
          y={0}
          width={ACTIVITY_SLOT_W}
          height={ACTIVITY_H}
          rx={1}
          fill={index < track.filled ? fill : 'var(--grid)'}
        />
      ))}
    </svg>
  )
}

// --- slot 9: the window curve -----------------------------------------------

const WINDOW_W = 262

export type CurvePoint = { x: number; y: number }

/** The y of the curve at an arbitrary x, by linear interpolation between its two points. */
function interpolate(points: CurvePoint[], x: number): number {
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return 0
  if (x <= first.x) return first.y
  if (x >= last.x) return last.y
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    if (!a || !b) break
    if (x <= b.x) {
      const span = b.x - a.x
      const t = span === 0 ? 0 : (x - a.x) / span
      return a.y + (b.y - a.y) * t
    }
  }
  return last.y
}

/**
 * The filled area under the curve between two x positions, as a closed path.
 *
 * Built by clipping the point list rather than by an SVG `clipPath`, because a clip path
 * needs an `id` and 25 rows share one document.
 */
export function areaPath(points: CurvePoint[], x0: number, x1: number, baseline: number): string {
  if (x1 <= x0 || points.length === 0) return ''
  const inner = points.filter((point) => point.x > x0 && point.x < x1)
  const edge: CurvePoint[] = [
    { x: x0, y: interpolate(points, x0) },
    ...inner,
    { x: x1, y: interpolate(points, x1) },
  ]
  const top = edge.map((point) => `${round(point.x)} ${round(point.y)}`).join(' L ')
  return `M ${round(x0)} ${round(baseline)} L ${top} L ${round(x1)} ${round(baseline)} Z`
}

export function linePath(points: CurvePoint[]): string {
  if (points.length === 0) return ''
  return points
    .map((point, i) => `${i === 0 ? 'M' : 'L'} ${round(point.x)} ${round(point.y)}`)
    .join(' ')
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * One S-curve on a **local axis**, the elapsed portion filled heavier, and a 2px data-date
 * rule with a marker at its head.
 *
 * **One line, never two.** Planned-versus-actual needs baseline tables no v1 file carries —
 * the same absence that skips DCMA 11, 13 and 14 — so progress is a marker on one curve and
 * nothing more.
 */
export function WindowCurve({
  points,
  elapsed,
}: {
  points: CurvePoint[] | null
  /** 0–1, or `null` when the revision is missing one of its three dates. */
  elapsed: number | null
}) {
  const dataX = elapsed === null ? null : elapsed * WINDOW_W

  return (
    <svg className={styles.svg} width={WINDOW_W} height={ROW_BAND} aria-hidden="true">
      <line
        x1={0}
        y1={ROW_BAND - 0.5}
        x2={WINDOW_W}
        y2={ROW_BAND - 0.5}
        stroke="var(--grid)"
        strokeWidth={1}
      />
      {points ? (
        <>
          <path d={areaPath(points, 0, WINDOW_W, ROW_BAND)} fill="var(--series-100)" />
          {dataX === null ? null : (
            <path d={areaPath(points, 0, dataX, ROW_BAND)} fill="var(--series-250)" />
          )}
          <path
            d={linePath(points)}
            fill="none"
            stroke="var(--series)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </>
      ) : null}
      {dataX === null ? null : (
        <>
          <line
            x1={dataX}
            y1={0}
            x2={dataX}
            y2={ROW_BAND}
            stroke="var(--ink-2)"
            strokeWidth={2}
            shapeRendering="crispEdges"
          />
          <path
            d={`M ${round(dataX - 3.5)} 0 L ${round(dataX + 3.5)} 0 L ${round(dataX)} 5 Z`}
            fill="var(--ink-2)"
          />
        </>
      )}
    </svg>
  )
}

// --- slot 10: the progress bar ----------------------------------------------

const COMPLETE_W = 88

export function CompleteBar({ pct }: { pct: number | null }) {
  const fraction = pct === null ? 0 : Math.max(0, Math.min(100, pct)) / 100
  return (
    <svg className={styles.svg} width={COMPLETE_W} height={BAR_H} aria-hidden="true">
      <rect x={0} y={0} width={COMPLETE_W} height={BAR_H} rx={1} fill="var(--grid)" />
      {fraction > 0 ? (
        <rect
          x={0}
          y={0}
          width={Math.max(2, fraction * COMPLETE_W)}
          height={BAR_H}
          rx={1}
          fill="var(--series)"
        />
      ) : null}
    </svg>
  )
}

// --- slot 11: the DCMA strip ------------------------------------------------

const DCMA_W = 112
const DCMA_CELL_W = 6
const DCMA_CELL_H = 12
const DCMA_GAP = (DCMA_W - DCMA_CHECK_COUNT * DCMA_CELL_W) / (DCMA_CHECK_COUNT - 1)
const DCMA_CELL_Y = (ROW_BAND - DCMA_CELL_H) / 2

/**
 * Fourteen cells: filled pass, outlined fail, dashed skip.
 *
 * Pass-green ↔ fail-red is ΔE 4.1 under deuteranopia — an all-pairs FAIL — so fill versus
 * outline carries the same distinction without colour, and the printed ratio rides beside
 * the strip in every row. The skipped cells are drawn rather than omitted so that a
 * 10-applicable programme is visibly a 10-applicable programme.
 */
export function DcmaStrip({ cells }: { cells: DcmaCell[] }) {
  return (
    <svg className={styles.svg} width={DCMA_W} height={ROW_BAND} aria-hidden="true">
      {cells.map((cell, index) => {
        const x = index * (DCMA_CELL_W + DCMA_GAP)
        if (cell === 'pass') {
          return (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: fourteen fixed check positions
              key={index}
              x={x}
              y={DCMA_CELL_Y}
              width={DCMA_CELL_W}
              height={DCMA_CELL_H}
              rx={1}
              fill="var(--good)"
            />
          )
        }
        return (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: fourteen fixed check positions
            key={index}
            x={x + 0.5}
            y={DCMA_CELL_Y + 0.5}
            width={DCMA_CELL_W - 1}
            height={DCMA_CELL_H - 1}
            rx={1}
            fill="none"
            stroke={cell === 'fail' ? 'var(--neg)' : 'var(--axis)'}
            strokeDasharray={cell === 'skip' ? '2 2' : undefined}
          />
        )
      })}
    </svg>
  )
}
