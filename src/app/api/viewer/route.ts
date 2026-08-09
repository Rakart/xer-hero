import { and, eq, exists, gt, inArray, type SQL, sql } from 'drizzle-orm'
import { clerkUserId } from '@/lib/auth/session'
import {
  EMPTY_VIEWER_STATE,
  parseProgrammeIds,
  VIEWER_CACHE_CONTROL,
  type ViewerState,
} from '@/lib/auth/viewer-state'
import { getDb } from '@/lib/db/client'
import { appUser, bookmark, programme, programmeVote, revision } from '@/lib/db/schema'

/**
 * `GET /api/viewer` — the one per-viewer request the whole caching design rests on (§6.13).
 *
 * Every public page ships the **signed-out render** to the CDN and is byte-identical for
 * every viewer; nothing public reads the session on the server. Everything viewer-dependent
 * — two pressed states per row, the header cluster, the header notice, the owner controls —
 * is a client-side mount driven by this one response.
 *
 * It is fired **only when a Clerk session cookie is present**, so a signed-out visitor, a
 * crawler and a link unfurler issue zero extra requests. That property is the whole cost
 * case, and it lives in `components/site/viewer-store.ts`; this end holds up the other half:
 * two statements in **one `neon-http` batch, one HTTP round trip**, ~3 ms of Active CPU.
 *
 * **It reads only Postgres and never a blob**, so it renders for a `pending` or tombstoned
 * Programme whose objects do not exist and cannot be invalidated by a contract recompute.
 */

/** `searchParams` is a request-time API; there is nothing here to prerender. */
export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000

function viewerResponse(state: ViewerState): Response {
  return Response.json(state, { headers: { 'cache-control': VIEWER_CACHE_CONTROL } })
}

/**
 * `exists(…)` is an expression rather than a column, so nothing downstream guarantees the
 * driver hands back a JavaScript boolean rather than Postgres's `t`/`f`. Reading both is one
 * comparison and removes a class of bug where every notice silently reads true.
 */
const asBoolean = (value: unknown): boolean => value === true || value === 't' || value === 'true'

export async function GET(request: Request): Promise<Response> {
  const ids = parseProgrammeIds(new URL(request.url).searchParams.get('p'))

  // Signed out, a stale `__client_uat`, or a deployment with no Clerk keys at all (§4.8's
  // dev tier 1): the same empty payload the signed-out render already drew. Never a 401 —
  // the client would only turn it back into "leave the signed-out render standing".
  const clerkId = await clerkUserId()
  if (!clerkId) return viewerResponse(EMPTY_VIEWER_STATE)

  const db = getDb()
  const now = Date.now()

  /**
   * Statement 1 — the header: the Handle and the two `exists` notices (§6.12).
   *
   * Both windows are expressed in the predicate rather than stored, because both conditions
   * expire on their own: a Class B tombstone matters for exactly 30 days (the quarantine
   * window in which the bytes can still be restored) and a `failed` upload for exactly 24
   * hours (the reap). Storage buys nothing when the fact deletes itself.
   */
  const owned = (extra: SQL | undefined) =>
    db
      .select({ one: sql`1` })
      .from(revision)
      .innerJoin(programme, eq(programme.id, revision.programme_id))
      .where(and(eq(programme.owner_user_id, appUser.id), extra))

  const header = db
    .select({
      handle: appUser.display_name,
      failed: exists(
        owned(and(eq(revision.status, 'failed'), gt(revision.uploaded_at, new Date(now - DAY_MS)))),
      ).mapWith(asBoolean),
      removal: exists(
        owned(
          and(
            eq(revision.status, 'tombstoned'),
            eq(revision.removal_class, 'B'),
            gt(revision.removed_at, new Date(now - 30 * DAY_MS)),
          ),
        ),
      ).mapWith(asBoolean),
    })
    .from(appUser)
    .where(eq(appUser.clerk_user_id, clerkId))
    .limit(1)

  // A static page asks about no programmes, so there is no second statement to send.
  if (ids.length === 0) {
    const [row] = await header
    return viewerResponse({
      ...EMPTY_VIEWER_STATE,
      handle: row?.handle ?? null,
      notices: { failed: row?.failed ?? false, removal: row?.removal ?? false },
    })
  }

  /**
   * Statement 2 — the combined viewer join: vote-flag and bookmark-flag over the visible
   * page's ids, in one pass. Both subqueries reach the account through `clerk_user_id`
   * rather than through statement 1's result, because a batch has no data dependency
   * between its statements — that is what makes it one round trip.
   */
  const pressed = db
    .select({
      programme_id: programme.id,
      voted: exists(
        db
          .select({ one: sql`1` })
          .from(programmeVote)
          .innerJoin(appUser, eq(appUser.id, programmeVote.voter_user_id))
          .where(
            and(eq(appUser.clerk_user_id, clerkId), eq(programmeVote.programme_id, programme.id)),
          ),
      ).mapWith(asBoolean),
      bookmarked: exists(
        db
          .select({ one: sql`1` })
          .from(bookmark)
          .innerJoin(appUser, eq(appUser.id, bookmark.user_id))
          .where(and(eq(appUser.clerk_user_id, clerkId), eq(bookmark.programme_id, programme.id))),
      ).mapWith(asBoolean),
    })
    .from(programme)
    .where(inArray(programme.id, ids))

  const [headerRows, pressedRows] = await db.batch([header, pressed])
  const row = headerRows[0]

  return viewerResponse({
    handle: row?.handle ?? null,
    notices: { failed: row?.failed ?? false, removal: row?.removal ?? false },
    voted: pressedRows.filter((r) => r.voted).map((r) => r.programme_id),
    bookmarked: pressedRows.filter((r) => r.bookmarked).map((r) => r.programme_id),
  })
}
