'use client'

/**
 * The browser half of §6.13: **one** `GET /api/viewer` per page load, ever.
 *
 * Every public page ships its signed-out render to the CDN and is byte-identical for
 * every viewer; no public route reads the session on the server. Everything
 * viewer-dependent — the header cluster, the header notice, the two pressed states per
 * shelf row, the owner link on `/u/{handle}` — is filled in from a single response.
 *
 * "Single" is the whole cost case, so it is enforced here rather than trusted: callers
 * register the programme ids they care about, the request is deferred to the end of the
 * task, and every registration made before it fires rides along on the same fetch. A
 * second caller mounting later gets the settled snapshot without a second request.
 *
 * Two properties this module must keep true, both with CI assertions behind them:
 *   - a signed-out visitor, a crawler and a link unfurler issue **zero** requests
 *     (`ci.viewer.signed_out_is_zero_requests`), which is why the session probe below
 *     runs before anything is scheduled;
 *   - the response is a snapshot that may be older than the viewer's own clicks, so it
 *     **merges against local intent and never overwrites it** (§6.13 rule 4). The merge
 *     itself belongs to whichever control owns the click; this module only guarantees
 *     the snapshot arrives once and arrives late.
 *
 * The endpoint itself is another agent's; this file only calls it.
 */

/**
 * The payload shape and the id cap come from `lib/auth/viewer-state`, which is deliberately
 * free of `next/*`, Clerk and the database so this client bundle can import it without
 * dragging a server graph in behind it. Restating them here — as an earlier draft did — is
 * how the endpoint and its only caller end up disagreeing about the response.
 */
import { VIEWER_MAX_IDS as MAX_IDS, type ViewerState } from '@/lib/auth/viewer-state'

export type { ViewerState }

/**
 * Clerk's session cookie is `HttpOnly` and cannot be read here. `__client_uat` is the
 * one Clerk sets readable precisely so a client can tell signed-in from signed-out
 * without a round trip: `0` means signed out. Production instances suffix it.
 */
export function hasClerkSession(): boolean {
  if (typeof document === 'undefined') return false
  for (const part of document.cookie.split(';')) {
    const [rawName, rawValue] = part.split('=')
    const name = rawName?.trim() ?? ''
    if (name === '__client_uat' || name.startsWith('__client_uat_')) {
      const value = (rawValue ?? '').trim()
      if (value !== '' && value !== '0') return true
    }
  }
  return false
}

type Listener = (state: ViewerState | null) => void

let pendingIds: Set<string> | null = null
let scheduled = false
let settled = false
let snapshot: ViewerState | null = null
const listeners = new Set<Listener>()

async function fetchViewer(ids: string[]): Promise<ViewerState | null> {
  const query = ids.length > 0 ? `?p=${ids.slice(0, MAX_IDS).join(',')}` : ''
  try {
    const response = await fetch(`/api/viewer${query}`, {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    })
    if (!response.ok) return null
    return (await response.json()) as ViewerState
  } catch {
    // A failed viewer request leaves the signed-out render standing, which is a correct
    // page rather than a broken one. There is nowhere to report it to: no analytics, and
    // runtime logs are kept for one hour (§7.15).
    return null
  }
}

function schedule() {
  if (scheduled) return
  scheduled = true
  // End of task, not end of microtask: every component that mounts in this commit —
  // header cluster first, then twenty-five rows — has registered by then.
  setTimeout(() => {
    const ids = [...(pendingIds ?? [])]
    pendingIds = null
    void fetchViewer(ids).then((state) => {
      settled = true
      snapshot = state
      for (const listener of listeners) listener(state)
    })
  }, 0)
}

/**
 * Register interest in the viewer's state, optionally for a set of programme ids.
 *
 * Returns an unsubscribe function, so it drops straight into a `useEffect`. The listener
 * is called at most once, with the response or with `null` — `null` meaning signed out,
 * or a request that failed and left the signed-out render standing.
 */
export function requestViewerState(
  programmeIds: readonly string[],
  listener: Listener,
): () => void {
  if (!hasClerkSession()) return () => {}

  if (settled) {
    listener(snapshot)
    return () => {}
  }

  listeners.add(listener)
  if (programmeIds.length > 0) {
    pendingIds ??= new Set()
    for (const id of programmeIds) pendingIds.add(id)
  }
  schedule()

  return () => {
    listeners.delete(listener)
  }
}

/** Test seam only — resets the module between cases. Never called by the app. */
export function __resetViewerStore() {
  pendingIds = null
  scheduled = false
  settled = false
  snapshot = null
  listeners.clear()
}
