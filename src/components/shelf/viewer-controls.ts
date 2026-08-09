'use client'

/**
 * The browser half of the two per-viewer controls on a row, and of the uploader pill on a
 * contributor page (§6.9, §6.13).
 *
 * No public page reads the session on the server, so every control ships its **signed-out
 * render** inside the cached HTML and is filled in here from the single `GET /api/viewer`
 * response. Both boxes are already drawn at their fixed x before the response lands, so what
 * arrives changes a fill inside a box that already exists — `Δx 0.00 · Δw 0.00 · Δy 0.00`,
 * measured on the prototype.
 *
 * The rule that is easy to get wrong, §6.13 rule 4: **a late-arriving snapshot must merge
 * against local intent, never overwrite it.** The controls are live before the response
 * lands and a click during the window really does write; a snapshot taken *before* that
 * click would push the control back to unset, the viewer would click again, and the second
 * click would toggle the true state off. So a control the viewer has touched since paint
 * keeps its local value, and the snapshot fills only untouched ones.
 *
 * `visibility: hidden` until the response lands is rejected for the pill specifically: the
 * public vote count lives inside it, and hiding it would cost a signed-in viewer every count
 * on the shelf for the whole delay — a fact about the catalogue withheld to hide a fact
 * about the viewer.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { SIGN_IN_HREF } from '@/components/site/routes'
// The store's own module rather than the chrome's barrel: this is a client boundary, and
// the barrel would pull every server component it re-exports across it.
import {
  hasClerkSession,
  requestViewerState,
  type ViewerState,
} from '@/components/site/viewer-store'

/**
 * The two writes behind these controls. Both are the auth surface's, both take the
 * **desired** state rather than a toggle, and both return the settled state — so an
 * optimistic control lands on the server's answer rather than on its own guess, and a
 * double-click, a retry and a replayed request all reach the same number.
 *
 *   POST /api/votes     {target:'programme', programmeId, pressed} -> {pressed, count}
 *   POST /api/votes     {target:'uploader',  handle,      pressed} -> {pressed, count}
 *   POST /api/bookmarks {programmeId, pressed}                     -> {pressed}
 *
 * A vote deliberately invalidates nothing (§4.6.4): a stale `vote_count` reorders nothing
 * under a frozen newest-first order.
 */
export const VOTES_ENDPOINT = '/api/votes'
export const BOOKMARKS_ENDPOINT = '/api/bookmarks'

/** Which list of the viewer response a row control reads its pressed state from. */
export type ViewerFlag = 'voted' | 'bookmarked'

export interface ToggleControl {
  /** What to draw now: the local value where the viewer has touched it, else the snapshot. */
  pressed: boolean
  /** The count to print — the endpoint's number once a click has settled, else the row's. */
  count: number
  /** True once the browser can tell the viewer is signed out; the click routes to sign-in. */
  signedOut: boolean
  toggle: () => void
}

interface Settled {
  pressed: boolean
  count?: number
}

/**
 * Whether this viewer is signed out, as far as the browser can tell without a round trip.
 *
 * `false` until the effect runs, because the server render is the signed-out one and this
 * value decides only where a *click* goes — and there is no click before hydration. The
 * cookie is a heuristic, so a write that comes back `401` routes to sign-in as well.
 */
function useSignedOut(): boolean {
  const [signedOut, setSignedOut] = useState(false)
  useEffect(() => {
    setSignedOut(!hasClerkSession())
  }, [])
  return signedOut
}

/**
 * Where a signed-out click goes. `/me` is the one surface inside the `clerkMiddleware`
 * matcher, so it is what can redirect to Clerk and come back; §1.5's URL set is closed and
 * no `/sign-in` route is invented.
 */
function signIn(): void {
  window.location.href = SIGN_IN_HREF
}

async function post(endpoint: string, body: Record<string, unknown>): Promise<Settled | null> {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  // The cookie said signed in and the server disagreed — an expired session, or a click in
  // the window before the cookie probe ran. Same destination either way.
  if (response.status === 401) {
    signIn()
    return null
  }
  if (!response.ok) throw new Error(`${endpoint} ${response.status}`)
  const settled = (await response.json()) as Record<string, unknown>
  if (typeof settled.pressed !== 'boolean') throw new Error(`${endpoint} malformed`)
  return {
    pressed: settled.pressed,
    count: typeof settled.count === 'number' ? settled.count : undefined,
  }
}

