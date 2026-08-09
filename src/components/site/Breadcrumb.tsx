import styles from './Breadcrumb.module.css'

export type Crumb = {
  label: string
  /** Omit on the last item — the page you are on is not a link to itself. */
  href?: string
}

/**
 * `shelf / {sector} / {title}`, collapsing to `shelf / {title}` when unsectored (§1.5).
 * The collapse is the caller's: this renders the items it is given, in order, and the
 * last one is rendered as text whether or not it carries an `href`.
 *
 * No `BreadcrumbList` JSON-LD — structured data is refused in v1 (§7.16.6).
 */
export function Breadcrumb({ items }: { items: readonly Crumb[] }) {
  return (
    <nav className={styles.crumb} aria-label="Breadcrumb">
      {items.map((item, index) => {
        const last = index === items.length - 1
        return (
          <span key={item.href ?? item.label}>
            {index > 0 ? <span className={styles.sep}>/</span> : null}
            {item.href && !last ? (
              <a href={item.href}>{item.label}</a>
            ) : (
              <span className={styles.current} aria-current={last ? 'page' : undefined}>
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
