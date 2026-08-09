import { Stat, StatGrid } from '@/components/site'
import type { Derived } from '@/lib/contracts/derived'
import { finishToStartPct } from './chart'
import { DcmaStrip } from './Dcma'
import { EMPTY, formatCount, formatDate, formatPct, formatYear } from './format'
import styles from './programme.module.css'
import { readStat } from './states'

/**
 * The eight fact tiles (§6.7), in a fixed eight-column grid.
 *
 * The count is fixed by the caller rather than by content: a slot that disappears when its
 * fact is missing moves every slot to its right, and the whole point of a tile row is that
 * the eye can compare the same position between two programmes.
 */
export function FactTiles({ derived }: { derived: Derived }) {
  const { shape, time, progress, quality, logic } = derived
  const fs = finishToStartPct(logic.relationship_type_mix, shape.relationship_count)

  return (
    <div className={styles.tilesRow}>
      <StatGrid columns={8}>
        <Stat
          label="Activities"
          value={formatCount(shape.activity_count)}
          sub={`${formatCount(shape.milestone_count)} milestones`}
        />

        <Stat
          label="Complete"
          value={formatPct(progress.pct_complete, progress.pct_complete % 1 === 0 ? 0 : 1)}
          unit="%"
          sub={time.data_date ? `at ${formatDate(time.data_date)}` : 'no data date'}
        />

        <Stat label="Window" value={windowValue(time)} sub={<WindowSub time={time} />} />

        <Stat
          label="Relationships"
          value={formatCount(shape.relationship_count)}
          sub={fs === null ? 'no relationships' : `${formatPct(fs)}% finish-to-start`}
        />

        {/*
          `wbs_depth: 1` is a correct answer, not an error — Fixture B is a real,
          professionally produced tender with 3,344 activities under one node. The tile
          reports the shape rather than an absence, and nothing anywhere promises a treemap.
        */}
        <Stat
          label="WBS"
          value={shape.wbs_depth === 1 ? 'none' : formatCount(shape.wbs_node_count)}
          sub={shape.wbs_depth === 1 ? 'single node' : `${shape.wbs_depth} levels deep`}
        />

        <Stat
          label="Resources"
          value={formatCount(shape.resource_count)}
          sub={`${formatCount(shape.resource_assignment_count)} assignments`}
        />

        {/*
          `calendar_count` is a fact about the file and `calendars_in_use` is a fact about
          the programme, so the second sits beside the first rather than instead of it —
          Fixture A declares four calendars and uses one.
        */}
        <Stat
          label="Calendars"
          value={formatCount(shape.calendar_count)}
          sub={`${formatCount(shape.calendars_in_use)} in use · ${formatCount(
            shape.activity_code_type_count,
          )} code types`}
        />

        {/*
          The ratio is `passed / applicable`, never `/14`, and the compact strip never
          renders without it: pass-green against fail-red is an all-pairs failure under
          deuteranopia, so the printed ratio is the relief that makes the strip readable.
        */}
        <Stat
          label="DCMA 14-point"
          value={formatCount(quality.passed)}
          unit={`/${quality.applicable}`}
          sub={<DcmaStrip quality={quality} />}
          title={`${quality.passed} of ${quality.applicable} applicable DCMA checks passed; ${quality.skipped} not applicable`}
        />
      </StatGrid>
    </div>
  )
}

function windowValue(time: Derived['time']): string {
  const start = formatYear(time.start_date)
  const finish = formatYear(time.finish_date)
  if (start === EMPTY && finish === EMPTY) return EMPTY
  return `${start}–${finish}`
}

/**
 * The one stat that does **not** follow the print-the-reason-verbatim rule `longest_path`
 * uses, and the divergence is a matter of room: `longest_path` owns a callout with space
 * for a sentence and this owns half a tile. Where the working-day figure is unavailable the
 * tile prints the calendar-day span alone; only an `error` reaches the banner.
 *
 * The calendar clause is never dropped, even where the working count equals the span — on a
 * seven-day programme that identity *is* the summary.
 */
function WindowSub({ time }: { time: Derived['time'] }) {
  if (time.duration_calendar_days === null) return <>no window in the file</>
  const span = `${formatCount(time.duration_calendar_days)} days`
  const working = readStat(time.duration_working_days)
  if ('missing' in working) return <>{span}</>

  const share =
    working.ok.activity_share_pct < 100
      ? ` · the calendar ${formatPct(working.ok.activity_share_pct, 0)}% of activities use`
      : ''
  return (
    <>
      {span} · {formatCount(working.ok.days)} working ({working.ok.calendar.working_days_per_week}
      -day week){share}
    </>
  )
}
