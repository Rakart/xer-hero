import { HeaderCluster, HeaderNotice } from './HeaderCluster'
import { HeaderMetrics } from './HeaderMetrics'
import { SITE_NAME, SITE_STRAP } from './routes'
import styles from './SiteHeader.module.css'

/**
 * The site header, on every route: a wordmark, a permanent one-line strap, and the
 * signed-in cluster. **It does not grow** (§1.5).
 *
 * The strap stays at one line and renders everywhere, including `/p/{slug}`, where a
 * sign-in disclosure has no business — which is why the Google purpose statement lives in
 * the home lede on `/` and not here (§7.13).
 *
 * No logo and no wordmark image: none exists, and a text wordmark is one string (§7.14).
 *
 * It is frozen to the top of the viewport on every route, and `HeaderMetrics` publishes the
 * height it settles at so that the bands beneath it can freeze under it rather than behind it.
 */
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <HeaderMetrics />
      <div className={styles.bar}>
        <a className={styles.wordmark} href="/">
          {SITE_NAME}
        </a>
        <span className={styles.strap}>{SITE_STRAP}</span>
        <span className={styles.spacer} />
        <HeaderCluster />
      </div>
      <HeaderNotice />
    </header>
  )
}
