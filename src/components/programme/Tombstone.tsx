import { Breadcrumb, PageShell } from '@/components/site'
import { TOMBSTONE_COPY, tombstoneKind } from './cite'
import styles from './programme.module.css'
import type { TombstoneView } from './types'

/**
 * A tombstoned programme or revision (§5.11, §7.16.4).
 *
 * **The page stays at its URL forever and stops being findable.** The row and the URL are
 * kept so that an inbound link does not rot, never so anybody can find it — a page whose
 * entire job is to answer a link somebody already holds has no business being a search
 * result. The `noindex` is emitted by the route, from a predicate over `programme.status`,
 * the instant the takedown's reversible first step commits and before a single byte is
 * deleted.
 *
 * Title and uploader stay visible **on the page**, unchanged. What is narrowed is discovery
 * off it: the Open Graph strings fall back to the site defaults, because an unfurl is the
 * same title travelling outward into a channel nobody asked.
 *
 * There are no numbers here and there cannot be: `derived.json` is destroyed with the rest
 * of the revision's prefix, so a tombstone is a different shape rather than a flag.
 *
 * The breadcrumb renders **unlinked**, including the sector segment.
 */
export function Tombstone({ view }: { view: TombstoneView }) {
  const kind = tombstoneKind(view.removalClass, view.hasTombstonedAncestor)
  const copy = TOMBSTONE_COPY[kind]

  return (
    <PageShell>
      <div className={styles.page}>
        <Breadcrumb
          items={[
            { label: 'shelf' },
            ...(view.sectorLabel ? [{ label: view.sectorLabel }] : []),
            { label: view.title },
          ]}
        />

        <h1 className={styles.title}>{view.title}</h1>
        <div className={styles.byline}>
          <span>{view.uploaderDisplayName}</span>
          {view.revNo === null ? null : (
            <>
              <span className={styles.sep}>·</span>
              <span>r{view.revNo}</span>
            </>
          )}
        </div>

        <div className={styles.tombstone}>
          <p className={styles.tombstoneHeading}>{copy.heading}</p>
          <p className={styles.tombstoneLine}>{copy.line}</p>
          <p>
            The file, its statistics and its activity data have been destroyed. This page stays at
            this address so that links to it do not break; there is nothing here to download and
            nothing to fork.
          </p>
          {view.ancestors.length > 0 ? (
            <p className={styles.chain}>
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
            </p>
          ) : null}
        </div>
      </div>
    </PageShell>
  )
}
