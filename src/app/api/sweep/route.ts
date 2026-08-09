import { randomUUID, timingSafeEqual } from 'node:crypto'
import { DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { and, count, eq, inArray, isNotNull, isNull, lt, notExists, or, sql } from 'drizzle-orm'
import { bucket, s3 } from '@/lib/blob/client'
import { deleteRevisionPrefix } from '@/lib/blob/objects'
import { getDb } from '@/lib/db/client'
import {
  alarmState,
  programme,
  revision,
  type SweepActions,
  type SweepBreach,
  sweepRun,
  takedownReport,
  uploadIntent,
} from '@/lib/db/schema'
import { env } from '@/lib/env'
import { DETERMINISTIC, FAILURE_REASONS } from '@/lib/ingest/failures'
import { runIngest } from '@/lib/ingest/ingest'
import { evaluateAlarms, shouldAlarm, THRESHOLDS } from './rules'

/**
 * `POST /api/sweep` — the reaper, the retrier, the reconciler and the reporter (§5.9, §5.10).
 *
 * **POSTed by a GitHub Actions schedule every 15 minutes with a bearer secret**, not by a
 * Vercel cron: Hobby allows one cron run a day with ±59 minutes of slop and a more frequent
 * expression fails at deployment, which would make the retry path decorative. Actions is free
 * on a public repo and its scheduler is best-effort, so 15 minutes is the honest cadence.
 *
 * **This is also the alert channel.** The workflow step is one line that fails when `ok` is
 * false, and a failed Actions run mails the repo owner — the estate's only outbound mail
 * path, since the app can send none. Actions logs on a public repo are world-readable, so the
 * workflow prints the boolean and nothing else; breach detail stays in this response body and
 * on the gated dashboard.
 *
 * Every run writes a `sweep_run` heartbeat — start, finish, what it did, the verdict — and
 * `/ops`'s staleness line is the detector for the sweep itself.
 */

export const dynamic = 'force-dynamic'
/** Ingest retries run inline; the default 15 s would cut a batch of three in half. */
export const maxDuration = 300

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** A transient failure waits two minutes before the first retry (§5.9). */
const RETRY_AFTER_MS = 2 * MINUTE_MS
/** One run reaps and retries in bounded batches, so a backlog drains over runs, not in one. */
const BATCH = 10

/**
 * > **GAP.** §5.11 names a "private quarantine prefix" for Class B `original.xer.gz` and
 * > never spells its key, and the finished blob layer has no quarantine primitive. This is
 * > the constant the `takedown apply` CLI must copy *to*, stated here because the sweep is
 * > what destroys it 30 days later — if the CLI ships a different prefix, the bytes outlive
 * > the quarantine and `reconciler_stuck` is the rule that will say so.
 */
const QUARANTINE_PREFIX = 'quarantine'

function quarantinePrefix(programmeId: string, revisionId: string): string {
  return `${QUARANTINE_PREFIX}/p/${programmeId}/r/${revisionId}/`
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.SWEEP_SECRET
  if (!secret) {
    // Unset locally and on a fork PR, which is exactly why a fork cannot call this (§5.9).
    return Response.json({ ok: false, error: 'sweep is not configured' }, { status: 503 })
  }
  if (!bearerMatches(request.headers.get('authorization'), secret)) {
    return Response.json({ ok: false }, { status: 401 })
  }

  const db = getDb()
  const now = new Date()
  const runId = randomUUID()
  await db.insert(sweepRun).values({ id: runId, started_at: now })

  try {
    const actions: SweepActions = {
      retried: await retryTransient(now),
      reaped: (await reapStrandedIntents(now)) + (await reapFailures(now)),
      tombstones_completed: await finishTombstones(),
      quarantines_destroyed: await destroyExpiredQuarantine(now),
    }

    const breaches = evaluateAlarms({
      takedownOpen: await countOpenTakedowns(now),
      deterministicFailures: await countDeterministicFailures(now),
      transientFailures: await countTransientFailures(now),
      transientAttempts: await countTransientAttempts(now),
      reconcilerStuck: await countReconcilerStuck(now),
      edgeDrift: await countEdgeDrift(),
    })

    /**
     * The verdict the workflow asserts on is *did anything alarm*, not *is anything
     * breaching* — the cadence rule (§5.10). A rule that stays red for a week produces two
     * mails, not 672, and `/ops` renders the breach list either way.
     */
    const alarmed = await recordAlarms(breaches, now)
    const ok = alarmed.length === 0

    await db
      .update(sweepRun)
      .set({ finished_at: new Date(), ok, actions, breaches })
      .where(eq(sweepRun.id, runId))

    return Response.json({ ok, breaches, actions })
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : 'sweep failed'
    await db
      .update(sweepRun)
      .set({ finished_at: new Date(), ok: false, error: message })
      .where(eq(sweepRun.id, runId))
    // A 500 is red at the workflow's first assertion, which is the alarm working (§5.10).
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}

function bearerMatches(header: string | null, secret: string): boolean {
  const presented = (header ?? '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(presented)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

// --- the five sweep queries (§5.9) ------------------------------------------

/**
 * Transient faults leave the row `pending` and the sweep retries it while
 * `ingest_attempts < 3`; the third failure inside `runIngest` writes `failed` itself.
 */
async function retryTransient(now: Date): Promise<number> {
  const db = getDb()
  const due = await db
    .select({ id: revision.id, programme_id: revision.programme_id })
    .from(revision)
    .where(
      and(
        eq(revision.status, 'pending'),
        lt(revision.uploaded_at, new Date(now.getTime() - RETRY_AFTER_MS)),
        lt(revision.ingest_attempts, 3),
      ),
    )
    .limit(BATCH)

  for (const row of due) {
    await runIngest(db, { programmeId: row.programme_id, revisionId: row.id })
  }
  return due.length
}

/**
 * `upload_intent` exists because a user who PUTs and then closes the form leaves an R2 object
 * with no row, and hunting it by listing the bucket is O(objects) forever. This is the query
 * that makes the row worth writing.
 */
async function reapStrandedIntents(now: Date): Promise<number> {
  const db = getDb()
  const stranded = await db
    .select({ revision_id: uploadIntent.revision_id, programme_id: uploadIntent.programme_id })
    .from(uploadIntent)
    .where(
      and(
        lt(uploadIntent.created_at, new Date(now.getTime() - DAY_MS)),
        notExists(
          db
            .select({ one: sql`1` })
            .from(revision)
            .where(eq(revision.id, uploadIntent.revision_id)),
        ),
      ),
    )
    .limit(BATCH)

  for (const row of stranded) {
    await deleteRevisionPrefix({
      programmeId: row.programme_id,
      revisionId: row.revision_id,
    })
    await db.delete(uploadIntent).where(eq(uploadIntent.revision_id, row.revision_id))
  }
  return stranded.length
}

/**
 * The 24 h window **is the whole argument for having a `failed` state at all**: deleting on
 * failure is tidier and destroys the only explanation the user will ever get, because the app
 * cannot send mail. After 24 h the row, its prefix and its intent go — and `/me` is not a
 * history, so the upload leaves that page with no trace (§6.12).
 *
 * The Programme goes with it when the failure was its only revision. A pending Programme is
 * invisible to every public surface, so there is nothing pointing at it to break; anything
 * that *does* point at it (a fork, a second revision) leaves it standing.
 */
async function reapFailures(now: Date): Promise<number> {
  const db = getDb()
  const cutoff = new Date(now.getTime() - DAY_MS)
  const dead = await db
    .select({ id: revision.id, programme_id: revision.programme_id })
    .from(revision)
    .where(
      and(
        // `failed`, plus a `pending` row this old, which the retry query gave up on three
        // attempts ago and which nothing else will ever move.
        or(eq(revision.status, 'failed'), eq(revision.status, 'pending')),
        lt(revision.uploaded_at, cutoff),
      ),
    )
    .limit(BATCH)

  for (const row of dead) {
    await deleteRevisionPrefix({ programmeId: row.programme_id, revisionId: row.id })
    await db.delete(revision).where(eq(revision.id, row.id))
    await db.delete(uploadIntent).where(eq(uploadIntent.revision_id, row.id))

    const [survivors] = await db
      .select({ n: count() })
      .from(revision)
      .where(eq(revision.programme_id, row.programme_id))
    const [children] = await db
      .select({ n: count() })
      .from(programme)
      .where(eq(programme.parent_programme_id, row.programme_id))
    if ((survivors?.n ?? 0) === 0 && (children?.n ?? 0) === 0) {
      await db
        .delete(programme)
        .where(and(eq(programme.id, row.programme_id), isNull(programme.current_revision_id)))
    }
  }
  return dead.length
}

/**
 * Makes both the Class A self-service button and a crashed `takedown apply` **self-healing**,
 * and demotes the CLI's `--resume` from a requirement to a convenience.
 *
 * > **GAP.** §5.11 writes `bytes_deleted_at` only on a *verified* purge — a confirmed non-200
 * > from a plain GET of the public URL. There is no Cloudflare credential anywhere in §4.8's
 * > secret inventory, so this sweep completes the R2 delete and records it; the purge and its
 * > verification stay with the CLI, which already holds production credentials. The 1-hour
 * > TTL on `original.xer.gz` is the backstop that makes that survivable (§7.9).
 */
async function finishTombstones(): Promise<number> {
  const db = getDb()
  const stranded = await db
    .select({ id: revision.id, programme_id: revision.programme_id })
    .from(revision)
    .where(and(eq(revision.status, 'tombstoned'), isNull(revision.bytes_deleted_at)))
    .limit(BATCH)

  for (const row of stranded) {
    await deleteRevisionPrefix({ programmeId: row.programme_id, revisionId: row.id })
  }
  if (stranded.length > 0) {
    await db
      .update(revision)
      .set({ bytes_deleted_at: new Date() })
      .where(
        inArray(
          revision.id,
          stranded.map((row) => row.id),
        ),
      )
  }
  return stranded.length
}

/**
 * **After 30 days a mistaken Class B is not recoverable**, stated plainly rather than implied
 * (§5.11). The quarantine is the only affordable defence against a griefing complaint for a
 * solo operator, and this is the query that ends it.
 */
async function destroyExpiredQuarantine(now: Date): Promise<number> {
  const db = getDb()
  const expired = await db
    .select({ id: revision.id, programme_id: revision.programme_id })
    .from(revision)
    .where(
      and(
        eq(revision.removal_class, 'B'),
        lt(revision.removed_at, new Date(now.getTime() - THRESHOLDS.quarantineDays * DAY_MS)),
        isNull(revision.quarantine_purged_at),
      ),
    )
    .limit(BATCH)

  for (const row of expired) {
    await deletePrefix(quarantinePrefix(row.programme_id, row.id))
  }
  if (expired.length > 0) {
    await db
      .update(revision)
      .set({ quarantine_purged_at: new Date() })
      .where(
        inArray(
          revision.id,
          expired.map((row) => row.id),
        ),
      )
  }
  return expired.length
}

/** A delete of a missing key is a success — the whole reconciliation depends on that. */
async function deletePrefix(prefix: string): Promise<void> {
  const listed = await s3().send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix }))
  const keys = (listed.Contents ?? []).map((o) => o.Key).filter((k): k is string => Boolean(k))
  if (keys.length === 0) return
  await s3().send(
    new DeleteObjectsCommand({
      Bucket: bucket(),
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    }),
  )
}

// --- the five rules' inputs (§5.10) -----------------------------------------

async function countOpenTakedowns(now: Date): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(takedownReport)
    .where(
      or(
        and(
          eq(takedownReport.status, 'open'),
          lt(
            takedownReport.created_at,
            new Date(now.getTime() - THRESHOLDS.takedownOpenHours * HOUR_MS),
          ),
        ),
        and(
          eq(takedownReport.status, 'awaiting_owner'),
          lt(
            takedownReport.created_at,
            new Date(now.getTime() - THRESHOLDS.takedownAwaitingOwnerDays * DAY_MS),
          ),
        ),
      ),
    )
  return row?.n ?? 0
}

