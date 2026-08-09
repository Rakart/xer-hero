import { CC_BY_URL, FOOTER_LINKS } from './routes'
import styles from './SiteFooter.module.css'

/**
 * The site-wide footer, in the root layout, on every route including `/p/{slug}` and
 * everything under `/me` (§7.14).
 *
 * **Exactly six links and one sentence.** It is static and viewer-independent, so it does
 * not touch the cacheability of a signed-out public render. It is site-wide because most
 * arrivals are a shared `/p/{slug}` rather than `/`, and the privacy policy must be
 * reachable without login from any entry point.
 *
 * Refused, each with a reason in §7.14: a raw `mailto:` (it would publish the operator's
 * address to every scraper on every page — the mailbox is printed on `/report` only); a
 * licence badge image (an image asset for a sentence that fits in a sentence); the
 * catalogue count (§7.4); a cookie or consent link (nothing is set that needs consent,
 * §7.15); and repeats of `/`, `/upload` and `/me`, which the header already carries.
 */
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <nav className={styles.links} aria-label="Site">
          {FOOTER_LINKS.map((link, index) => (
            <span key={link.href}>
              {index > 0 ? <span className={styles.dot}>·</span> : null}
              <a href={link.href}>{link.label}</a>
            </span>
          ))}
        </nav>
        <p className={styles.sentence}>
          Programmes are published by their uploaders under <a href={CC_BY_URL}>CC-BY 4.0</a>. This
          site&rsquo;s code is Apache-2.0. Run by one person, best effort, with no warranty &mdash;
          see <a href="/terms">the terms</a>.
        </p>
      </div>
    </footer>
  )
}
