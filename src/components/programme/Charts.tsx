import type { Derived, Histogram, SCurve as SCurveData } from '@/lib/contracts/derived'
import {
  axisLabel,
  columnGeometry,
  columnPath,
  dataDateIndex,
  linePath,
  niceScale,
  yearTicks,
} from './chart'
import { BAND_LABEL, bandShare, bandTotals, bucketsOf, nullFloatSentence } from './float'
import { formatCount, formatDate, formatMonth, formatPct, parseNaiveMonth } from './format'
import styles from './programme.module.css'

/**
 * Every chart on this page (§6.7).
 *
 * **Hand-rolled inline SVG in server components, no library.** That is a stack decision
 * rather than a preference: any chart whose data is known at request time renders as
 * server-generated SVG, and a runtime library enters only when interaction is the
 * requirement. Each of these also needed behaviour a library would have fought — a
 * data-date rule, a threshold mark, fixed contract buckets, and a form switch from chart to
 * table.
 *
 * **The charts are programme-level and do not answer the table's filters.** They could —
 * re-bucketing 20,000 rows costs about 2 ms — but that would make the client a second
 * source of truth for a published statistic, which is ruled out everywhere else. So the
 * filter row sits with the table it scopes, and each chart says which population it covers.
 *
 * **A tooltip is never the only way to read a value.** The hover layer is a native SVG
 * `<title>`, which costs no JavaScript, and every number it carries is also printed —
 * on an axis, in a band key, or in the exact table beside the bar.
 */

const AXIS_LEFT = 46
const AXIS_RIGHT = 10

/**
 * *Activities finished, cumulative* — **one line, never two**.
 *
 * Planners expect planned-versus-actual. It is not available: that needs baseline tables no
 * v1 file carries, the same absence that skips DCMA 11, 13 and 14. So the page says so in a
 * callout rather than drawing a second line the data cannot support.
 */
