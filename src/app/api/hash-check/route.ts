import { and, desc, eq, isNotNull, max, sql } from 'drizzle-orm'
import type { HashCheckResponse } from '@/components/upload/contract'
import { jsonError, jsonResponse } from '@/lib/auth/api'
import { findAppUser } from '@/lib/auth/app-user'
import { clerkUserId } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { programme, revision } from '@/lib/db/schema'

/**
 * `GET /api/hash-check?hash=…` — the dedup lookup, and **a read** (§5.1 step 1, §5.8).
 *
 * The browser's `crypto.subtle` digest drives this lookup **and nothing else**. Nothing the
 * client computes is persisted: `content_hash` is written once, by ingest, from the
 * decompressed bytes, so the partial unique index fires on the authoritative update and
 * never on client-supplied data. This endpoint only moves the answer forward in time, from
 * the race at ingest to the file picker, where it costs nobody an upload.
 *
 * Three answers, in the order §5.8 tabulates them:
 *   - a `removal_class = 'B'` tombstone matches → the file cannot be published by anyone,
 *     including under a fresh account. Rows never delete, so the block outlives the bytes.
 *   - a published **root** matches → offered as a fork of the match, or as a new revision
 *     when it is the viewer's own programme. Never converted silently: auto-forking would
 *     attach a stranger's programme as a parent the uploader never chose.
 *   - a Class A tombstone matches → **no block**. The owner withdrew voluntarily and may
 *     re-upload; that is the defect scoping the rule to Class B exists to fix.
 */

export const dynamic = 'force-dynamic'

const SHA256_HEX = /^[0-9a-f]{64}$/

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const hash = (params.get('hash') ?? '').trim().toLowerCase()
  if (!SHA256_HEX.test(hash)) return jsonError(400, 'A SHA-256 hex digest is required.')

  const db = getDb()
  const clerkId = await clerkUserId()
  const viewer = clerkId ? await findAppUser(db, clerkId) : undefined

  const clashes = await db
    .select({
      status: revision.status,
      removal_class: revision.removal_class,
      is_root_rev: revision.is_root_rev,
      slug: programme.slug,
      title: programme.title,
      owner_user_id: programme.owner_user_id,
    })
    .from(revision)
    .innerJoin(programme, eq(programme.id, revision.programme_id))
    .where(and(eq(revision.content_hash, hash), isNotNull(revision.content_hash)))

  const removed = clashes.some((c) => c.status === 'tombstoned' && c.removal_class === 'B')
  const match = clashes.find((c) => c.status === 'published' && c.is_root_rev)

  const response: HashCheckResponse = {
    removed,
    duplicate: match
      ? {
          slug: match.slug,
          title: match.title,
          own: Boolean(viewer && match.owner_user_id === viewer.id),
        }
      : null,
    sameProject: viewer ? await sameProject(params.get('title'), viewer.id) : [],
  }
  return jsonResponse(response)
}

/**
 * The advisory *"this looks like the same P6 project as **X** — add it there as rev N
 * instead?"* hint (§5.1). **A hint, never a reroute**: route decides shape, and the accepted
 * cost is that someone uploading a monthly series may create eight programmes rather than
 * one series of eight revisions.
 *
 * > **GAP.** §5.1 keys the hint on the scan's P6 project id, and **no column stores one** —
 * > §2.10 has no `proj_short_name` anywhere, and `derived.json` does not carry it either, so
 * > the only way to key on it would be a blob read per owned programme. It is keyed on the
 * > scan's title prefill instead, which is the same string for a monthly re-export of one
 * > project (both come from the root `PROJWBS.wbs_name`). Advisory either way, so a miss
 * > costs a hint and never a wrong route.
 */
async function sameProject(
  titlePrefill: string | null,
  ownerUserId: string,
): Promise<HashCheckResponse['sameProject']> {
  const title = (titlePrefill ?? '').trim()
  if (title === '') return []

  const rows = await getDb()
    .select({
      slug: programme.slug,
      title: programme.title,
      highest_rev: max(revision.rev_no),
    })
    .from(programme)
    .innerJoin(revision, eq(revision.programme_id, programme.id))
    .where(
      and(
        eq(programme.owner_user_id, ownerUserId),
        eq(programme.status, 'published'),
        sql`lower(${programme.title}) = lower(${title})`,
      ),
    )
    .groupBy(programme.id, programme.slug, programme.title)
    .orderBy(desc(programme.created_at))
    .limit(5)

  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    nextRev: (row.highest_rev ?? 0) + 1,
  }))
}
