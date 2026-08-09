import { Chip, OPERATOR_NAME } from '@/components/site'
import type { Derived } from '@/lib/contracts/derived'
import { formatCount, formatDate, formatPct, plural } from './format'
import styles from './programme.module.css'
import { bannerEntries, MISSING_WORD, noteEntries, readStat } from './states'
import type { ProgrammeView } from './types'

/**
 * The banner, the callouts and the panels that sit between the charts and the table.
 */

/**
 * *Partially analysed* (§6.7 item 7).
 *
 * **Only `error`-state stats reach it.** A `skip` and an `unavailable` are complete
 * answers — a tender with no progress genuinely has no out-of-sequence work, and a file
 * with no `CALENDAR` table genuinely has no working-day span — and banging a warning over
 * either would teach visitors that the badge means nothing. Ingest never fails on a stat
 * error: everything else on the page computed normally, and the banner says so.
 */
export function IssuesBanner({ derived }: { derived: Derived }) {
  const entries = bannerEntries(derived)
  if (entries.length === 0) return null
  return (
    <div className={`${styles.callout} ${styles.calloutWarn}`}>
      <b>⚠ Partially analysed.</b>
      <ul className={styles.calloutList}>
        {entries.map((entry) => (
          <li key={entry.stat}>
            <code>{entry.stat}</code> — {entry.reason}
          </li>
        ))}
      </ul>
      Everything else on this page computed normally.
    </div>
  )
}

/**
 * The critical / longest-path callout (§3.6, §6.7).
 *
 * Two traps the contract flagged and this is where they would be sprung:
 *
 * - **`critical_count` never renders without `critical_threshold_hr`.** The threshold is
 *   `PROJECT.critical_drtn_hr_cnt` and it is 0 on one real fixture and 168 on the other:
 *   "131 critical activities" and "1,265 critical activities" are answers to different
 *   questions, and rendering either without its threshold is a lie.
 * - **Longest Path is not Critical.** Different concepts, separate fields, separate
 *   provenance. Conflating them is the classic P6 reporting error.
 *
 * The provenance sentence is printed verbatim and is the whole of what this page says about
 * method: the algorithm and its known lag limitation live in the tracer's doc in the repo,
 * because a paragraph of scheduling theory in a callout is noise.
 */
export function LongestPathCallout({ logic }: { logic: Derived['logic'] }) {
  const longest = readStat(logic.longest_path)
  return (
    <div className={styles.callout}>
      <p>
        <b className={styles.num}>{formatCount(logic.critical_count)}</b> activities are{' '}
        <b>critical</b> at this programme&rsquo;s own threshold of{' '}
        <b className={styles.num}>{formatCount(logic.critical_threshold_hr)}</b> hours&rsquo; total
        float — the threshold is stored in the file and differs between programmes, so this count is
        not comparable with another programme&rsquo;s until both are normalised.
      </p>
      <p>
        <b>Longest path</b>:{' '}
        {'ok' in longest ? (
          <>
            <b className={styles.num}>{formatCount(longest.ok.count)}</b> activities over{' '}
            <span className={styles.num}>{formatCount(longest.ok.duration_calendar_days)}</span>{' '}
            calendar days,{' '}
            <span className={styles.num}>{formatPct(longest.ok.share_of_remaining_pct)}%</span> of
            the remaining work — computed by this site from the file&rsquo;s own dates — P6 did not
            export a Longest Path.
            {longest.ok.truncated
              ? ' The chain reached a predecessor outside this file, so it is truncated at that point.'
              : ''}
          </>
        ) : (
          <>
            <span className={styles.muted}>{MISSING_WORD[longest.missing.state]}</span> —{' '}
            {longest.missing.reason}.
          </>
        )}{' '}
        <b>Longest path is not the same thing as critical.</b>
      </p>
      <p className={styles.muted}>
        {logic.path_continuous
          ? 'The driving chain runs unbroken from the data date to the finish.'
          : 'The driving chain does not run unbroken from the data date to the finish.'}
        {logic.cycle_count > 0 ? ` ${plural(logic.cycle_count, 'cycle')} in the logic.` : ''}
        {logic.external_relationship_count > 0
          ? ` ${plural(logic.external_relationship_count, 'relationship')} point outside this file.`
          : ''}
      </p>
    </div>
  )
}

