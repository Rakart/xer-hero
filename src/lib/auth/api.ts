/**
 * The three lines every authenticated route handler repeats (§6.1).
 *
 * `/api` is inside the `clerkMiddleware` matcher but is **not** blanket-protected there: the
 * sweep authenticates with a bearer secret rather than a session, and `/api/viewer` answers a
 * stale cookie with the signed-out payload instead of a redirect. Each handler states its own
 * gate, and these are the shapes it states it in.
 */

/** Nothing under `/api` is ever cached, and `/api/` is `Disallow`ed in `robots.txt` (§6.13). */
export const NO_STORE: Record<string, string> = { 'cache-control': 'private, no-store' }

export function jsonResponse<T>(body: T, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE })
}

/**
 * One sentence, no stack, no identifiers. What reaches a browser here is read by an uploader
 * mid-upload, and §7.4 governs the register as much as it governs a page.
 */
export function jsonError(status: number, error: string): Response {
  return jsonResponse({ error }, status)
}

/** A body that is not JSON is a client bug, and it is answered as one rather than thrown. */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}