export function SCurve({ curve, dataDate }: { curve: SCurveData; dataDate: string | null }) {
  const points = curve.cumulative
  const width = 1280
  const height = 210
  const top = 16
  const bottom = 26

  if (points.length === 0) {
    return <p className={styles.muted}>No dates in the file, so there is no curve to draw.</p>
  }

  const scale = niceScale(points[points.length - 1] ?? 1, 4)
  const innerWidth = width - AXIS_LEFT - AXIS_RIGHT
  const innerHeight = height - top - bottom
  const lastIndex = Math.max(1, points.length - 1)
  const x = (index: number) => AXIS_LEFT + (index / lastIndex) * innerWidth
  const y = (value: number) => top + innerHeight - (value / scale.top) * innerHeight
  const line = linePath(points, x, y)
  const area = `${line}L${x(points.length - 1).toFixed(1)},${(top + innerHeight).toFixed(1)}L${x(0).toFixed(1)},${(top + innerHeight).toFixed(1)}Z`

  const ruleIndex = dataDateIndex(curve.from, dataDate)
  const rule = ruleIndex === null || ruleIndex < 0 || ruleIndex > lastIndex ? null : x(ruleIndex)
  const origin = parseNaiveMonth(curve.from)
  const band = innerWidth / points.length

  return (
    <svg
      className={styles.chartSvg}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Cumulative activities finished by month, ${points.length} monthly buckets, ending at ${formatCount(points[points.length - 1] ?? 0)}`}
    >
      <title>Activities finished, cumulative, by month</title>
      {scale.ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={AXIS_LEFT}
            y1={y(tick)}
            x2={width - AXIS_RIGHT}
            y2={y(tick)}
            stroke="var(--grid)"
            strokeWidth={1}
          />
          <text className={styles.axisLabel} x={AXIS_LEFT - 6} y={y(tick) + 3.5} textAnchor="end">
            {axisLabel(tick)}
          </text>
        </g>
      ))}

      {/* The elapsed portion is weighted heavier — the only mark on the chart that says
          which part of the curve has happened. */}
      {rule === null ? null : (
        <defs>
          <clipPath id="elapsed">
            <rect x={0} y={0} width={rule} height={height} />
          </clipPath>
        </defs>
      )}
      <path d={area} fill="var(--series)" fillOpacity={0.1} />
      {rule === null ? null : (
        <path d={area} fill="var(--series)" fillOpacity={0.22} clipPath="url(#elapsed)" />
      )}
      <path
        d={line}
        fill="none"
        stroke="var(--series)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {rule === null ? null : (
        <g>
          <line
            x1={rule}
            y1={top - 8}
            x2={rule}
            y2={top + innerHeight}
            stroke="var(--ink)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          <polygon
            points={`${rule - 4},${top - 8} ${rule + 4},${top - 8} ${rule},${top - 1}`}
            fill="var(--ink)"
          />
          <text className={styles.axisLabel} x={rule + 7} y={top - 8} fill="var(--ink)">
            data date {formatDate(dataDate)}
          </text>
        </g>
      )}

      {origin
        ? yearTicks(curve.from, points.length).map((tick) => (
            <text
              key={tick.label}
              className={styles.axisLabel}
              x={x(tick.index)}
              y={height - 8}
              textAnchor="middle"
            >
              {tick.label}
            </text>
          ))
        : null}

      {origin
        ? points.map((value, index) => (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: the index is the month, and a month is the bucket's identity in a fixed-bucket series
              key={index}
              x={AXIS_LEFT + band * index}
              y={top}
              width={band}
              height={innerHeight}
              fill="transparent"
            >
              <title>
                {`${formatMonth(origin.year, origin.month - 1 + index)} — started ${formatCount(curve.starts[index] ?? 0)}, finished ${formatCount(curve.finishes[index] ?? 0)}, cumulative ${formatCount(value)}`}
              </title>
            </rect>
          ))
        : null}
    </svg>
  )
}

/** Stated once where there is room to explain it, rather than drawn as a line that lies. */
export function OneLineCallout({ dataDate }: { dataDate: string | null }) {
  return (
    <div className={styles.callout}>
      <b>One line, not two.</b> A planned-versus-actual S-curve needs baseline tables this file does
      not carry — the same absence that makes DCMA 11, 13 and 14 skip.{' '}
      {dataDate
        ? 'The heavier fill left of the data date is what has happened; a second line would be invented.'
        : 'Nothing has started, so there is no data date and no fill to weight — this curve is the plan and only the plan.'}
    </div>
  )
}

/**
 * Total float: a **band bar** for the shape and a **nine-row table** for the values.
 *
 * The contract's histogram draws as a single spike on every programme that exists and a
 * different spike each time, and the bucket a reader most needs — negative — is 27
 * activities beside 7,117. The band bar keeps continuity with the shelf's sliver (same
 * three fills, same thresholds); the table carries the exact counts, with band colour as a
 * *secondary* channel. Light-mode amber measures 2.11:1 against the surface, below the 3:1
 * floor, which is why the printed numbers may not be dropped for density.
 */
export function FloatPanel({ histogram }: { histogram: Histogram }) {
  const totals = bandTotals(histogram)
  const buckets = bucketsOf(histogram)
  const half = Math.ceil(buckets.length / 2)
  const nulls = nullFloatSentence(histogram)

  return (
    <div>
      {totals.total === 0 ? (
        <p className={styles.muted}>No activity in this file carries a total float.</p>
      ) : (
        <div className={styles.bandBar}>
          {(['negative', 'ok', 'high'] as const).map((band) =>
            totals[band] === 0 ? null : (
              <span
                key={band}
                style={{ flex: `${totals[band]} 0 0`, background: bandColour(band) }}
                title={`${BAND_LABEL[band]}: ${formatCount(totals[band])}`}
              />
            ),
          )}
        </div>
      )}

      <div className={styles.bandKey}>
        {(['negative', 'ok', 'high'] as const).map((band) => (
          <span key={band}>
            <i style={{ background: bandColour(band) }} />
            {BAND_LABEL[band]} <b className={styles.num}>{formatCount(totals[band])}</b> ·{' '}
            <span className={styles.num}>{bandShare(totals, band)}%</span>
          </span>
        ))}
      </div>

      <div className={styles.floatTable}>
        {[buckets.slice(0, half), buckets.slice(half)].map((column, columnIndex) => (
          <table
            // biome-ignore lint/suspicious/noArrayIndexKey: two fixed columns of one table.
            key={columnIndex}
            className={styles.exactTable}
          >
            <tbody>
              {column.map((bucket) => (
                <tr key={bucket.label}>
                  <td>
                    <i className={styles.swatch} style={{ background: bandColour(bucket.band) }} />
                    {bucket.label}
                  </td>
                  <td className={styles.exactRight}>{formatCount(bucket.count)}</td>
                  <td className={`${styles.exactRight} ${styles.muted}`}>
                    {formatPct(bucket.pct)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>

      {nulls ? <div className={styles.callout}>{nulls}</div> : null}
    </div>
  )
}

function bandColour(band: 'negative' | 'ok' | 'high'): string {
  if (band === 'negative') return 'var(--neg)'
  if (band === 'high') return 'var(--slack)'
  return 'var(--series)'
}

/**
 * *Original duration* — the same eight-bucket form on the same file spreads properly across
 * every bucket, which is how we know float's failure is its distribution and not the form.
 */
export function DurationHistogram({ histogram }: { histogram: Histogram }) {
  const buckets = bucketsOf(histogram)
  const counts = buckets.map((bucket) => bucket.count)
  const peak = Math.max(...counts, 0)
  if (peak === 0) {
    return <p className={styles.muted}>No activity in this file carries an original duration.</p>
  }

  const width = 620
  const height = 200
  const top = 12
  const bottom = 34
  const scale = niceScale(peak)
  const innerWidth = width - AXIS_LEFT - AXIS_RIGHT
  const innerHeight = height - top - bottom
  const band = innerWidth / buckets.length
  const geometry = columnGeometry(band)

  return (
    <svg
      className={styles.chartSvg}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Original duration distribution over ${buckets.length} fixed buckets`}
    >
      <title>Original duration, fixed buckets</title>
      {scale.ticks.map((tick) => {
        const y = top + innerHeight - (tick / scale.top) * innerHeight
        return (
          <g key={tick}>
            <line
              x1={AXIS_LEFT}
              y1={y}
              x2={width - AXIS_RIGHT}
              y2={y}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            <text className={styles.axisLabel} x={AXIS_LEFT - 6} y={y + 3.5} textAnchor="end">
              {axisLabel(tick)}
            </text>
          </g>
        )
      })}

      {buckets.map((bucket, index) => {
        const barHeight = (bucket.count / scale.top) * innerHeight
        const x = AXIS_LEFT + band * index + geometry.offset
        const y = top + innerHeight - barHeight
        return (
          <g key={bucket.label}>
            <path
              d={columnPath(x, y, geometry.width, Math.max(barHeight, bucket.count > 0 ? 1 : 0))}
              fill="var(--series)"
            />
            <rect
              x={AXIS_LEFT + band * index}
              y={top}
              width={band}
              height={innerHeight}
              fill="transparent"
            >
              <title>{`${bucket.label}: ${formatCount(bucket.count)} activities`}</title>
            </rect>
            <text
              className={styles.axisLabel}
              x={AXIS_LEFT + band * index + band / 2}
              y={height - 16}
              textAnchor="middle"
            >
              {index % 2 === 0 || band > 62 ? bucket.label : ''}
            </text>
          </g>
        )
      })}

      <text
        className={styles.axisLabel}
        x={AXIS_LEFT + innerWidth / 2}
        y={height - 3}
        textAnchor="middle"
      >
        original duration, days · DCMA 8 flags anything over 44 days
      </text>
    </svg>
  )
}

