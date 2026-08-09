'use client'

/**
 * The action cluster and the revision selector (§6.7 items 5–6, §6.9, §6.13).
 *
 * **No public route reads the session on the server.** This page ships its signed-out
 * render to the CDN, byte-identical for every viewer, so both controls are drawn here — at
 * their fixed x, in the cached HTML — and the viewer response changes *a fill inside a box
 * that already exists*. The measured layout shift is `Δx 0.00 · Δw 0.00 · Δy 0.00`, which
 * only holds because the bookmark's label makes it wider than an icon and its box is
 * pinned; without the pin, `Fork` and `Download` would be pushed sideways when the response
 * lands.
 *
 * The **late-pressed rule** is implemented here and not assumed: the snapshot may be older
 * than the viewer's own clicks, so a control the viewer has touched since paint is *dirty*
 * and the response fills only untouched ones. Generalised: any late-arriving snapshot must
 * merge against local intent, never overwrite it.
 *
 * **No uploader vote pill on this page.** The uploader is votable only from the contributor
 * page — a person-pill beside a programme-pill is two upvote buttons on one screen meaning
 * different things.
 */

import { useCallback, useEffect, useState } from 'react'
// The shelf owns the endpoint constants because its row was the first caller. Importing them
// rather than restating them is what stops the two surfaces pointing at different URLs.
import { BOOKMARKS_ENDPOINT, VOTES_ENDPOINT } from '@/components/shelf/viewer-controls'
import { requestViewerState, SIGN_IN_HREF, type ViewerState } from '@/components/site'
import { formatBytes, formatCount } from './format'
import styles from './programme.module.css'
import type { ProgrammeView, RevisionEntry } from './types'

/**
 * The write half of both controls.
 *
 * A caller may pass a Server Function to override it, but it is **not required to**: the
 * defaults below post to the same two endpoints the shelf row posts to. That is the point —
 * §6.9 makes the upvote and the bookmark two objects with two behaviours, and it would be a
 * poor reading of that to give one of them two implementations depending on which page it is
 * drawn on. The endpoint constants are imported from the shelf rather than restated so the
 * two surfaces cannot end up pointing at different URLs.
 */
export type ToggleAction = (programmeId: string, next: boolean) => Promise<void>

/**
 * Both endpoints take the **desired** state rather than a toggle and return the settled one,
 * so a double-click, a retry and a replayed request all reach the same number. A `401` means
 * the cookie said signed in and the server disagreed — an expired session, or a click in the
 * window before the cookie probe ran — and routes to sign-in exactly as a signed-out click.
 */
async function post(endpoint: string, body: Record<string, unknown>): Promise<void> {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (response.status === 401) {
    window.location.assign(SIGN_IN_HREF)
    return
  }
  if (!response.ok) throw new Error(`${endpoint} ${response.status}`)
}

const defaultVoteAction: ToggleAction = (programmeId, next) =>
  post(VOTES_ENDPOINT, { target: 'programme', programmeId, pressed: next })

const defaultBookmarkAction: ToggleAction = (programmeId, next) =>
  post(BOOKMARKS_ENDPOINT, { programmeId, pressed: next })

type Pressed = boolean | 'unknown'

function useViewerFlags(programmeId: string) {
  const [state, setState] = useState<ViewerState | null | 'pending'>('pending')
  useEffect(() => requestViewerState([programmeId], setState), [programmeId])
  return state
}

