/**
 * The shape of `GET /api/viewer` and the two pure rules around it (§6.13).
 *
 * Isomorphic on purpose and importing nothing: the route handler builds the payload, and the
 * controls that own a click merge against it in the browser. No database, no Clerk, no
 * `next/*` — so a client bundle that needs {@link mergePressed} does not drag a server graph
 * in behind it.
 */

export interface ViewerState {
  /** `null` means signed in with no `app_user` row yet — render the signed-out controls. */
  handle: string | null
  notices: { failed: boolean; removal: boolean }
  voted: string[]
  bookmarked: string[]
}

/** The shelf page size, which is the largest number of ids one page can ask about (§6.13). */
export const VIEWER_MAX_IDS = 25

/**
 * The response is never cached, anywhere. It is the one route in the estate whose body is a
 * function of the viewer, and §4.6.2 names the header (`ci.viewer.private_no_store`).
 */
export const VIEWER_CACHE_CONTROL = 'private, no-store'

/** The signed-out payload. Also what a signed-in viewer with no `app_user` row gets. */
export const EMPTY_VIEWER_STATE: ViewerState = {
  handle: null,
  notices: { failed: false, removal: false },
  voted: [],
  bookmarked: [],
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * `?p=<uuid>,<uuid>,…` — deduplicated, uuid-shaped only, and hard-capped at 25.
 *
 * Filtering to the uuid shape is not validation theatre: the ids land in an `in` list, and a
 * bounded, well-formed list is what keeps the statement one indexed lookup rather than
 * something a caller can grow.
 */
export function parseProgrammeIds(param: string | null | undefined): string[] {
  if (!param) return []
  const seen = new Set<string>()
  for (const raw of param.split(',')) {
    const id = raw.trim().toLowerCase()
    if (UUID.test(id)) seen.add(id)
    if (seen.size >= VIEWER_MAX_IDS) break
  }
  return [...seen]
}

/**
 * **The late-pressed rule — merge, never overwrite** (§6.13 rule 4).
 *
 * The controls are live before the response lands, and the response is a snapshot that may
 * have been taken *before* a click. Applied naively it would push the control back to unset,
 * the viewer would see their own action undone, click again, and toggle the true state off.
 *
 * So the client keeps a **dirty set** of controls it has touched since paint, and the
 * snapshot fills only the untouched ones. No extra request, no schema, no change to the
 * endpoint's contract. Generalised: *any late-arriving snapshot must merge against local
 * intent.*
 */
export function mergePressed(
  snapshot: readonly string[],
  dirty: ReadonlyMap<string, boolean>,
  ids: readonly string[],
): Map<string, boolean> {
  const pressed = new Set(snapshot)
  const merged = new Map<string, boolean>()
  for (const id of ids) {
    const touched = dirty.get(id)
    merged.set(id, touched === undefined ? pressed.has(id) : touched)
  }
  return merged
}
