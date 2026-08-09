import { sectorLabel } from '@/lib/contracts/domain'
import styles from './me.module.css'
import {
  type MeLineInput,
  meLineAction,
  meLineChip,
  meLineClause,
  meLineLinks,
  meLineState,
  shortAge,
} from './me-index'

/**
 * One line of `/me`'s index (§6.12): **title · state chip · clause · rev · sector · age**.
 *
 * There is no withdraw control, bulk action, edit or delete on this page. `/me` **writes
 * nothing about a Programme** — every Programme-scoped write lives on that Programme's own
 * page — because a list of your own work with a row-level destructive control is one misclick
 * from an irreversible byte deletion.
 */
export interface ProgrammeLineProps extends MeLineInput {
  slug: string
  title: string
  sector: string | null
  revNo: number | null
  failureReason: string | null
  createdAt: Date
}

export function ProgrammeLine(props: ProgrammeLineProps) {
  const state = meLineState(props)
  const chip = meLineChip(state)
  const clause = meLineClause(state, props.failureReason)
  const action = meLineAction(state)
  const label = sectorLabel(props.sector)

  return (
    <div className={styles.line}>
      <div className={styles.title}>
        {meLineLinks(state) ? <a href={`/p/${props.slug}`}>{props.title}</a> : props.title}
        {chip ? (
          <span
            className={`${styles.chip} ${state === 'failed' ? styles.chipBad : ''}`}
            // The chip is a fact about the row, not a control; it is never a link.
          >
            {chip}
          </span>
        ) : null}
      </div>
      <span className={styles.rev}>{props.revNo ? `r${props.revNo}` : ''}</span>
      <span className={styles.sector}>{label ?? ''}</span>
      <span className={styles.age}>{shortAge(props.createdAt)}</span>
      {clause ? (
        <p className={styles.clause}>
          {clause}
          {action ? (
            <>
              {' '}
              <a href={action.href}>{action.label}</a>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}
