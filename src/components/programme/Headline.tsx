import { Breadcrumb, CC_BY_URL, Chip } from '@/components/site'
import { licenceLabel, ROOT_LINEAGE } from './cite'
import { formatAge, plural } from './format'
import styles from './programme.module.css'
import { isPartiallyAnalysed } from './states'
import type { ProgrammeView } from './types'

/**
 * Breadcrumb, title, degenerate badges, byline and the lineage line (§6.7 items 1–4).
 *
 * The sector segment **drops when null** rather than rendering an "unsectored" crumb: blank
 * is a real state declared by the uploader and never inferred, and a crumb that names the
 * absence puts a word in the uploader's mouth. It points at the shelf's own facet URL
 * because `/sector/{code}` is specified and deliberately not built in v1 (§6.6).
 *
 * Two badges and no others. There is no verified mark, no quality mark and no "checked"
 * state anywhere in this effort (§7.4) — `no WBS` and `⚠ partially analysed` both describe
 * the file, and neither characterises it.
 */
export function Headline({ view, now }: { view: ProgrammeView; now: Date }) {
  const partial = isPartiallyAnalysed(view.derived)
  const noWbs = view.derived.shape.wbs_depth === 1

  return (
    <div className={styles.identityMain}>
      <Breadcrumb
        items={[
          { label: 'shelf', href: '/' },
          ...(view.sectorLabel && view.sectorCode
            ? [{ label: view.sectorLabel, href: `/?sector=${view.sectorCode}` }]
            : []),
          { label: view.title },
        ]}
      />

      <h1 className={styles.title}>
        {view.title}
        {noWbs ? <Chip tone="ghost">no WBS</Chip> : null}
        {partial ? (
          <Chip tone="badge">
            <span className={styles.warnBadge}>⚠ partially analysed</span>
          </Chip>
        ) : null}
      </h1>

      <div className={styles.byline}>
        <a href={`/u/${view.revision.uploaderDisplayName}`}>{view.revision.uploaderDisplayName}</a>
        <span className={styles.sep}>·</span>
        {view.sectorLabel ? <Chip tone="badge">{view.sectorLabel}</Chip> : null}
        <a href={CC_BY_URL} rel="license noopener noreferrer" target="_blank">
          <Chip tone="ghost">{licenceLabel(view.licence)}</Chip>
        </a>
        <span className={styles.sep}>·</span>
        <span>P6 {view.revision.p6Version ?? 'version not recorded'}</span>
        <span className={styles.sep}>·</span>
        <span title={view.revision.uploadedAt}>
          uploaded {formatAge(view.revision.uploadedAt, now)}
        </span>
      </div>

      <div className={`${styles.byline} ${styles.lineage}`}>
        <span className={styles.muted}>lineage</span>
        {view.lineage.parentSlug ? (
          <span>
            forked from <a href={`/p/${view.lineage.parentSlug}`}>{view.lineage.parentTitle}</a>
            {view.lineage.parentRevNo === null ? null : <> at r{view.lineage.parentRevNo}</>}
            {view.lineage.parentUploader ? (
              <>
                , by <a href={`/u/${view.lineage.parentUploader}`}>{view.lineage.parentUploader}</a>
              </>
            ) : null}
          </span>
        ) : (
          <span>{ROOT_LINEAGE}</span>
        )}
        <span className={styles.sep}>·</span>
        <a href="#lineage">{plural(view.lineage.revisionCount, 'revision')}</a>
        <span className={styles.sep}>·</span>
        <span>{plural(view.lineage.forkCount, 'fork')} of this</span>
        <span className={styles.sep}>·</span>
        <span>{view.lineage.familyCount} in the family</span>
      </div>

      {view.description ? <p className={styles.description}>{view.description}</p> : null}
    </div>
  )
}
