import { and, eq, max } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { CURRENT_TERMS_VERSION } from '@/components/site/legal'
import {
  type SubmitRequest,
  type SubmitResponse,
  type SubmitStatusResponse,
  sectorOrNull,
  validateMetadata,
} from '@/components/upload/contract'
import { jsonError, jsonResponse, readJson } from '@/lib/auth/api'
import { findAppUser, handleTaken, retireHandle } from '@/lib/auth/app-user'
import { clerkUserId } from '@/lib/auth/session'
import { SECTOR_CODES } from '@/lib/contracts/domain'
import { getDb } from '@/lib/db/client'
import { appUser, programme, revision, uploadIntent } from '@/lib/db/schema'
import { normaliseHandle, uniqueSlug } from '@/lib/identity'
import { runIngest } from '@/lib/ingest/ingest'

/**
 * `POST /api/submit` — step 5 of §5.1, then `after()` runs ingest in the same invocation.
 *
 * One batch insert: `programme` with `current_revision_id` **null**, plus `revision` with
 * `status = 'pending'` and `content_hash` **null**, `on conflict (id) do nothing`. The null
 * pointer is the mechanism that keeps a pending programme off the shelf for free — the grid's
 * inner join drops it, with no status predicate anywhere (§2.10).
 *
 * **Idempotency is structural.** The `revision_id` minted at presign *is* the primary key,
 * so a double-submit inserts nothing and returns the existing row. No dedupe token, no
 * request hashing (§5.8). The `upload_intent` row is also the authorisation: only the account
 * that presigned these two uuids can submit them.
 *
 * Steps 5–7 make the normal case *feel* synchronous — the authoritative parse is 1–2 s — but
 * ingest is asynchronous anyway, because a closed tab still needs an outcome and a retry
 * needs somewhere to retry from.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const clerkId = await clerkUserId()
  if (!clerkId) return jsonError(401, 'Sign in to publish a programme.')

  const body = await readJson<SubmitRequest>(request)
  if (!body?.revisionId) return jsonError(400, 'Malformed request.')

  const db = getDb()
  const user = await findAppUser(db, clerkId)
  if (!user) return jsonError(409, 'Start the upload again — nothing was reserved for it.')

  const [intent] = await db
    .select()
    .from(uploadIntent)
    .where(eq(uploadIntent.revision_id, body.revisionId))
    .limit(1)
  if (!intent || intent.user_id !== user.id) {
    return jsonError(404, 'That upload was not found. Pick the file again.')
  }

  // A double-submit lands here: the row is already in, so the answer is the row (§5.8).
  const [existing] = await db
    .select({ slug: programme.slug })
    .from(revision)
    .innerJoin(programme, eq(programme.id, revision.programme_id))
    .where(eq(revision.id, body.revisionId))
    .limit(1)
  if (existing) {
    return jsonResponse<SubmitResponse>({ slug: existing.slug, revisionId: body.revisionId })
  }

  const isFork = body.intent === 'fork'
  const problems = validateMetadata(
    {
      title: body.title ?? '',
      description: body.description ?? '',
      sector: body.sector ?? '',
      changeNote: body.changeNote ?? '',
      handle: body.handle ?? '',
      rights: body.rights === true,
    },
    { requireChangeNote: isFork, requireHandle: typeof body.handle === 'string' },
    SECTOR_CODES,
  )
  if (Object.keys(problems).length > 0) {
    return jsonResponse({ error: 'Some fields need attention.', problems }, 422)
  }

  const title = body.title.trim()
  const now = new Date()
  const uploaderHandle = await confirmHandle(user.id, user.display_name, body.handle)

  const revisionRow = {
    id: body.revisionId,
    programme_id: intent.programme_id,
    uploaded_at: now,
    uploader_display_name: uploaderHandle,
    change_note: body.changeNote.trim() || null,
    // The rights checkbox is snapshotted as a version string plus a timestamp, never as a
    // boolean: this row is the only artefact that matters if an upload is disputed (§7.2).
    terms_version: CURRENT_TERMS_VERSION,
    asserted_at: now,
    status: 'pending' as const,
  }

  if (body.intent === 'revision') {
    const [parent] = await db
      .select({ id: programme.id, slug: programme.slug, owner_user_id: programme.owner_user_id })
      .from(programme)
      .where(eq(programme.id, intent.programme_id))
      .limit(1)
    if (!parent || parent.owner_user_id !== user.id) {
      return jsonError(403, 'Only the uploader adds a revision. Everyone else forks.')
    }
    const [highest] = await db
      .select({ n: max(revision.rev_no) })
      .from(revision)
      .where(eq(revision.programme_id, parent.id))

    await db
      .insert(revision)
      .values({ ...revisionRow, rev_no: (highest?.n ?? 0) + 1, is_root_rev: false })
      .onConflictDoNothing()
    return published(parent.slug, intent.programme_id, body.revisionId)
  }

  // A new programme and a fork are the same insert with a different lineage: a fork carries
  // `parent_revision_id`, and its `root_programme_id` is the parent's root rather than itself.
  let parentRevisionId: string | null = null
  let parentProgrammeId: string | null = null
  let rootProgrammeId = intent.programme_id
  if (isFork) {
    const slug = (body.slug ?? '').trim()
    const [parent] = await db
      .select({
        id: programme.id,
        status: programme.status,
        current_revision_id: programme.current_revision_id,
        root_programme_id: programme.root_programme_id,
      })
      .from(programme)
      .where(eq(programme.slug, slug))
      .limit(1)
    if (!parent?.current_revision_id || parent.status !== 'published') {
      return jsonError(409, 'That programme has nothing published to fork.')
    }
    parentRevisionId = parent.current_revision_id
    parentProgrammeId = parent.id
    rootProgrammeId = parent.root_programme_id
  }

  const slug = await uniqueSlug(title, async (candidate) => {
    const [row] = await db
      .select({ slug: programme.slug })
      .from(programme)
      .where(eq(programme.slug, candidate))
      .limit(1)
    return Boolean(row)
  })

  await db.batch([
    db
      .insert(programme)
      .values({
        id: intent.programme_id,
        slug,
        title,
        description: body.description.trim() || null,
        sector: sectorOrNull(body.sector),
        owner_user_id: user.id,
        parent_revision_id: parentRevisionId,
        parent_programme_id: parentProgrammeId,
        root_programme_id: rootProgrammeId,
        // Null until ingest publishes. Do not "fix" this into a status predicate (§2.10).
        current_revision_id: null,
        status: 'published',
        created_at: now,
      })
      .onConflictDoNothing(),
    db
      .insert(revision)
      .values({
        ...revisionRow,
        rev_no: 1,
        // True only for a root programme's rev 1 — a fork's rev 1 is not a root, which is
        // what keeps `revision_root_content_hash_uq` from blocking a legitimate fork (§5.8).
        is_root_rev: !isFork,
      })
      .onConflictDoNothing(),
  ])

  return published(slug, intent.programme_id, body.revisionId)
}

/**
 * Responds, **then** runs ingest in the same invocation (§5.1 step 5). `after()` is what
 * makes the normal case feel synchronous without the response waiting on a 1–2 s parse.
 */
