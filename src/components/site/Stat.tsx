import styles from './Stat.module.css'

/**
 * One fact in a fixed slot: a label, a value, and optionally a unit and a sub-line.
 *
 * The slot is fixed whether or not there is a value — the shelf's twelve slots and the
 * programme page's headline numbers both hold their geometry when a fact is missing, so
 * `value` accepts `null` and renders the em dash rather than collapsing. That is what
 * keeps `Δx 0.00 · Δw 0.00 · Δy 0.00` true when a late-arriving viewer response lands
 * next to it (§6.13).
 *
 * It reports a number; it never characterises one (§7.4). There is no `good`/`bad` tone.
 */
export function Stat({
  label,
  value,
  unit,
  sub,
  hero = false,
  title,
}: {
  label: string
  /** `null` renders as `—`: the slot is kept, the claim is not invented. */
  value: React.ReactNode
  unit?: string
  sub?: React.ReactNode
  /** The one oversized number at the top of a document. */
  hero?: boolean
  title?: string
}) {
  return (
    <div className={hero ? `${styles.tile} ${styles.hero}` : styles.tile} title={title}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>
        {value === null || value === undefined || value === '' ? '—' : value}
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </div>
      {sub ? <div className={styles.sub}>{sub}</div> : null}
    </div>
  )
}

/**
 * A row of `Stat` slots at a fixed column count. The count is fixed by the caller rather
 * than by content, because a slot that disappears when its fact is missing moves every
 * slot to its right.
 */
export function StatGrid({ columns, children }: { columns: number; children: React.ReactNode }) {
  return (
    <div
      className={styles.grid}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  )
}
