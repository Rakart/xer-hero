import { randomUUID } from 'node:crypto'
import { and, count, eq, gt, notExists, sql } from 'drizzle-orm'
import type { PresignRequest, PresignResponse } from '@/components/upload/contract'
import { jsonError, jsonResponse, readJson } from '@/lib/auth/api'
import { ensureAppUser } from '@/lib/auth/app-user'
import { clerkUserId } from '@/lib/auth/session'
import { presignOriginalPut } from '@/lib/blob/objects'
import { MAX_FILE_BYTES } from '@/lib/contracts/domain'
import { getDb } from '@/lib/db/client'
import { programme, revision, uploadIntent } from '@/lib/db/schema'

/**
 * `POST /api/presign` — step 2 of §5.1, and **the abuse surface** (§5.4).
 *
 * Any signed-in user could otherwise mint unlimited PUT URLs. Two caps, both counted against
 * `upload_intent`: **3 unsubmitted intents at a time** and **20 presigns per user per day**.
 * Presign requires a Clerk session, so both are per-account and an abuser burns Google
 * accounts to continue.
 *
 * The URL carries an **exact content-length, not a range** — the client has already produced
 * the compressed blob and knows its byte count, §5.2 established that the length cannot be
 * predicted from anywhere else, and R2 rejects anything else. **The cap does not rest on
 * client honesty.**
 *
 * `upload_intent` exists because a user who PUTs and then closes the form leaves an R2 object
 * with no row, and hunting it by listing the bucket is O(objects) forever. The sweep reaps
 * one older than 24 h with no matching revision (§5.9).
 *
 * This is also where `app_user` is created, if this is the account's first authenticated
 * write (§6.12).
 */

export const dynamic = 'force-dynamic'

/** Both are v1 floors, set to be raised as configuration rather than reversed (§5.4). */
export const MAX_UNSUBMITTED_INTENTS = 3
export const MAX_PRESIGNS_PER_DAY = 20

const DAY_MS = 24 * 60 * 60 * 1000

export async function POST(request: Request): Promise<Response> {
  const clerkId = await clerkUserId()
  if (!clerkId) return jsonError(401, 'Sign in to upload a programme.')

  const body = await readJson<PresignRequest>(request)
  if (!body) return jsonError(400, 'Malformed request.')

  const contentLength = Number(body.contentLength)
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    return jsonError(400, 'The upload needs the compressed byte count.')
  }
  // The gzipped blob of an in-cap file is 7.1–7.4 MB at the cap; anything above the raw cap
  // cannot be one, and the authoritative check is ingest's capped gunzip either way (§5.4).
  if (contentLength > MAX_FILE_BYTES) {
    return jsonError(413, 'That file is above the size limit.')
  }
  if (body.intent !== 'new' && body.intent !== 'revision' && body.intent !== 'fork') {
    return jsonError(400, 'Unknown upload intent.')
  }

  const db = getDb()
  // The first authenticated write of any kind creates the row, with a generated Handle.
  const user = await ensureAppUser(db, clerkId)

  /**
   * A new revision is **owner-only** and its parent comes from the URL; a fork is any
   * published programme. Neither is ever inferred from the file (§5.1).
   */
  let programmeId: string = randomUUID()
  if (body.intent !== 'new') {
    const slug = (body.slug ?? '').trim()
    if (slug === '') return jsonError(400, 'That upload needs a programme to attach to.')
    const [parent] = await db
      .select({
        id: programme.id,
        owner_user_id: programme.owner_user_id,
        status: programme.status,
        current_revision_id: programme.current_revision_id,
      })
      .from(programme)
      .where(eq(programme.slug, slug))
      .limit(1)
    if (!parent) return jsonError(404, 'That programme does not exist.')
    if (body.intent === 'revision') {
      if (parent.owner_user_id !== user.id) {
        return jsonError(403, 'Only the uploader adds a revision. Everyone else forks.')
      }
      programmeId = parent.id
    } else if (parent.status !== 'published' || !parent.current_revision_id) {
      return jsonError(409, 'That programme has nothing published to fork.')
    }
  }

  /**
   * Both caps in one batch. The unsubmitted count is *an intent with no matching revision* —
   * a row the submit step never reached — and the daily count is every intent minted in the
   * last 24 h, which the reap keeps honest.
   */
  const [[unsubmitted], [today], [owned]] = await db.batch([
    db
      .select({ n: count() })
      .from(uploadIntent)
      .where(
        and(
          eq(uploadIntent.user_id, user.id),
          notExists(
            db
              .select({ one: sql`1` })
              .from(revision)
              .where(eq(revision.id, uploadIntent.revision_id)),
          ),
        ),
      ),
    db
      .select({ n: count() })
      .from(uploadIntent)
      .where(
        and(
          eq(uploadIntent.user_id, user.id),
          gt(uploadIntent.created_at, new Date(Date.now() - DAY_MS)),
        ),
      ),
    db.select({ n: count() }).from(programme).where(eq(programme.owner_user_id, user.id)),
  ])

  if ((unsubmitted?.n ?? 0) >= MAX_UNSUBMITTED_INTENTS) {
    return jsonError(
      429,
      `${MAX_UNSUBMITTED_INTENTS} uploads are already waiting to be finished. Finish or abandon one — an abandoned upload clears itself within a day.`,
    )
  }
  if ((today?.n ?? 0) >= MAX_PRESIGNS_PER_DAY) {
    return jsonError(429, `That is ${MAX_PRESIGNS_PER_DAY} uploads started today. Try tomorrow.`)
  }

  /**
   * **Idempotency is structural**: this uuid *is* the revision's primary key, so submit is
   * `on conflict (id) do nothing` and a double-submit cannot create two programmes. No
   * dedupe token, no request hashing (§5.8).
   */
  const revisionId = randomUUID()
  await db.insert(uploadIntent).values({
    revision_id: revisionId,
    programme_id: programmeId,
    user_id: user.id,
    created_at: new Date(),
  })

  const presigned = await presignOriginalPut({ programmeId, revisionId }, contentLength)
  const response: PresignResponse = {
    programmeId,
    revisionId,
    url: presigned.url,
    key: presigned.key,
    headers: presigned.headers,
    handle: user.display_name,
    firstUpload: (owned?.n ?? 0) === 0,
  }
  return jsonResponse(response)
}
