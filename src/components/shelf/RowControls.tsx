'use client'

import styles from './ShelfRow.module.css'
import { useToggleControl } from './viewer-controls'

/**
 * Slots 5 and 6 of the row: the votable upvote pill with its count, and the bookmark box.
 *
 * They are one component across two grid cells (`display: contents` on the wrapper) because
 * they are one subscription to the viewer store and one piece of reasoning — two objects
 * with two behaviours (§6.9), sharing nothing but the row they sit on.
 *
 * **Both are one element that is never swapped.** Signed-out draws the same pill, unpressed,
 * and the click routes to sign-in; signed-in fills the pressed state in from the viewer
 * response. Rendering a link for one viewer and a button for another would replace the
 * element at hydration, drop focus, and break the property the whole caching design rests
 * on — that the response changes **a fill inside a box that already exists** (§6.13).
 *
 * The magnitude bar under the pill is passed in as `children`: it is drawn on the server
 * from `programme.vote_count`, it is **not a control**, and it stays visible while the
 * viewer response is in flight — hiding it would cost a signed-in viewer every vote count on
 * the shelf for the whole delay, which is a fact about the catalogue withheld to hide a fact
 * about the viewer.
 */
export function RowControls({
  programmeId,
  title,
  voteCount,
  children,
}: {
  programmeId: string
  /** Named in both control labels, because 25 rows of "Upvote" is 25 identical labels. */
  title: string
  voteCount: number
  children: React.ReactNode
}) {
  const vote = useToggleControl(programmeId, 'voted', voteCount)
  // Bookmarks have **no counter anywhere**, so this control is passed none and prints none.
  const bookmark = useToggleControl(programmeId, 'bookmarked', 0)

  return (
    <div className={styles.controls}>
      <div className={`${styles.cell} ${styles.votes}`}>
        <button
          type="button"
          className={`${styles.pill} ${vote.pressed ? styles.pillOn : ''}`}
          aria-pressed={vote.pressed}
          aria-label={`Upvote ${title}`}
          onClick={vote.toggle}
        >
          <span aria-hidden="true">▲</span>
          <span className={styles.pillCount}>{vote.count}</span>
        </button>
        {children}
      </div>

      <div className={`${styles.cell} ${styles.save}`}>
        <button
          type="button"
          className={`${styles.bookmark} ${bookmark.pressed ? styles.bookmarkOn : ''}`}
          aria-pressed={bookmark.pressed}
          aria-label={bookmark.pressed ? `Remove ${title} from your saved` : `Save ${title}`}
          title={bookmark.pressed ? 'Saved' : 'Save'}
          onClick={bookmark.toggle}
        >
          <BookmarkGlyph filled={bookmark.pressed} />
        </button>
      </div>
    </div>
  )
}

/**
 * Icon-only in a fixed 26×26 box. Bookmarks are **private throughout** — no count, no public
 * rendering, nothing to farm — so the control carries no number and the box needs no room
 * for one. The fill is the pressed channel and the label is the other.
 */
function BookmarkGlyph({ filled }: { filled: boolean }) {
  return (
    <svg width={13} height={15} viewBox="0 0 13 15" aria-hidden="true" focusable="false">
      <path
        d="M1.5 1.5h10v12l-5-3.6-5 3.6z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  )
}
