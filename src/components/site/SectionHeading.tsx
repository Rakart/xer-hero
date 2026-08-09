import styles from './SectionHeading.module.css'

/**
 * The quiet rule between sections of a long document — the programme page's band labels
 * and `/report`'s form groups. It is a heading, not a decoration, so it renders as one
 * and carries an id when the caller wants to link to it.
 */
export function SectionHeading({
  children,
  id,
  as: Tag = 'h2',
}: {
  children: React.ReactNode
  id?: string
  as?: 'h2' | 'h3'
}) {
  return (
    <Tag className={styles.section} id={id}>
      {children}
    </Tag>
  )
}
