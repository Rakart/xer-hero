'use client'

import { OWN_SPACE_HREF } from '@/components/site/routes'
import styles from './ShelfControls.module.css'
import { useIsOwnPage, useUploaderVote } from './viewer-controls'

/**
 * The uploader upvote pill (§6.10, item 2) — **the only place an uploader vote can be
 * cast**, never from a row and never from a programme page.
 *
 * Two votable objects, two counters, two boards, and therefore no standing formula: the
 * count beside this pill is the number the leaderboard reads, raw, and nothing is summed,
 * weighted or blended into it. Self-votes are permitted; one vote, once, a constant offset
 * that reorders nothing.
 *
 * One element, never swapped, for the same reason the row's controls are: signed-out draws
 * this pill unpressed and the click routes to sign-in.
 */
export function UploaderVote({ handle, count }: { handle: string; count: number }) {
  const vote = useUploaderVote(handle, count)

  return (
    <button
      type="button"
      className={`${styles.bigPill} ${vote.pressed ? styles.bigPillOn : ''}`}
      aria-pressed={vote.pressed}
      aria-label={`Upvote ${handle}`}
      onClick={vote.toggle}
    >
      <span aria-hidden="true">▲</span>
      <span className={styles.pillCount}>{vote.count}</span>
    </button>
  )
}

/**
 * **Exactly one owner-conditional element** on this page: a link to `/me`, carrying no data,
 * mounted client-side from the viewer response like every other one (§6.10).
 *
 * There are no owner-only tabs here. Bookmarks and the voting record were originally put on
 * this page and moved to `/me`, because the Handle exists only from first upload — so the
 * download-only planner, who is the modal signed-in user, has no contributor page at all
 * and would have been unreachable.
 */
export function OwnerLink({ handle }: { handle: string }) {
  const isOwnPage = useIsOwnPage(handle)
  if (!isOwnPage) return null
  return (
    <a className={styles.ownerLink} href={OWN_SPACE_HREF}>
      Your uploads →
    </a>
  )
}
