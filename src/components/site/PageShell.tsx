import styles from './PageShell.module.css'

/**
 * The one width-and-rhythm wrapper every page sits in, so the shelf, the programme page
 * and the static pages share one left edge.
 *
 * Two measures and no more: `wide` is the chrome's own measure (the shelf's twelve fixed
 * slots and the programme page's charts); `prose` is the reading measure the legal texts
 * and `/about` are set to. Purely presentational — it reads nothing and decides nothing.
 */
export function PageShell({
  width = 'wide',
  title,
  lede,
  children,
}: {
  width?: 'wide' | 'prose'
  /** Rendered as the page's `h1` when given. Omit it when the page draws its own. */
  title?: string
  /** One quiet line under the title. Not a marketing slot — see §7.4. */
  lede?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className={`${styles.shell} ${width === 'prose' ? styles.prose : styles.wide}`}>
      {title ? (
        <div className={styles.head}>
          <h1 className={styles.title}>{title}</h1>
          {lede ? <p className={styles.lede}>{lede}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}