/**
 * *Status mix* — an ordered scale, so one hue in three steps, direct-labelled with counts.
 * An unknown status code renders as itself: P6 enumerations may never be treated as closed.
 */
export function StatusMix({ progress }: { progress: Derived['progress'] }) {
  const known: Array<[string, string, string]> = [
    ['TK_Complete', 'Complete', 'var(--series-700)'],
    ['TK_Active', 'In progress', 'var(--series)'],
    ['TK_NotStart', 'Not started', 'var(--series-100)'],
  ]
  const extras = Object.keys(progress.status_mix).filter(
    (code) => !known.some(([known_]) => known_ === code),
  )
  const segments = [
    ...known.map(([code, label, colour]) => ({
      code,
      label,
      colour,
      count: progress.status_mix[code] ?? 0,
    })),
    ...extras.map((code) => ({
      code,
      label: code,
      colour: 'var(--axis)',
      count: progress.status_mix[code] ?? 0,
    })),
  ]
  const total = segments.reduce((sum, segment) => sum + segment.count, 0)
  if (total === 0) return null

  return (
    <div>
      <div className={styles.bandBar} style={{ height: 26 }}>
        {segments.map((segment) =>
          segment.count === 0 ? null : (
            <span
              key={segment.code}
              style={{ flex: `${segment.count} 0 0`, background: segment.colour }}
              title={`${segment.label}: ${formatCount(segment.count)}`}
            />
          ),
        )}
      </div>
      <div className={styles.bandKey}>
        {segments.map((segment) => (
          <span key={segment.code}>
            <i style={{ background: segment.colour }} />
            {segment.label} <b className={styles.num}>{formatCount(segment.count)}</b>
          </span>
        ))}
      </div>
    </div>
  )
}