/**
 * The first-level WBS breakdown, from `shape.wbs_summary` — which exists precisely so this
 * renders on first paint without fetching `activities.json`.
 *
 * **At `wbs_depth: 1` the panel is replaced, not emptied.** Fixture B is a real,
 * professionally produced tender with 3,344 activities under a single node, and an empty
 * panel there reads as a parse failure. Nothing here promises a treemap.
 */
export function WbsSummary({ derived }: { derived: Derived }) {
  const { shape } = derived
  const largest = Math.max(...shape.wbs_summary.map((entry) => entry.activity_count), 1)
  return (
    <div className={`${styles.card} ${styles.pad}`}>
      <div className={styles.chartTitle}>First-level breakdown</div>
      <div className={styles.chartSub}>
        {formatCount(shape.wbs_node_count)} nodes, {shape.wbs_depth} levels deep
      </div>
      {shape.wbs_summary.map((entry) => (
        <div className={styles.wbsRow} key={entry.name}>
          <span>
            {entry.name}
            <span
              className={styles.wbsBar}
              style={{ width: `${(entry.activity_count / largest) * 100}%` }}
            />
          </span>
          <span className={`${styles.right} ${styles.num}`}>
            {formatCount(entry.activity_count)}
          </span>
        </div>
      ))}
      {shape.wbs_summary_truncated ? (
        <div className={styles.fine}>
          Capped at the first 20 first-level nodes. The whole tree is in the rail beside the
          activity table below.
        </div>
      ) : null}
    </div>
  )
}

/**
 * The panel that **replaces** the WBS rail at `wbs_depth: 1` rather than emptying it.
 *
 * Fixture B is a real, professionally produced tender with 3,344 activities under a single
 * node — an empty rail there reads as a parse failure, so the panel says outright that it
 * is not one, and offers the fallback axis a tender programme actually has: its activity
 * code types. They are drawn inert, because `activities.json` carries no code *values*
 * (§3.12) and a control that cannot group is not a control.
 *
 * It renders as a prop of the client activity section, which is why it is a separate export.
 */
