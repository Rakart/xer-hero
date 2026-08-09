import { and, eq, sql } from 'drizzle-orm'
import { jsonError, jsonResponse, readJson } from '@/lib/auth/api'
import { ensureAppUser } from '@/lib/auth/app-user'
import { clerkUserId } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { appUser, programme, programmeVote, uploaderVote } from '@/lib/db/schema'

/**
 * `POST /api/votes` — the upvote, which is an **endorsement, public** (§6.9, §1.7).
 *
 * Two votable objects and two counters, and therefore no standing formula: nothing is summed,
 * weighted, blended or tuned. A Programme is voted from the shelf row and the detail page; an
 * uploader is voted **only** from `/u/{handle}` — never from a row, never from the detail
 * page. The Revision is not votable at all.
 *
 * The two targets are written out separately below rather than folded into one parameterised
 * toggle. They are **two objects with two behaviours**, they touch different tables and
 * different counters, and the day one of them grows a rule the other does not have, a shared
 * body would be the thing that made it wrong.
 *
 * Signed-in only, **one vote per user per target, toggleable**, and **self-votes are
 * permitted** — one vote, once, a constant offset that reorders nothing.
 *
 * Anti-gaming is **manual, by design**: no rate limit, no minimum account age, no vote decay.
 * The operator voids votes on complaint, with machinery a Class B takedown already needs.
 *
 * **A vote invalidates nothing** (§4.6.4). A stale `vote_count` reorders nothing under a
 * frozen newest-first order, and a purge per vote would be the most expensive write here.
 */

export const dynamic = 'force-dynamic'

interface VoteRequest {
  target: 'programme' | 'uploader'
  /** The Programme's uuid, for `target: 'programme'`. */
  programmeId?: string
  /** The subject's Handle, for `target: 'uploader'`. */
  handle?: string
  pressed: boolean
}

export async function POST(request: Request): Promise<Response> {
  const clerkId = await clerkUserId()
  if (!clerkId) return jsonError(401, 'Sign in to upvote.')

  const body = await readJson<VoteRequest>(request)
  if (!body || typeof body.pressed !== 'boolean') return jsonError(400, 'Malformed request.')

  const db = getDb()
  // A vote is an authenticated write, so it is one of the three paths that create `app_user`.
  const voter = await ensureAppUser(db, clerkId)
  const now = new Date()

  if (body.target === 'programme') {
    const programmeId = body.programmeId ?? ''
    const [target] = await db
      .select({ vote_count: programme.vote_count })
      .from(programme)
      .where(eq(programme.id, programmeId))
      .limit(1)
    if (!target) return jsonError(404, 'No such programme.')

    const moved = body.pressed
      ? await db
          .insert(programmeVote)
          .values({ voter_user_id: voter.id, programme_id: programmeId, created_at: now })
          .onConflictDoNothing()
          .returning({ programme_id: programmeVote.programme_id })
      : await db
          .delete(programmeVote)
          .where(
            and(
              eq(programmeVote.voter_user_id, voter.id),
              eq(programmeVote.programme_id, programmeId),
            ),
          )
          .returning({ programme_id: programmeVote.programme_id })

    // The denormalised counter moves only when a row actually moved, so a double-click, a
    // retry and a replayed request all land on the same number. `greatest(…, 0)` is a floor
    // rather than a repair: the counter reconciles with `count(*)` because a vote row is kept
    // through account deletion with its voter reference nulled (§6.9).
    if (moved.length === 0) {
      return jsonResponse({ pressed: body.pressed, count: target.vote_count })
    }
    const [updated] = await db
      .update(programme)
      .set({
        vote_count: sql`greatest(${programme.vote_count} + ${body.pressed ? 1 : -1}, 0)`,
      })
      .where(eq(programme.id, programmeId))
      .returning({ count: programme.vote_count })
    return jsonResponse({ pressed: body.pressed, count: updated?.count ?? 0 })
  }

  if (body.target === 'uploader') {
    const handle = (body.handle ?? '').trim()
    const [subject] = await db
      .select({ id: appUser.id, uploader_vote_count: appUser.uploader_vote_count })
      .from(appUser)
      .where(eq(appUser.display_name, handle))
      .limit(1)
    if (!subject) return jsonError(404, 'No such contributor.')

    const moved = body.pressed
      ? await db
          .insert(uploaderVote)
          .values({ voter_user_id: voter.id, subject_user_id: subject.id, created_at: now })
          .onConflictDoNothing()
          .returning({ subject_user_id: uploaderVote.subject_user_id })
      : await db
          .delete(uploaderVote)
          .where(
            and(
              eq(uploaderVote.voter_user_id, voter.id),
              eq(uploaderVote.subject_user_id, subject.id),
            ),
          )
          .returning({ subject_user_id: uploaderVote.subject_user_id })

    if (moved.length === 0) {
      return jsonResponse({ pressed: body.pressed, count: subject.uploader_vote_count })
    }
    const [updated] = await db
      .update(appUser)
      .set({
        uploader_vote_count: sql`greatest(${appUser.uploader_vote_count} + ${body.pressed ? 1 : -1}, 0)`,
      })
      .where(eq(appUser.id, subject.id))
      .returning({ count: appUser.uploader_vote_count })
    return jsonResponse({ pressed: body.pressed, count: updated?.count ?? 0 })
  }

  return jsonError(400, 'Unknown vote target.')
}
