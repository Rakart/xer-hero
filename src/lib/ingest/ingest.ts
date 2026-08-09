import { createHash } from 'node:crypto'
import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { DecompressionLimitError, gunzipCapped, gzip } from '@/lib/blob/gzip'
import { getObject, putActivities, putDerived, putOriginal } from '@/lib/blob/objects'
import { DERIVED_VERSION } from '@/lib/contracts/derived'
import { originalKey } from '@/lib/contracts/domain'
import type { Db } from '@/lib/db/client'
import { programme, revision } from '@/lib/db/schema'
import { derive } from '@/lib/derive'
import { parseXer, type ScanGuard, scanVerdict, scanXerSync, XerParseError } from '@/lib/xer'
import { type FailureClass, IngestFailure, safeDetail } from './failures'

/**
 * The ingest job (§5.7).
 *
 * Asynchronous from day one. The row exists before the parse — seven of its columns are
 * nullable precisely so a `pending` row is insertable — and `programme.current_revision_id`
 * stays null until this succeeds, which is what makes a pending programme invisible to the
 * shelf for free, with no status predicate anywhere.
 *
 * **A partial ingest is overwritten, not cleaned up.** Keys are deterministic, so a retry PUTs
 * over whatever is there; R2 PUTs are atomic per object and no reader exists at all until
 * publish, so a half-written prefix is unreachable by construction. Deleting the prefix before
 * retrying was rejected on a detail: it would delete the `original.xer.gz` the browser uploaded
 * and the server has not necessarily re-fetched.
 */

export interface IngestRef {
  programmeId: string
  revisionId: string
}

export type IngestOutcome =
  | { status: 'published'; activityCount: number; issues: number; derivedBytes: number }
  | { status: 'failed'; failureClass: string; reason: string }
  | { status: 'pending'; retryable: true; detail: string }

export interface IngestOptions {
  /**
   * Seeding hands the bytes in directly rather than fetching them back out of the blob store,
   * because seeding *writes* them here (§4.9). Everything downstream of this point is the same
   * code the browser path runs.
   */
  bytes?: Uint8Array
  /** Injected so a derive is reproducible in a test. */
  now?: Date
  parserVersion?: string
}

const PARSER_VERSION = '0.1.0'

export async function runIngest(
  db: Db,
  ref: IngestRef,
  options: IngestOptions = {},
): Promise<IngestOutcome> {
  const now = options.now ?? new Date()

  const rows = await db
    .select({
      id: revision.id,
      programme_id: revision.programme_id,
      status: revision.status,
      is_root_rev: revision.is_root_rev,
      ingest_attempts: revision.ingest_attempts,
    })
    .from(revision)
    .where(eq(revision.id, ref.revisionId))
    .limit(1)

  const row = rows[0]
  if (!row) throw new Error(`No revision row for ${ref.revisionId}`)
  if (row.status !== 'pending') {
    return { status: 'pending', retryable: false as never as true, detail: `already ${row.status}` }
  }

  const attempt = row.ingest_attempts + 1
  await db.update(revision).set({ ingest_attempts: attempt }).where(eq(revision.id, ref.revisionId))

  try {
    const raw = await readOriginal(ref, options.bytes)
    const contentHash = sha256Hex(raw)

    // Every guard the client scan already ran, recomputed here. Nothing the client computes is
    // persisted (§2.11) and every server check recomputes what the user was shown (§1.5) — a
    // deterministic failure at this point means a bypassed client or a bug.
    const scan = scanXerSync(raw)
    const verdict = scanVerdict(scan)
    if (!verdict.accept) {
      throw new IngestFailure(guardToClass(verdict.guard), verdict.reason)
    }

    await assertNotBlockedByHash(db, contentHash, ref, row.is_root_rev)

    const file = parseXer(raw)
    const output = derive({
      file,
      programmeId: ref.programmeId,
      revisionId: ref.revisionId,
      parserVersion: options.parserVersion ?? PARSER_VERSION,
      computedAt: now.toISOString(),
    })

    const derivedBody = gzip(JSON.stringify(output.derived))
    const activitiesBody = gzip(JSON.stringify(output.activities))
    await putDerived(ref, DERIVED_VERSION, derivedBody)
    await putActivities(ref, activitiesBody)

    // Two writes, not one transaction: `neon-http` is batched non-interactive only, and the
    // pair is safe in this order because the shelf's inner join cannot see the programme until
    // `current_revision_id` lands (§2.10).
    await db
      .update(revision)
      .set({
        content_hash: contentHash,
        status: 'published',
        failure_reason: null,
        failure_detail: null,
        ...output.row,
      })
      .where(eq(revision.id, ref.revisionId))

    await db
      .update(programme)
      .set({ current_revision_id: ref.revisionId })
      .where(eq(programme.id, ref.programmeId))

    return {
      status: 'published',
      activityCount: output.derived.shape.activity_count,
      issues: output.derived.issues.length,
      derivedBytes: derivedBody.byteLength,
    }
  } catch (error) {
    return await recordFailure(db, ref, error, attempt)
  }
}

