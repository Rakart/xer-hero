import { and, eq } from 'drizzle-orm'
import { jsonError, jsonResponse, readJson } from '@/lib/auth/api'
import { ensureAppUser } from '@/lib/auth/app-user'
import { clerkUserId } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { bookmark, programme } from '@/lib/db/schema'

/**
 * `POST /api/bookmarks` — **save for later, private** (§6.9).
 *
 * The bookmark is the other of §6.9's two objects, and it is deliberately not the upvote with
 * a flag: **no counter anywhere**, no public rendering, no board input, nothing to farm. The
 * response carries no count for the same reason — there is none to carry.
 *
 * It is the apparent exception to "every Programme-scoped write lives on that Programme's
 * page" that is not one: it is a write about *you*, not about the Programme, which is exactly
 * why it can sit on a public row (§6.12).
 *
 * Un-bookmarking **leaves the row in place, greyed, until reload** on `/me/bookmarks` — a
 * list that shrinks under the cursor jumps — so this endpoint deletes the row and says so,
 * and the page decides what to draw.
 */

export const dynamic = 'force-dynamic'

interface BookmarkRequest {
  programmeId: string
  pressed: boolean
}

export async function POST(request: Request): Promise<Response> {
  const clerkId = await clerkUserId()
  if (!clerkId) return jsonError(401, 'Sign in to save a programme.')

  const body = await readJson<BookmarkRequest>(request)
  if (!body?.programmeId || typeof body.pressed !== 'boolean') {
    return jsonError(400, 'Malformed request.')
  }

  const db = getDb()
  // A bookmark is an authenticated write, so it too creates `app_user` on the first one.
  const user = await ensureAppUser(db, clerkId)

  const [target] = await db
    .select({ id: programme.id })
    .from(programme)
    .where(eq(programme.id, body.programmeId))
    .limit(1)
  if (!target) return jsonError(404, 'No such programme.')

  if (body.pressed) {
    await db
      .insert(bookmark)
      .values({ user_id: user.id, programme_id: body.programmeId, created_at: new Date() })
      .onConflictDoNothing()
  } else {
    await db
      .delete(bookmark)
      .where(and(eq(bookmark.user_id, user.id), eq(bookmark.programme_id, body.programmeId)))
  }

  return jsonResponse({ pressed: body.pressed })
}