export function NoWbsPanel({ derived }: { derived: Derived }) {
  const { shape, codes } = derived
  return (
    <div className={styles.pad}>
      <b>No work breakdown structure.</b>
      <p className={styles.description}>
        All {formatCount(shape.activity_count)} activities sit under a single node. This is a real
        shape, not a parse failure — a tender programme often carries none.
      </p>
      {codes.types.length > 0 ? (
        <>
          <div className={styles.fine}>
            The axis this file does carry is its activity codes. The activity payload holds no code
            values, so these name the axis and do not group the table:
          </div>
          <div className={styles.chain}>
            {codes.types.map((type) => (
              <Chip
                key={type.name}
                tone="ghost"
                disabled
                title="Code values are not in the activity payload"
              >
                {type.name}
              </Chip>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

/**
 * Activity codes: **types enumerated, values not** (§3.9). A code type with hundreds of
 * values would dominate `derived.json`, and `TASKACTV` is out of the activity payload
 * because including it doubles the largest object the site serves per open.
 */
export function CodesPanel({ codes }: { codes: Derived['codes'] }) {
  if (codes.types.length === 0) {
    return <p className={styles.muted}>This file carries no activity code types.</p>
  }
  return (
    <div>
      <div className={styles.codeRow}>
        <span className={styles.muted}>code type</span>
        <span className={`${styles.right} ${styles.muted}`}>values</span>
        <span className={`${styles.right} ${styles.muted}`}>assigned</span>
      </div>
      {codes.types.map((type) => (
        <div className={styles.codeRow} key={type.name}>
          <span>{type.name}</span>
          <span className={`${styles.right} ${styles.num} ${styles.muted}`}>
            {formatCount(type.value_count)}
          </span>
          <span className={`${styles.right} ${styles.num} ${styles.muted}`}>
            {formatPct(type.assigned_pct)}%
          </span>
        </div>
      ))}
      {codes.truncated ? <div className={styles.fine}>The type list is capped.</div> : null}
      <div className={styles.fine}>
        Values themselves are not enumerated in <code>derived.json</code>, so filtering the table by
        a code value is not something this build does.
      </div>
    </div>
  )
}

/**
 * What the download is, stated beside it (§7.8, §7.9).
 *
 * **Publish verbatim, disclose before publishing, strip nothing, screen nothing, promise
 * nothing.** No stripper is built and no server-side detector exists anywhere in the ingest
 * path — the fields a stripper could reliably detect are empty in every real file, and the
 * fields that are populated are undetectable, so any stripper ships a file that is
 * *changed* while still carrying the personal data it claims to have removed. That is false
 * assurance, and false assurance is weaker than honest publication.
 *
 * Personal data is confined to **exactly one object** on this site, and it is the one this
 * button downloads. The wording below is bound by §7.4: it describes mechanism, and
 * `noindex` is named as mitigation against well-behaved crawlers rather than as protection.
 */
export function PublicationNotice() {
  return (
    <div className={styles.callout}>
      <p>
        <b>Published exactly as uploaded.</b> The download serves the original bytes. Nothing is
        stripped from the file, nothing about it is reviewed, and no part of this site checks what
        is inside it.
      </p>
      <p>
        A <code>.xer</code> can name people — whoever exported it, resource names, activity notes
        and free text. The download URL asks search engines not to index it: a request to
        well-behaved crawlers, not a barrier. Everything else on this page — the statistics, the
        charts, the activity table — is computed from the file and names nobody.
      </p>
      <p>
        If a file names you and you want it taken down, <a href="/report">report it</a>. The
        operator, {OPERATOR_NAME}, acts on it by hand.
      </p>
    </div>
  )
}

/**
 * The `issues[]` entries that are **not** banner-worthy, plus the provenance of the numbers
 * above. They are recorded rather than dropped: an `info` entry is how the driving-path
 * flag's disagreement with our own trace is reported, and that is worth reading.
 */
export function AnalysisNotes({ derived }: { derived: Derived }) {
  const notes = noteEntries(derived)
  return (
    <div className={styles.fine}>
      {notes.length > 0 ? (
        <ul className={styles.calloutList}>
          {notes.map((note) => (
            <li key={`${note.stat}-${note.reason}`}>
              <code>{note.stat}</code> — {note.reason} ({note.severity})
            </li>
          ))}
        </ul>
      ) : null}
      Every number above the activity table is computed once at upload and read from{' '}
      <code>derived.json</code> v{derived.version}; nothing recomputes when this page renders.
      Parser {derived.parser_version}, computed {formatDate(derived.computed_at)}.
    </div>
  )
}

/**
 * The revision history and the ancestry chain (§6.7, §7.3).
 *
 * **The full ancestry renders, not just the immediate parent** — A → B → C — and a
 * tombstoned ancestor stays in the chain and says so there, because a hole in the chain is
 * worse than a labelled link.
 */
export function LineageSurface({ view }: { view: ProgrammeView }) {
  const visible = view.revisions.filter(
    (entry) => entry.status === 'published' || entry.status === 'tombstoned',
  )
  return (
    <div className={`${styles.card} ${styles.pad}`}>
      {view.ancestors.length > 0 ? (
        <div className={styles.chain}>
          <span className={styles.muted}>forked from</span>
          {[...view.ancestors].reverse().map((ancestor) => (
            <span key={ancestor.slug}>
              <a href={`/p/${ancestor.slug}`}>{ancestor.title}</a>
              {ancestor.status === 'tombstoned' ? (
                <span className={styles.muted}> (removed)</span>
              ) : null}
              <span className={styles.sep}>→</span>
            </span>
          ))}
          <span>{view.title}</span>
        </div>
      ) : (
        <div className={styles.chain}>
          <span className={styles.muted}>root — nothing was forked to make it</span>
        </div>
      )}

      <div className={styles.fine}>
        {plural(view.lineage.forkCount, 'fork')} of this programme · {view.lineage.familyCount} in
        the family, counted from the root.
      </div>

      {visible.map((entry) => (
        <div className={styles.codeRow} key={entry.revNo}>
          <span>
            <a
              href={
                entry.revNo === view.currentRevNo
                  ? `/p/${view.slug}`
                  : `/p/${view.slug}/r/${entry.revNo}`
              }
            >
              r{entry.revNo}
            </a>
            {entry.revNo === view.currentRevNo ? (
              <span className={styles.muted}> — current</span>
            ) : null}
            {entry.status === 'tombstoned' ? (
              <span className={styles.muted}>
                {' '}
                — {entry.removalClass === 'B' ? 'removed' : 'withdrawn'}
              </span>
            ) : null}
            {entry.changeNote ? (
              <span className={styles.checkMeaning}>{entry.changeNote}</span>
            ) : null}
          </span>
          <span className={`${styles.right} ${styles.muted}`}>{entry.uploaderDisplayName}</span>
          <span className={`${styles.right} ${styles.muted} ${styles.num}`}>
            {formatDate(entry.uploadedAt)}
          </span>
        </div>
      ))}
    </div>
  )
}
