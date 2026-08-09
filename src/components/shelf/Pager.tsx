import styles from './ShelfControls.module.css'
import { pageCountFor, type ShelfParams, shelfHref, withPage } from './shelf-url'

/**
 * Numbered pages at 25, offset pagination (§6.3).
 *
 * Infinite scroll is rejected: it breaks the back button and it is invisible to a crawler.
 * Offset rather than keyset is deliberate — `offset 9975 limit 25` is trivial at the 10k
 * ceiling, and offset is what makes `page=3` a real URL.
 *
 * **At launch page 1 holds everything and no pagination chrome renders**, which is what the
 * early return is.
 *
 * `rel=next` / `rel=prev` are rendered as real `<link>` elements and hoisted into the head;
 * Next's metadata API has no field for them. `page` is deliberately absent from
 * `robots.txt`'s disallow list, so `/?page=3` stays crawlable and this sequence is the
 * crawl path through the catalogue (§7.16.1).
 */
export function Pager({
  params,
  total,
  basePath = '/',
}: {
  params: ShelfParams
  total: number
  basePath?: string
}) {
  const pages = pageCountFor(total)
  if (pages <= 1) return null

  const current = Math.min(params.page, pages)
  const numbers = pageNumbers(current, pages)

  return (
    <>
      {current > 1 ? (
        <link rel="prev" href={shelfHref(withPage(params, current - 1), basePath)} />
      ) : null}
      {current < pages ? (
        <link rel="next" href={shelfHref(withPage(params, current + 1), basePath)} />
      ) : null}

      <nav className={styles.pager} aria-label="Pages">
        {current > 1 ? (
          <a
            className={styles.pageLink}
            href={shelfHref(withPage(params, current - 1), basePath)}
            rel="prev"
          >
            ← Previous
          </a>
        ) : (
          <span className={`${styles.pageLink} ${styles.pageOff}`}>← Previous</span>
        )}

        <span className={styles.pageNumbers}>
          {numbers.map((number, index) =>
            number === null ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: the gaps have no identity
              <span key={`gap-${index}`} className={styles.gap}>
                …
              </span>
            ) : number === current ? (
              <span
                key={number}
                className={`${styles.pageLink} ${styles.pageOn}`}
                aria-current="page"
              >
                {number}
              </span>
            ) : (
              <a
                key={number}
                className={styles.pageLink}
                href={shelfHref(withPage(params, number), basePath)}
              >
                {number}
              </a>
            ),
          )}
        </span>

        {current < pages ? (
          <a
            className={styles.pageLink}
            href={shelfHref(withPage(params, current + 1), basePath)}
            rel="next"
          >
            Next →
          </a>
        ) : (
          <span className={`${styles.pageLink} ${styles.pageOff}`}>Next →</span>
        )}
      </nav>
    </>
  )
}

/**
 * First, last, and the current page with a neighbour each side; `null` is a gap. The set is
 * fixed-width on purpose — a pager that grows with the catalogue is a row that flows.
 */
export function pageNumbers(current: number, pages: number): (number | null)[] {
  const wanted = new Set([1, pages, current - 1, current, current + 1])
  const shown = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)

  const out: (number | null)[] = []
  let previous = 0
  for (const n of shown) {
    if (previous && n - previous > 1) out.push(null)
    out.push(n)
    previous = n
  }
  return out
}