function published(slug: string, programmeId: string, revisionId: string): Response {
  after(async () => {
    try {
      const outcome = await runIngest(getDb(), { programmeId, revisionId })
      if (outcome.status !== 'published') return
      // Required, not decorative: the slug is immutable and the Programme is created at
      // intent, so `/p/{slug}` 404s before the bytes are parsed and a cached 404 would
      // outlive the publish by up to an hour (§4.6.4).
      revalidatePath(`/p/${slug}`)
      revalidatePath('/p/[slug]', 'page')
    } catch {
      // The response is already sent, so there is nowhere to report this to: no analytics,
      // and runtime logs last an hour. The row stays `pending` and the sweep retries it in
      // at most 15 minutes, which is the path this failure is *supposed* to fall into.
    }
  })
  return jsonResponse<SubmitResponse>({ slug, revisionId })
}

/**
 * The Handle is **confirmed** at first upload, where the metadata screen carries it prefilled
 * with the generated value and required like the title (§6.12). Changing it here retires the
 * generated one permanently, on the same rule as a rename at `/me/account`.
 */
async function confirmHandle(
  userId: string,
  current: string,
  chosen: string | undefined,
): Promise<string> {
  if (typeof chosen !== 'string') return current
  const next = normaliseHandle(chosen)
  if (next === '' || next.toLowerCase() === current.toLowerCase()) return current

  const db = getDb()
  if (await handleTaken(db, next)) return current
  await db.update(appUser).set({ display_name: next }).where(eq(appUser.id, userId))
  await retireHandle(db, current)
  return next
}

/**
 * `GET /api/submit?revision=…` — step 7's poll, owner-scoped.
 *
 * One truth rendered in two places: the flow polls the same row `/me` renders, for ~15 s,
 * then sends the browser to `/p/{slug}` (§5.9).
 */
export async function GET(request: Request): Promise<Response> {
  const revisionId = new URL(request.url).searchParams.get('revision') ?? ''
  if (revisionId === '') return jsonError(400, 'Which upload?')

  const clerkId = await clerkUserId()
  if (!clerkId) return jsonError(401, 'Sign in to see this upload.')

  const db = getDb()
  const user = await findAppUser(db, clerkId)
  if (!user) return jsonError(404, 'No such upload.')

  const [row] = await db
    .select({
      status: revision.status,
      failure_reason: revision.failure_reason,
      slug: programme.slug,
    })
    .from(revision)
    .innerJoin(programme, eq(programme.id, revision.programme_id))
    .where(and(eq(revision.id, revisionId), eq(programme.owner_user_id, user.id)))
    .limit(1)
  if (!row) return jsonError(404, 'No such upload.')

  return jsonResponse<SubmitStatusResponse>(row)
}
