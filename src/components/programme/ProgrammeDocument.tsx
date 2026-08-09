import { PageShell, SectionHeading } from '@/components/site'
import { ActionCluster, RevisionSelector, type ToggleAction } from './Actions'
import { ActivitySection } from './ActivitySection'
import { DurationHistogram, FloatPanel, OneLineCallout, SCurve, StatusMix } from './Charts'
import { CiteBlock } from './CiteBlock'
import { finishToStartPct } from './chart'
import { citation } from './cite'
import { QualityPanel, VerdictSentence } from './Dcma'
import { FactTiles } from './FactTiles'
import { formatBytes, formatCount } from './format'
import { Headline } from './Headline'
import {
  AnalysisNotes,
  CodesPanel,
  IssuesBanner,
  LineageSurface,
  LongestPathCallout,
  NoWbsPanel,
  PublicationNotice,
  WbsSummary,
} from './Panels'
import styles from './programme.module.css'
import type { ProgrammeView } from './types'

/**
 * The programme page: **one scrolling document — a dossier**.
 *
 * Three rival layouts were built and lost. *Workbench* made the activity table the page,
 * which fails because the table is the least differentiated thing here — P6 renders tables
 * better and anyone wanting rows can download the file. *Tabbed* split Structure from
 * Activities, putting the page's one real interaction across two tabs; it contributed one
 * rule, that a visitor who never reaches the table never fetches `activities.json`.
 * *Verdict* led with the DCMA scorecard and is the closest rival; it loses because DCMA
 * inverts — the real live contract fails it and the template built to pass passes it — so a
 * quality-first page teaches visitors to prefer templates. It contributed the verdict
 * sentence.
 *
 * Everything above the activity table is **server-rendered from `derived.json`** and nothing
 * recomputes on render. First paint carries every number, every chart and every check; there
 * are no skeletons above the table.
 *
 * This component is synchronous by design: the route does all the awaiting, so the whole
 * page can be rendered in a test against a fixture, which is the only way it can be checked
 * without a database.
 */
export function ProgrammeDocument({
  view,
  now = new Date(),
  voteAction,
  bookmarkAction,
}: {
  view: ProgrammeView
  /** Injected so the byline's age is deterministic in a test. */
  now?: Date
  /**
   * The authenticated writes behind the upvote and the bookmark. They belong to the account
   * surface, which owns every write; this page renders the controls and merges the viewer
   * snapshot into them. Passing them in is the whole of the wiring.
   */
  voteAction?: ToggleAction
  bookmarkAction?: ToggleAction
}) {
  const { derived } = view
  const fs = finishToStartPct(derived.logic.relationship_type_mix, derived.shape.relationship_count)

  return (
    <PageShell>
      <div className={styles.page}>
        <div className={styles.identity}>
          <Headline view={view} now={now} />
          <div className={styles.identityAside}>
            <ActionCluster view={view} voteAction={voteAction} bookmarkAction={bookmarkAction} />
            <RevisionSelector view={view} />
            <p className={styles.disclosure}>
              {view.originalGzBytes === null ? null : (
                <>{formatBytes(view.originalGzBytes)} gzipped. </>
              )}
              The download is the original file, byte for byte.
            </p>
          </div>
        </div>

        {view.isCurrentRevision ? null : (
          <div className={styles.callout}>
            You are reading <b>revision {view.revision.revNo}</b>, which is not the current one.{' '}
            <a href={`/p/${view.slug}`}>Go to r{view.currentRevNo}</a>, the revision this programme
            now points at.
          </div>
        )}

        <IssuesBanner derived={derived} />

        <FactTiles derived={derived} />
        <VerdictSentence quality={derived.quality} />

        <SectionHeading id="shape">The shape of the programme</SectionHeading>
        <div className={`${styles.card} ${styles.pad}`}>
          <div className={styles.chartTitle}>Activities finished, cumulative</div>
          <div className={styles.chartSub}>
            by month · {derived.distributions.s_curve.cumulative.length} buckets ·{' '}
            {derived.time.data_date
              ? 'the rule marks the data date'
              : 'no data date — nothing has started'}{' '}
            · whole programme, not the table&rsquo;s filters
          </div>
          <SCurve curve={derived.distributions.s_curve} dataDate={derived.time.data_date} />
          <OneLineCallout dataDate={derived.time.data_date} />
        </div>

        <div className={styles.grid2}>
          <div className={`${styles.card} ${styles.pad}`}>
            <div className={styles.chartTitle}>Total float</div>
            <div className={styles.chartSub}>
              fixed buckets, so two revisions stay comparable · band bar for the shape, table for
              the values
            </div>
            <FloatPanel histogram={derived.distributions.float_histogram} />
          </div>

          <div className={`${styles.card} ${styles.pad}`}>
            <div className={styles.chartTitle}>Original duration</div>
            <div className={styles.chartSub}>
              fixed buckets · DCMA 8 flags anything over 44 days
            </div>
            <DurationHistogram histogram={derived.distributions.duration_histogram} />
            <div className={styles.chartTitle}>Status</div>
            <StatusMix progress={derived.progress} />
          </div>
        </div>

        <SectionHeading id="quality">Schedule quality — DCMA 14-point</SectionHeading>
        <QualityPanel
          quality={derived.quality}
          counts={{
            activities: derived.shape.activity_count,
            relationships: derived.shape.relationship_count,
          }}
          finishToStart={fs}
        />
        <LongestPathCallout logic={derived.logic} />

        <SectionHeading id="activities">The activities</SectionHeading>
        {derived.shape.wbs_depth > 1 ? (
          <div className={styles.grid2}>
            <WbsSummary derived={derived} />
            <div className={`${styles.card} ${styles.pad}`}>
              <div className={styles.chartTitle}>Activity codes</div>
              <div className={styles.chartSub}>types enumerated, values not</div>
              <CodesPanel codes={derived.codes} />
            </div>
          </div>
        ) : null}
        <div className={styles.tilesRow}>
          <ActivitySection
            activitiesUrl={view.activitiesUrl}
            activityCount={derived.shape.activity_count}
            wbsDepth={derived.shape.wbs_depth}
            noWbsPanel={<NoWbsPanel derived={derived} />}
          />
        </div>

        {derived.shape.wbs_depth === 1 ? (
          <>
            <SectionHeading id="codes">Activity codes</SectionHeading>
            <div className={`${styles.card} ${styles.pad}`}>
              <CodesPanel codes={derived.codes} />
            </div>
          </>
        ) : null}

        <SectionHeading id="lineage">Revisions and lineage</SectionHeading>
        <LineageSurface view={view} />

        <SectionHeading id="reuse">Download, reuse and attribution</SectionHeading>
        <div className={`${styles.card} ${styles.pad}`}>
          <PublicationNotice />
          <div className={styles.chartTitle}>Cite this programme</div>
          <div className={styles.chartSub}>
            {formatCount(view.voteCount)} upvotes · published under{' '}
            {view.licence === 'CC-BY-4.0' ? 'CC BY 4.0' : view.licence} · attribution is generated
            from the lineage this site already holds, so the file itself is never modified
          </div>
          <CiteBlock
            citation={citation({
              title: view.title,
              handle: view.revision.uploaderDisplayName,
              revNo: view.revision.revNo,
              url: view.citationUrl,
              licence: view.licence,
            })}
          />
          <AnalysisNotes derived={derived} />
        </div>
      </div>
    </PageShell>
  )
}