/** The deterministic classes, read back off the sentence each writes into `failure_reason`. */
const DETERMINISTIC_REASONS = [...DETERMINISTIC].map(
  (failureClass) => FAILURE_REASONS[failureClass],
)

/**
 * These are near-extinct **by construction** — the client scan catches every one of them
 * before a byte moves — so one reaching ingest means a bypassed client or a bug, which is
 * worth *seeing* rather than merely counting.
 */
async function countDeterministicFailures(now: Date): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(revision)
    .where(
      and(
        eq(revision.status, 'failed'),
        sql`${revision.uploaded_at} > ${new Date(now.getTime() - THRESHOLDS.deterministicWindowHours * HOUR_MS)}`,
        inArray(revision.failure_reason, DETERMINISTIC_REASONS),
      ),
    )
  return row?.n ?? 0
}

/**
 * A transient failure is one that left a `failure_detail` behind without a deterministic
 * class: an R2 read, a database blip, a function timeout.
 *
 * > The window is keyed on `uploaded_at`, because §2.10 timestamps a revision and not an
 * > individual attempt. That makes "in the last hour" mean "on a revision uploaded in the
 * > last hour", which is the honest reading of a schema with no attempt log — and the
 * > threshold behind it is a guess anyway (§5.10).
 */
async function countTransientFailures(now: Date): Promise<number> {
  const window = new Date(now.getTime() - THRESHOLDS.transientWindowHours * HOUR_MS)
  const [row] = await getDb()
    .select({ n: count() })
    .from(revision)
    .where(
      and(
        sql`${revision.uploaded_at} > ${window}`,
        isNotNull(revision.failure_detail),
        or(
          eq(revision.status, 'pending'),
          and(eq(revision.status, 'failed'), eq(revision.failure_reason, FAILURE_REASONS.internal)),
        ),
      ),
    )
  return row?.n ?? 0
}

