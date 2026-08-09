import styles from './Chip.module.css'

export type ChipTone =
  /** A control: a facet value, an active-filter chip. */
  | 'control'
  /** A fact: a sector label, a P6 version, a state marker in a row or a byline. */
  | 'badge'
  /** A fact, outlined rather than filled — the quieter of the two. */
  | 'ghost'

/**
 * One chip, in every place the site draws one: the facet row, the active-filter row, the
 * row's fixed slots and the programme byline.
 *
 * Presentational and stateless. It renders an `<a>` when given an `href` and a `<span>`
 * otherwise, so a facet chip is a real link the crawler never follows (facet URLs are
 * `Disallow`ed, §7.16.1) and a fact chip is not a control pretending to be one.
 *
 * `count` exists because the shelf's facet counts are live and conjunctive, and a
 * zero-count chip is **disabled, not hidden** (§1.5) — `disabled` renders it dimmed and
 * inert rather than removing it from the row.
 *
 * There is no `verified`/`checked` tone and there never will be: badges of any kind are
 * out of scope, and §7.4 bans the vocabulary that would name one.
 */
export function Chip({
  children,
  tone = 'control',
  href,
  selected = false,
  disabled = false,
  count,
  title,
  trailing,
}: {
  children: React.ReactNode
  tone?: ChipTone
  href?: string
  selected?: boolean
  disabled?: boolean
  /** Rendered after the label in tabular figures. `0` renders as `0`, not as nothing. */
  count?: number
  title?: string
  /** A clear control, an icon — anything the caller wants inside the same pill. */
  trailing?: React.ReactNode
}) {
  const className = [
    styles.chip,
    tone === 'badge' ? styles.badge : '',
    tone === 'ghost' ? `${styles.badge} ${styles.ghost}` : '',
    selected ? styles.on : '',
    disabled ? styles.disabled : '',
  ]
    .filter(Boolean)
    .join(' ')

  const body = (
    <>
      {children}
      {count === undefined ? null : <span className={styles.count}>{count}</span>}
      {trailing}
    </>
  )

  if (href && !disabled) {
    return (
      // `aria-current`, not `aria-pressed`: a facet chip is a link to a different URL, not
      // a toggle button, and the selected one is the URL you are on.
      <a className={className} href={href} title={title} aria-current={selected || undefined}>
        {body}
      </a>
    )
  }

  return (
    <span className={className} title={title} aria-disabled={disabled || undefined}>
      {body}
    </span>
  )
}