/**
 * One row control. It registers its own programme id with the store, which batches every
 * registration made in the same commit — twenty-five rows, fifty controls, one request.
 */
export function useToggleControl(
  programmeId: string,
  flag: ViewerFlag,
  serverCount: number,
): ToggleControl {
  const [snapshot, setSnapshot] = useState<ViewerState | null>(null)
  const [local, setLocal] = useState<boolean | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const inFlight = useRef(false)
  const signedOut = useSignedOut()

  useEffect(() => requestViewerState([programmeId], setSnapshot), [programmeId])

  const known = snapshot ? snapshot[flag].includes(programmeId) : null
  // Local intent wins; the snapshot fills only what the viewer has not touched.
  const pressed = local ?? known ?? false
  const shown = count ?? serverCount

  const toggle = useCallback(() => {
    if (inFlight.current) return
    if (signedOut) return signIn()
    const next = !pressed
    setLocal(next)
    setCount(Math.max(0, shown + (next ? 1 : -1)))
    inFlight.current = true
    const endpoint = flag === 'voted' ? VOTES_ENDPOINT : BOOKMARKS_ENDPOINT
    const body =
      flag === 'voted'
        ? { target: 'programme', programmeId, pressed: next }
        : { programmeId, pressed: next }
    void post(endpoint, body)
      .then((settled) => {
        if (!settled) return
        setLocal(settled.pressed)
        if (settled.count !== undefined) setCount(settled.count)
      })
      .catch(() => {
        // A failed write leaves the control where it was. There is nowhere to report it to —
        // no analytics, and runtime logs are kept for one hour (§7.15) — so the control tells
        // the truth by reverting rather than by holding an intent that was never written.
        setLocal(known)
        setCount(null)
      })
      .finally(() => {
        inFlight.current = false
      })
  }, [flag, known, pressed, programmeId, shown, signedOut])

  return { pressed, count: shown, signedOut, toggle }
}

/**
 * The uploader pill on `/u/{handle}` — the **only** place an uploader vote can be cast,
 * never from a row and never from a programme page (§1.7).
 *
 * GAP: `GET /api/viewer` carries `voted` for Programmes only, so nothing in the response
 * says whether this viewer has already upvoted this uploader. The pill therefore renders
 * unpressed on arrival even for someone who has voted. It cannot inflate the count: the
 * write is one row against a unique `(voter, subject)` key and the endpoint returns the
 * authoritative number, which this settles on.
 */
export function useUploaderVote(handle: string, serverCount: number): ToggleControl {
  const [pressed, setPressed] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const inFlight = useRef(false)
  const signedOut = useSignedOut()

  const shown = count ?? serverCount

  const toggle = useCallback(() => {
    if (inFlight.current) return
    if (signedOut) return signIn()
    const next = !pressed
    setPressed(next)
    setCount(Math.max(0, shown + (next ? 1 : -1)))
    inFlight.current = true
    void post(VOTES_ENDPOINT, { target: 'uploader', handle, pressed: next })
      .then((settled) => {
        if (!settled) return
        setPressed(settled.pressed)
        if (settled.count !== undefined) setCount(settled.count)
      })
      .catch(() => {
        setPressed(!next)
        setCount(null)
      })
      .finally(() => {
        inFlight.current = false
      })
  }, [handle, pressed, shown, signedOut])

  return { pressed, count: shown, signedOut, toggle }
}

/**
 * The one owner-conditional element on `/u/{handle}`: a link to `/me`, carrying no data
 * (§6.10). Mounted client-side from the viewer response like every other one — a public
 * render that branches on viewer identity is the shape of bug that leaks private data into a
 * shared path.
 */
export function useIsOwnPage(handle: string): boolean {
  const [viewer, setViewer] = useState<ViewerState | null>(null)
  useEffect(() => requestViewerState([], setViewer), [])
  return viewer?.handle?.toLowerCase() === handle.toLowerCase()
}
