import { CC_BY_URL, UPLOAD_HREF } from '@/components/site'
import type { ShelfFacetCounts } from '@/lib/db/queries'
import { emptyStateCopy } from './empty-state'
import styles from './ShelfControls.module.css'
import { type ShelfParams, shelfHref } from './shelf-url'

export interface TitleSuggestion {
  slug: string
  title: string
}

/**
 * The empty shelf (§6.2).
 *
 * Four parts, and each earns its line: it names the filters that produced it, explains the
 * reason where the data model makes the combination inevitable, offers the one filter worth
 * clearing, and falls back to uploading. An empty page that says only "no results" leaves
 * the visitor to work out which of four facets did it.
 *
 * The did-you-mean beside it is the `pg_trgm` similarity fallback on `title`, run **only**
 * when full-text returns zero rows — so one stemmed miss ("depot" versus "depots") is a
 * suggestion rather than an empty shelf. It suggests; it never silently swaps the rows.
 */
export function EmptyState({
  params,
  counts,
  relaxed,
  suggestions,
}: {
  params: ShelfParams
  counts: ShelfFacetCounts
  /** The same counts with the progress filter dropped, or `null` when it is off. */
  relaxed: ShelfFacetCounts | null
  suggestions: TitleSuggestion[]
}) {
  const copy = emptyStateCopy(params, counts, relaxed)

  return (
    <div className={styles.empty}>
      <p className={styles.emptyHead}>{copy.headline}</p>
      {copy.filterLine || copy.reason ? (
        <p className={styles.emptyBody}>
          {copy.filterLine} {copy.reason}
        </p>
      ) : null}

      {suggestions.length > 0 ? (
        <p className={styles.emptyBody}>
          Did you mean{' '}
          {suggestions.map((suggestion, index) => (
            <span key={suggestion.slug}>
              {index > 0 ? ', ' : ''}
              <a href={`/p/${suggestion.slug}`}>{suggestion.title}</a>
            </span>
          ))}
          ?
        </p>
      ) : null}

      <p className={styles.emptyActions}>
        {copy.clear ? (
          <a className={styles.emptyPrimary} href={shelfHref(copy.clear.params)}>
            {copy.clear.label}
          </a>
        ) : null}
        <span className={styles.emptyFallback}>
          {copy.clear ? 'or ' : ''}
          <a href={UPLOAD_HREF}>upload a programme</a> — it publishes under{' '}
          <a href={CC_BY_URL}>CC-BY 4.0</a> and appears here immediately.
        </span>
      </p>
    </div>
  )
}