async function countTransientAttempts(now: Date): Promise<number> {
  const window = new Date(now.getTime() - THRESHOLDS.transientWindowHours * HOUR_MS)
  const [row] = await getDb()
    .select({ n: count() })
    .from(revision)
    .where(and(sql`${revision.uploaded_at} > ${window}`, sql`${revision.ingest_attempts} > 0`))
  return row?.n ?? 0
}

/**
 * The rule nobody asked for and the one that matters most: it is "bytes hard-delete" quietly
 * not being true. A stranded tombstone is a public unsigned URL that a takedown believes it
 * destroyed.
 */
async function countReconcilerStuck(now: Date): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(revision)
    .where(
      or(
        and(
          eq(revision.status, 'tombstoned'),
          isNull(revision.bytes_deleted_at),
          lt(
            revision.removed_at,
            new Date(now.getTime() - THRESHOLDS.reconcilerStuckHours * HOUR_MS),
          ),
        ),
        and(
          eq(revision.removal_class, 'B'),
          isNull(revision.quarantine_purged_at),
          lt(
            revision.removed_at,
            new Date(
              now.getTime() -
                THRESHOLDS.quarantineDays * DAY_MS -
                THRESHOLDS.quarantineGraceHours * HOUR_MS,
            ),
          ),
        ),
      ),
    )
  return row?.n ?? 0
}