export function ActionCluster({
  view,
  voteAction,
  bookmarkAction,
}: {
  view: ProgrammeView
  voteAction?: ToggleAction
  bookmarkAction?: ToggleAction
}) {
  const vote = voteAction ?? defaultVoteAction
  const bookmark = bookmarkAction ?? defaultBookmarkAction
  const viewer = useViewerFlags(view.programmeId)
  const [voted, setVoted] = useState<Pressed>('unknown')
  const [saved, setSaved] = useState<Pressed>('unknown')
  const [votedDirty, setVotedDirty] = useState(false)
  const [savedDirty, setSavedDirty] = useState(false)
  const [votes, setVotes] = useState(view.voteCount)

  // Merge, never overwrite (§6.13 rule 4).
  useEffect(() => {
    if (viewer === 'pending') return
    const state = viewer
    if (!votedDirty) setVoted(state ? state.voted.includes(view.programmeId) : false)
    if (!savedDirty) setSaved(state ? state.bookmarked.includes(view.programmeId) : false)
  }, [viewer, votedDirty, savedDirty, view.programmeId])

  const signedIn = viewer !== 'pending' && viewer !== null

  const toggle = useCallback(
    async (
      action: ToggleAction | undefined,
      current: Pressed,
      setPressed: (next: Pressed) => void,
      setDirty: (next: boolean) => void,
      delta: ((next: boolean) => void) | null,
    ) => {
      // Signed out — and *unknown* is drawn as signed out, so the first click on a page
      // whose viewer response has not landed still routes somewhere useful (§6.9).
      if (!signedIn) {
        window.location.assign(SIGN_IN_HREF)
        return
      }
      if (!action) return
      const next = current !== true
      setDirty(true)
      setPressed(next)
      delta?.(next)
      try {
        await action(view.programmeId, next)
      } catch {
        setPressed(current)
        delta?.(!next)
      }
    },
    [signedIn, view.programmeId],
  )

  return (
    <div className={styles.actions}>
      {/* The public count lives inside the pill, so the pill is never hidden while the
          viewer response is in flight: the count is a fact about the catalogue rather than
          about the viewer, and hiding it costs more than a late fill does. */}
      <button
        type="button"
        className={`${styles.button} ${styles.vote} ${voted === true ? styles.votePressed : ''}`}
        aria-pressed={voted === true}
        aria-label={`Upvote this programme. ${formatCount(votes)} upvotes`}
        onClick={() => {
          void toggle(vote, voted, setVoted, setVotedDirty, (next) =>
            setVotes((n) => n + (next ? 1 : -1)),
          )
        }}
      >
        ▲ <b>{formatCount(votes)}</b>
      </button>

      {/* Private throughout: no count, no public rendering, nothing to farm (§6.9). */}
      <button
        type="button"
        className={`${styles.button} ${styles.bookmark} ${saved === true ? styles.votePressed : ''}`}
        aria-pressed={saved === true}
        onClick={() => {
          void toggle(bookmark, saved, setSaved, setSavedDirty, null)
        }}
      >
        🔖 {saved === true ? 'Saved' : 'Save'}
      </button>

      <a className={styles.button} href={`/p/${view.slug}/fork`}>
        Fork
      </a>

      {/*
        `rel="nofollow"` is required on this link (§7.9). It is one of three properties that
        express one rule — the PI-bearing object is served under different terms — alongside
        the object's own one-hour TTL and its `noindex, noarchive` header. The gzipped size
        is printed because that is what the user waits for.
      */}
      <a
        className={`${styles.button} ${styles.buttonPrimary}`}
        href={view.downloadUrl}
        rel="nofollow"
      >
        Download .xer
        {view.originalGzBytes === null ? null : (
          <span className={styles.size}>{formatBytes(view.originalGzBytes)} gz</span>
        )}
      </a>
    </div>
  )
}

/**
 * `r23 — current`, newest first, with the tombstoned revisions **listed and disabled**
 * carrying their removal wording: a gap in a numbered series is more alarming than a
 * labelled one.
 *
 * Pending and failed revisions are filtered out here rather than at the query, because they
 * are owner-visible state and this control is public.
 */
export function RevisionSelector({ view }: { view: ProgrammeView }) {
  const entries = view.revisions.filter(
    (entry) => entry.status === 'published' || entry.status === 'tombstoned',
  )

  return (
    <div className={styles.revisionRow}>
      <select
        aria-label="Revision"
        className={styles.select}
        value={String(view.revision.revNo)}
        onChange={(event) => {
          const revNo = Number(event.target.value)
          window.location.assign(
            revNo === view.currentRevNo ? `/p/${view.slug}` : `/p/${view.slug}/r/${revNo}`,
          )
        }}
      >
        {entries.map((entry) => (
          <option
            key={entry.revNo}
            value={String(entry.revNo)}
            disabled={entry.status === 'tombstoned'}
          >
            {revisionOptionLabel(entry, view.currentRevNo)}
          </option>
        ))}
      </select>

      {/*
        Present and deliberately inert (§6.7). It is a seam rather than a stub with a missing
        backend: a diff needs nothing added to either contract — it reads two `derived.json`
        files, whose buckets are fixed precisely so they subtract, and two `activities.json`
        files keyed on `task_code`. It is a button rather than a tab because two
        `activities.json` fetches are 680 KB gzipped: acceptable for an explicit action,
        unacceptable as a default.
      */}
      <button
        type="button"
        className={`${styles.button} ${styles.buttonSmall} ${styles.buttonInert}`}
        disabled
        title="Not in v1. The two revisions a diff would read are already at their own URLs."
      >
        Compare…
      </button>
    </div>
  )
}

function revisionOptionLabel(entry: RevisionEntry, currentRevNo: number | null): string {
  if (entry.status === 'tombstoned') {
    return `r${entry.revNo} — ${entry.removalClass === 'B' ? 'removed' : 'withdrawn'}`
  }
  return entry.revNo === currentRevNo ? `r${entry.revNo} — current` : `r${entry.revNo}`
}
