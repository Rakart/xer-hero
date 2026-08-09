import type { DcmaCheck, DerivedQuality } from '@/lib/contracts/derived'
import { clampPct } from './chart'
import {
  activityFilterFor,
  CHECK_LABEL,
  CHECK_MEANING,
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
import { formatCount, formatHoursAsDays, formatPct } from './format'
import styles from './programme.module.css'

/**
 * The DCMA 14-point scorecard (§3.7, §6.7).
 *
 * DCMA is adopted **by name** because planners are already audited on it and the thresholds
 * are external and defensible. It is computed and reported here, never endorsed (§7.4):
 * nothing on this page says a programme is good, and the shelf deliberately does not lead
 * with quality, because DCMA inverts — the real live contract fails it and the template
 * built to pass passes it.
 */

/** The compact 14-cell strip. It only ever renders beside its printed ratio. */
export function DcmaStrip({ quality }: { quality: DerivedQuality }) {
  return (
    <span className={styles.strip} aria-hidden="true">
      {stripCells(quality).map((state, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: the cells are the fourteen check numbers, so the index is the identity
          key={index}
          className={`${styles.cell} ${
            state === 'pass'
              ? styles.cellPass
              : state === 'fail'
                ? styles.cellFail
                : styles.cellSkip
          }`}
        />
      ))}
    </span>
  )
}

/**
 * The verdict sentence, above the fold — the one element the rejected *Verdict* layout
 * contributed. It names the failing checks and their values; it does not grade the file.
 */
export function VerdictSentence({ quality }: { quality: DerivedQuality }) {
  return <p className={styles.verdict}>{verdictSentence(quality)}</p>
}

export function QualityPanel({
  quality,
  counts,
  finishToStart,
}: {
  quality: DerivedQuality
  counts: { activities: number; relationships: number }
  finishToStart: number | null
}) {
  return (
    <div className={styles.card}>
      <div className={`${styles.pad} ${styles.qualityHead}`}>
        <div>
          <div className={styles.hero}>
            {formatCount(quality.passed)}
            <small>/{quality.applicable}</small>
          </div>
          <div className={styles.heroLabel}>checks passed</div>
        </div>
        <div className={styles.qualityText}>
          {ratioSentence(quality)}
          {finishToStart === null ? null : (
            <Meter
              label="Finish-to-start relationships"
              pct={finishToStart}
              threshold={90}
              pass={finishToStart >= 90}
              note="DCMA 4 wants 90% or more. The mark on the track is the threshold."
            />
          )}
        </div>
      </div>

      {quality.checks.map((check) => (
        <CheckRow key={check.id} check={check} counts={counts} />
      ))}
    </div>
  )
}

/**
 * A single ratio against a limit is a meter, not a chart. Fixture B's 89.5% renders as a
 * bar stopping just short of the mark, which is the most legible thing on that page.
 */
export function Meter({
  label,
  pct,
  threshold,
  pass,
  note,
}: {
  label: string
  pct: number
  threshold: number
  pass: boolean
  note: string
}) {
  return (
    <div className={styles.meter}>
      <div className={styles.meterHead}>
        <span>{label}</span>
        <b className={styles.num}>{formatPct(pct)}%</b>
      </div>
      <div className={styles.meterTrack}>
        <div
          className={styles.meterFill}
          style={{
            width: `${clampPct(pct)}%`,
            background: pass ? 'var(--series)' : 'var(--neg)',
          }}
        />
        <div className={styles.meterMark} style={{ left: `${clampPct(threshold)}%` }} />
      </div>
      <div className={styles.meterNote}>{note}</div>
    </div>
  )
}

/**
 * One check row: **mark, word, value and threshold**, with colour as the third channel and
 * a plain-English line saying what the check measures.
 *
 * A skipped check renders as its own thing with its reason — it is neither a pass nor a
 * fail, and it leaves both sides of the ratio.
 */
function CheckRow({
  check,
  counts,
}: {
  check: DcmaCheck
  counts: { activities: number; relationships: number }
}) {
  const skipped = check.state === 'skip'
  const population = checkPopulation(check.id, counts)
  const count = checkCount(check)
  const margin = marginSentence(check)
  const threshold = parseThreshold(check.threshold)

  return (
    <>
      <div className={`${styles.checkRow} ${skipped ? styles.checkSkipped : ''}`}>
        <span
          className={`${styles.mark} ${
            check.state === 'pass'
              ? styles.markPass
              : check.state === 'fail'
                ? styles.markFail
                : styles.markSkip
          }`}
          aria-hidden="true"
        >
          {stateMark(check.state)}
        </span>
        <span className={styles.checkNum}>{check.num}</span>
        <span>
          <span>{CHECK_LABEL[check.id]}</span>
          <span className={styles.checkWord}>{stateWord(check.state)}</span>
          <span className={styles.checkMeaning}>
            {skipped ? (check.reason ?? 'not applicable to this file') : CHECK_MEANING[check.id]}
          </span>
          {!skipped && threshold && threshold.kind !== 'zero' && check.pct !== undefined ? (
            <span className={styles.checkBar}>
              <span className={styles.checkTrack}>
                <span
                  className={styles.checkFill}
                  style={{
                    width: `${barWidth(check.pct, threshold.limit)}%`,
                    background: check.state === 'pass' ? 'var(--good)' : 'var(--neg)',
                  }}
                />
                <span
                  className={styles.checkTick}
                  style={{ left: `${barWidth(threshold.limit, threshold.limit)}%` }}
                />
              </span>
              <span className={styles.checkMargin}>{margin}</span>
            </span>
          ) : null}
          {!skipped && threshold?.kind === 'zero' && margin ? (
            <span className={styles.checkMargin}>{margin}</span>
          ) : null}
        </span>
        <span className={styles.checkValue}>
          {checkValue(check)}
          {!skipped && population ? (
            <small>
              {count === undefined
                ? `of ${formatCount(population.size)} ${population.unit}`
                : `${formatCount(count)} of ${formatCount(population.size)} ${population.unit}`}
            </small>
          ) : null}
        </span>
        <span className={styles.checkThreshold}>
          {check.threshold ? `target ${check.threshold}` : 'no limit'}
        </span>
      </div>
      <Exemplars check={check} />
    </>
  )
}

/** Value against threshold on a common scale, with headroom so the mark is never at the edge. */
function barWidth(value: number, limit: number): number {
  const scale = Math.max(value, limit) * 1.28 || 1
  return clampPct((value / scale) * 100)
}

/**
 * **Exemplars are the seam between the panel and the table.** A failing check expands to
 * the 50 worst `derived.json` carries, and — for the three checks whose predicate the
 * activity payload can express — a link applies that predicate to the table below.
 *
 * That is what makes the 50-cap acceptable: the full list is one client-side filter away,
 * because the client holds every row. `TASKPRED` and `TASKACTV` are out of the cut, so a
 * relationship-level check has no such link and says so rather than offering a dead one.
 */
function Exemplars({ check }: { check: DcmaCheck }) {
  const examples = check.examples ?? []
  if (check.state !== 'fail' || examples.length === 0) return null

  const total = check.count ?? examples.length
  const filter = activityFilterFor(check.id)
  const unit =
    check.id === 'leads' || check.id === 'lags'
      ? 'lag'
      : check.id === 'high_duration'
        ? 'duration'
        : 'float'

  return (
    <details className={styles.exemplars}>
      <summary className={styles.exemplarSummary}>
        Show the {formatCount(examples.length)} worst of {formatCount(total)}
      </summary>
      <div className={styles.exemplarScroll}>
        <table className={styles.exemplarTable}>
          <thead>
            <tr>
              <td>code</td>
              <td>activity</td>
              <td className={styles.exemplarValue}>{unit}</td>
            </tr>
          </thead>
          <tbody>
            {examples.map((example) => (
              <tr key={`${example.code}-${example.name}`}>
                <td className={styles.num}>{example.code}</td>
                <td>{example.name}</td>
                <td className={styles.exemplarValue}>
                  {example.value_hr !== undefined
                    ? formatHoursAsDays(example.value_hr, check.hours_per_day)
                    : (example.value ?? '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.exemplarMore}>
        {check.truncated
          ? `Showing ${formatCount(examples.length)} of ${formatCount(total)} — derived.json caps exemplars at 50. `
          : `Showing all ${formatCount(total)}. `}
        {filter ? (
          <a href="#activities" data-activity-filter={filter}>
            Open all {formatCount(total)} in the activity table →
          </a>
        ) : (
          <span className={styles.muted}>
            The activity payload carries no relationship table, so this check has no filter in the
            table below.
          </span>
        )}
      </div>
    </details>
  )
}
