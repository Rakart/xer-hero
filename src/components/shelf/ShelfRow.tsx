import { Chip } from '@/components/site'
import { sectorLabel } from '@/lib/contracts/domain'
import type { ShelfRow as ShelfRowRecord } from '@/lib/db/queries'
import { RowControls } from './RowControls'
import {
  ActivityTrackBar,
  CompleteBar,
  DcmaStrip,
  FloatSliver,
  ROW_BAND,
  VoteMagnitude,
  WindowCurve,
} from './RowGraphics'
import styles from './ShelfRow.module.css'
import {
  activityTrack,
  dcmaCells,
  dcmaRatio,
  floatSegments,
  formatAge,
  formatMonthYear,
  formatPercent,
  rowBadges,
  voteMagnitude,
  windowGeometry,
} from './shelf-format'

/**
 * A shelf row's payload.
 *
 * Structurally `ShelfRow` from the query layer, with the two timestamps widened: the
 * shelf's queries are wrapped in `unstable_cache` (§6.4) and a cached row comes back
 * JSON-serialised, so a `Date` on the first render is a string on the next fifty-nine
 * seconds' worth.
 */
export type ShelfRowData = Omit<ShelfRowRecord, 'created_at' | 'uploaded_at'> & {
  created_at: Date | string
  uploaded_at: Date | string
}

const WINDOW_BOX = { width: 262, height: ROW_BAND }

/**
 * One row, twelve facts in twelve fixed slots (§6.2).
 *
 * There is no card. Four structurally different layouts were built against 40 programmes —
 * poster grid, row list, verdict-first card, time-rail grid — and **the row list won both
 * jobs asked of it**, the one you scan and the one you click from. A card that leads with a
 * picture spends its best real estate on the fact planners judge last.
 *
 * The rules the prototype settled, each of which is a constraint on this component:
 *
 * - **Nothing may flow.** Rev, P6 and the float percentages were a prose sub-line and read
 *   as noise, because the same fact landed at a different x on every row. Only two
 *   variable-length strings survive, both in slot 2: the handle and the fork parent.
 * - **The three float numbers may not be dropped for density** — light-mode amber is
 *   2.11:1 against the surface, below the 3:1 floor, so the printed percentages are what
 *   make the band legible.
 * - **Empty activity slots stay drawn**, because a blank cell reads as missing data.
 * - **The DCMA strip always rides beside its printed ratio**, because pass-green ↔ fail-red
 *   is an all-pairs FAIL under deuteranopia.
 * - **No fork count.** `forked from X` stays because it names a programme you may already
 *   know; the fork *count* exists only on the contributor page.
 * - **Baseline is cut entirely.** No `is_baseline` badge, no "not started" caption; an
 *   unprogressed tender simply reads `0%`.
 *
 * Everything drawn comes from the `card` JSONB column and typed columns. **Zero blobs**:
 * had the grid fetched `derived.json` per row, the size ceiling would have been ~5 KB of
 * scalars and none of this would fit.
 */