async function readOriginal(ref: IngestRef, provided?: Uint8Array): Promise<Uint8Array> {
  if (provided) return provided
  const stored = await getObject(originalKey(ref.programmeId, ref.revisionId))
  if (!stored) {
    // Transient by classification: the browser's PUT may not have landed yet, and the sweep
    // retries a `pending` row. A genuinely absent object is reaped at 24 h as a stranded intent.
    throw new Error('original.xer.gz not found')
  }
  try {
    return gunzipCapped(stored)
  } catch (error) {
    if (error instanceof DecompressionLimitError) throw new IngestFailure('over_cap', error.message)
    throw new IngestFailure('unreadable', safeDetail(error, 'gunzip'))
  }
}

/**
 * The two hash rules (§5.8), in the order that makes the second cheap.
 *
 * A **Class B** tombstoned revision hard-rejects: rows never delete, so a tombstoned
 * `content_hash` survives after its bytes are gone, outlives the 30-day quarantine, and means
 * the exact file taken down cannot be re-uploaded by anyone, including under a fresh account.
 * A **Class A** tombstone does not block — the owner withdrew voluntarily and may re-upload.
 *
 * A published root match is the true race, and the loser is **rejected with the offer** rather
 * than silently converted: auto-forking would attach a stranger's programme to their upload as
 * a parent they never chose, and a fork carries an attribution obligation and a required note.
 */
async function assertNotBlockedByHash(
  db: Db,
  contentHash: string,
  ref: IngestRef,
  isRootRev: boolean,
): Promise<void> {
  const clashes = await db
    .select({
      id: revision.id,
      status: revision.status,
      removal_class: revision.removal_class,
      is_root_rev: revision.is_root_rev,
    })
    .from(revision)
    .where(and(eq(revision.content_hash, contentHash), isNotNull(revision.content_hash)))

  for (const clash of clashes) {
    if (clash.id === ref.revisionId) continue
    if (clash.status === 'tombstoned' && clash.removal_class === 'B') {
      throw new IngestFailure('removed', `matches tombstoned revision ${clash.id}`)
    }
  }

  if (!isRootRev) return
  for (const clash of clashes) {
    if (clash.id === ref.revisionId) continue
    if (clash.status === 'published' && clash.is_root_rev) {
      throw new IngestFailure('duplicate', `matches published root revision ${clash.id}`)
    }
  }
}

/**
 * Deterministic faults go to `failed` immediately; transient ones leave the row `pending` for
 * the sweep, which retries while `ingest_attempts < 3` and gives up on the third (§5.9).
 */