/**
 * `edge.site.programme_cached` (§4.6.6), which is the one §5.13 assertion the spec assigns to
 * the sweep rather than to CI: **two unauthenticated GETs of a known-published `/p/{slug}`**,
 * where the second must come back cached and neither may carry `Set-Cookie`. It catches the
 * vendor-dashboard edit, which has no commit behind it.
 *
 * The rest of §5.13's edge assertions need production credentials and live in the CLI.
 */
async function countEdgeDrift(): Promise<number> {
  const [row] = await getDb()
    .select({ slug: programme.slug })
    .from(programme)
    .where(and(eq(programme.status, 'published'), isNotNull(programme.current_revision_id)))
    .limit(1)
  if (!row) return 0

  const url = `${env.siteOrigin.replace(/\/$/, '')}/p/${row.slug}`
  try {
    const first = await fetch(url, { cache: 'no-store' })
    const second = await fetch(url, { cache: 'no-store' })
    if (first.headers.get('set-cookie') || second.headers.get('set-cookie')) return 1
    if (!first.ok || !second.ok) return 1
    const state = (second.headers.get('x-vercel-cache') ?? '').toUpperCase()
    // Locally there is no CDN in front of the app and the header is absent; the assertion is
    // about production drift, so an absent header is not a breach.
    if (state !== '' && !['HIT', 'STALE', 'PRERENDER'].includes(state)) return 1
    return 0
  } catch {
    // The site not answering its own public page is exactly what this rule is for.
    return 1
  }
}

// --- suppression state (§5.10) ----------------------------------------------

/**
 * `alarm_state` is separate from `sweep_run` because that table is append-only history and
 * suppression is mutable current state; conflating them means reading the last row to write
 * the next one. Its five rows are **seeded by migration**, so a rule the dashboard should be
 * showing is never hidden behind a run that has not happened yet.
 */
async function recordAlarms(breaches: SweepBreach[], now: Date): Promise<string[]> {
  const db = getDb()
  const states = await db.select().from(alarmState)
  const breaching = new Map(breaches.map((b) => [b.rule, b.count]))
  const alarmed: string[] = []

  for (const state of states) {
    if (breaching.has(state.rule)) {
      const alarm = shouldAlarm(state.breaching, state.last_alarmed_at, now)
      if (alarm) alarmed.push(state.rule)
      await db
        .update(alarmState)
        .set({
          breaching: true,
          breaching_since: state.breaching ? state.breaching_since : now,
          last_alarmed_at: alarm ? now : state.last_alarmed_at,
        })
        .where(eq(alarmState.rule, state.rule))
    } else if (state.breaching) {
      await db
        .update(alarmState)
        .set({ breaching: false, breaching_since: null })
        .where(eq(alarmState.rule, state.rule))
    }
  }
  return alarmed
}