export function ShelfRow({ row, now }: { row: ShelfRowData; now?: Date }) {
  const badges = rowBadges(row.card)
  const segments = floatSegments(row.card?.float_mix)
  const track = activityTrack(row.activity_count)
  const window = windowGeometry(
    row.card,
    { start: row.start_date, finish: row.finish_date, data: row.data_date },
    WINDOW_BOX,
  )
  const cells = dcmaCells(row.checks_passed, row.checks_applicable)
  const sector = sectorLabel(row.sector)

  return (
    <div className={styles.row}>
      {/* 1 — float: the 30px sliver over three fixed numeric slots, percentages summing 100 */}
      <div className={styles.cell}>
        <div className={styles.band}>
          <FloatSliver segments={segments} />
        </div>
        <div className={`${styles.caption} ${styles.floatNumbers}`}>
          {segments.map((segment) => (
            <span key={segment.key} style={{ color: segment.fill }}>
              {segment.pct}
            </span>
          ))}
        </div>
      </div>

      {/* 2 — programme: the only slot that carries variable-length text */}
      <div className={`${styles.cell} ${styles.programme}`}>
        <div className={styles.titleLine}>
          <a className={styles.title} href={`/p/${row.slug}`}>
            {row.title}
          </a>
          {badges.map((badge) => (
            <Chip key={badge.label} tone="badge" title={badge.title}>
              {badge.label}
            </Chip>
          ))}
        </div>
        <div className={styles.subLine}>
          <a className={styles.handle} href={`/u/${row.uploader_display_name}`}>
            {row.uploader_display_name}
          </a>
          {row.parent_slug && row.parent_title ? (
            <>
              <span className={styles.dot}>·</span>
              <span className={styles.forked}>
                forked from{' '}
                <a className={styles.handle} href={`/p/${row.parent_slug}`}>
                  {row.parent_title}
                </a>
              </span>
            </>
          ) : null}
        </div>
      </div>

      {/* 3 — sector: the label, or a ghost badge reading `unsectored`. There is no
          `unsectored` code and no ninth chip; blank is a real state and plausibly the
          largest bucket in the catalogue (§6.5). */}
      <div className={styles.cell}>
        <div className={styles.band}>
          <Chip tone={sector ? 'badge' : 'ghost'} title={sector ?? 'No sector declared'}>
            <span className={styles.clip}>{sector ?? 'unsectored'}</span>
          </Chip>
        </div>
      </div>

      {/* 4 — P6: its own column, because as prose it landed at a different x on every row */}
      <div className={styles.cell}>
        <div className={`${styles.band} ${styles.figure}`}>{row.p6_version ?? '—'}</div>
      </div>

      {/* 5 and 6 — the two per-viewer controls, drawn signed-out on the server (§6.13) */}
      <RowControls programmeId={row.programme_id} title={row.title} voteCount={row.vote_count}>
        <div className={styles.caption}>
          <VoteMagnitude magnitude={voteMagnitude(row.vote_count)} />
        </div>
      </RowControls>

      {/* 7 — rev */}
      <div className={styles.cell}>
        <div className={`${styles.band} ${styles.figure} ${styles.right}`}>r{row.rev_no}</div>
      </div>

      {/* 8 — activities: the count, then a fixed ten-slot track, one slot per 1,000 */}
      <div className={styles.cell}>
        <div className={`${styles.band} ${styles.figure} ${styles.right}`}>{track.label}</div>
        <div className={styles.caption}>
          <ActivityTrackBar track={track} />
        </div>
      </div>

      {/* 9 — window & data date: a local axis, never a shared calendar one */}
      <div className={styles.cell}>
        <div className={styles.band}>
          <WindowCurve points={window.points} elapsed={window.elapsed} />
        </div>
        <div className={`${styles.caption} ${styles.windowCaption}`}>
          <span>{formatMonthYear(row.start_date)}</span>
          {/* §6.2 spells this caption `▼ data date {date}`. The label rides with the marker
              because the other two captions in this slot are also dates: without the words, a
              reader has three month-years and a triangle to tell them apart. */}
          <span className={styles.dataDate}>
            {row.data_date ? `▼ data date ${formatMonthYear(row.data_date)}` : ''}
          </span>
          <span className={styles.right}>{formatMonthYear(row.finish_date)}</span>
        </div>
      </div>

      {/* 10 — complete */}
      <div className={styles.cell}>
        <div className={`${styles.band} ${styles.figure} ${styles.right}`}>
          {formatPercent(row.pct_complete)}
        </div>
        <div className={styles.caption}>
          <CompleteBar pct={row.pct_complete} />
        </div>
      </div>

      {/* 11 — DCMA: fourteen cells and the printed ratio, always together */}
      <div className={styles.cell}>
        <div className={styles.band}>
          <DcmaStrip cells={cells} />
        </div>
        <div className={`${styles.caption} ${styles.right}`}>
          {dcmaRatio(row.checks_passed, row.checks_applicable)}
        </div>
      </div>

      {/* 12 — age */}
      <div className={styles.cell}>
        <div className={`${styles.band} ${styles.figure} ${styles.right}`}>
          {formatAge(row.uploaded_at, now)}
        </div>
      </div>
    </div>
  )
}