async function recordFailure(
  db: Db,
  ref: IngestRef,
  error: unknown,
  attempt: number,
): Promise<IngestOutcome> {
  if (error instanceof IngestFailure) {
    await db
      .update(revision)
      .set({ status: 'failed', failure_reason: error.reason, failure_detail: error.detail })
      .where(eq(revision.id, ref.revisionId))
    return { status: 'failed', failureClass: error.failureClass, reason: error.reason }
  }

  if (error instanceof XerParseError) {
    const failure = new IngestFailure('tokenizer', safeDetail(error, error.detail))
    await db
      .update(revision)
      .set({ status: 'failed', failure_reason: failure.reason, failure_detail: failure.detail })
      .where(eq(revision.id, ref.revisionId))
    return { status: 'failed', failureClass: 'tokenizer', reason: failure.reason }
  }

  // **The true race** (§5.8): two identical files reaching ingest at once. The pre-check above
  // sees neither, because neither has written its `content_hash` yet — enforcement lands on
  // the publish UPDATE, where `revision_root_content_hash_uq` fires. §5.9 classes the hash
  // violation as **deterministic**, so it must not be retried: without this branch the loser
  // stays `pending`, burns all three sweep attempts, and finally reports `internal` — a
  // shrug where the spec requires the offer to fork the winner instead.
  if (isUniqueViolation(error, 'revision_root_content_hash_uq')) {
    const failure = new IngestFailure('duplicate', safeDetail(error, 'root content_hash'))
    await db
      .update(revision)
      .set({ status: 'failed', failure_reason: failure.reason, failure_detail: failure.detail })
      .where(eq(revision.id, ref.revisionId))
    return { status: 'failed', failureClass: 'duplicate', reason: failure.reason }
  }

  const detail = safeDetail(error)
  if (attempt >= 3) {
    const failure = new IngestFailure('internal', detail)
    await db
      .update(revision)
      .set({ status: 'failed', failure_reason: failure.reason, failure_detail: detail })
      .where(eq(revision.id, ref.revisionId))
    return { status: 'failed', failureClass: 'internal', reason: failure.reason }
  }

  await db.update(revision).set({ failure_detail: detail }).where(eq(revision.id, ref.revisionId))
  return { status: 'pending', retryable: true, detail }
}

/**
 * Postgres `23505`, optionally narrowed to one constraint.
 *
 * The driver wraps the server error, so the code can arrive on the error, on its `cause`, or
 * only in the message text depending on how far up it was rethrown. All three are checked
 * because misreading this one turns a deterministic failure into three retries and a wrong
 * explanation for the uploader.
 */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidates = [error, (error as { cause?: unknown }).cause].filter(Boolean)
  for (const candidate of candidates) {
    const code = (candidate as { code?: string }).code
    const message = (candidate as { message?: string }).message ?? ''
    const isUnique = code === '23505' || message.includes('duplicate key value')
    if (!isUnique) continue
    if (!constraint) return true
    const detail = `${message}${(candidate as { constraint?: string }).constraint ?? ''}`
    if (detail.includes(constraint)) return true
  }
  return false
}

/**
 * The scan's guard vocabulary, mapped to the failure class the uploader is shown.
 *
 * Typed on `ScanGuard` rather than `string` and deliberately **without a `default`**: an
 * exhaustive switch turns a renamed or added guard into a compile error, where a default
 * would silently file it as a tokenizer fault and tell the uploader the wrong thing.
 */
function guardToClass(guard: ScanGuard): FailureClass {
  switch (guard) {
    case 'oversize':
    case 'byte_cap':
    case 'activity_cap':
      return 'over_cap'
    case 'unreadable':
      return 'unreadable'
    case 'not_xer':
      return 'not_xer'
    case 'no_activities':
      return 'no_activities'
    case 'multi_project':
      return 'multi_project'
    case 'tokenizer':
      return 'tokenizer'
  }
}

/** Over the **decompressed** bytes, which is what the partial unique index is defined on. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Writes the original and runs ingest in one call — the seeding path (§4.9). It skips exactly
 * two things the browser path does: the client-side parse and the presigned PUT hop.
 */
export async function ingestFromBytes(
  db: Db,
  ref: IngestRef,
  rawBytes: Uint8Array,
  options: IngestOptions = {},
): Promise<IngestOutcome> {
  await putOriginal(ref, gzip(rawBytes))
  return runIngest(db, ref, { ...options, bytes: rawBytes })
}

/** Used by the sweep's retry query; kept here so the predicate lives beside the job. */
export const RETRYABLE_PENDING = sql`status = 'pending' and ingest_attempts < 3`
