import { cache } from 'react'
import { absoluteUrl } from '@/components/site'
import { publicUrl } from '@/lib/blob/client'
import { gunzipCapped } from '@/lib/blob/gzip'
import { getObject } from '@/lib/blob/objects'
import type { Derived } from '@/lib/contracts/derived'
import { DERIVED_MAX_BYTES, DERIVED_VERSION } from '@/lib/contracts/derived'
import { activitiesKey, derivedKey, originalKey, sectorLabel } from '@/lib/contracts/domain'
import { getDb } from '@/lib/db/client'
import {
  getAncestors,
  getLineageCounts,
  getProgrammeBySlug,
  getRevisionByNo,
  listRevisions,
  type ProgrammePageRow,
} from '@/lib/db/queries'
import type { Revision } from '@/lib/db/schema'
import { revisionPath } from './crawl'
import type { AncestorView, ProgrammeView, TombstoneView } from './types'

/**
 * Everything the two routes await (§6.8).
 *
 * | layer | where | cost |
 * |---|---|---|
 * | the Postgres row | one query, already indexed | free |
 * | `derived.json` | **server-side fetch, server-rendered** | ~16 KB on the 20,000-activity fixture |
 * | `activities.json` | **client-side and lazy**, on approach to the table | 340 KB gzipped |
 * | `original.xer.gz` | never read here — only its `Content-Length` | one `HEAD` |
 *
 * Every reader is wrapped in React's `cache`, because `generateMetadata` and the page body
 * both need the same row and the same blob and neither may pay for it twice.
 *
 * **No function here reads the session.** `auth()` cannot work on this route: the
 * middleware matcher covers only `/me`, `/ops`, `/api` and `/__clerk`, so every public
 * render is byte-identical for every viewer and carries no `Set-Cookie`. Per-viewer state
 * arrives in the browser from one `GET /api/viewer`.
 */

export interface LoadedRevision {
  row: ProgrammePageRow
  revision: Revision
  isCurrent: boolean
}

export const loadProgrammeRow = cache(async (slug: string): Promise<ProgrammePageRow | null> => {
  const [row] = await getProgrammeBySlug(getDb(), slug)
  return row ?? null
})

export const loadRevisionRow = cache(
  async (slug: string, revNo: number): Promise<Revision | null> => {
    const [found] = await getRevisionByNo(getDb(), slug, revNo)
    return found?.revision ?? null
  },
)

/**
 * `derived.json`, at the version the row says it is.
 *
 * The key is version-stamped, so a stale row points at a real object rather than a missing
 * one — nothing is ever overwritten and old versions age out naturally. §3.13's lazy
 * recompute (`row.derived_version < CURRENT_VERSION` → reparse the retained original and
 * write the new object) hangs off exactly this call, and it belongs to the derive pipeline
 * rather than to the page: there is one producer of `derived.json` in the estate, and a
 * second one here is how two producers drift.
 */
export const loadDerived = cache(
  async (programmeId: string, revisionId: string, version: number): Promise<Derived | null> => {
    const bytes = await getObject(derivedKey(programmeId, revisionId, version))
    if (!bytes) return null
    return JSON.parse(decodeMaybeGzipped(bytes)) as Derived
  },
)

/** Every object is stored gzipped; the magic bytes say so rather than the key, which does not. */
function decodeMaybeGzipped(bytes: Uint8Array): string {
  const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b
  const raw = gzipped ? gunzipCapped(bytes, DERIVED_MAX_BYTES) : bytes
  return new TextDecoder().decode(raw)
}

/**
 * The transferred size of `original.xer.gz`, by `HEAD` against the public URL.
 *
 * It is the number the download control prints, because **that is what the user waits
 * for** — and there is no size column on the revision and no head helper in the blob
 * module, so this is the only way to it that does not pull the whole 900 KB file through
 * the render. The blob is public, unsigned and CDN-cached, so the request costs one
 * round trip an hour per programme. A failure returns null and the control renders without
 * a figure rather than printing one nobody measured.
 */
export const loadDownloadSize = cache(
  async (programmeId: string, revisionId: string): Promise<number | null> => {
    try {
      const response = await fetch(publicUrl(originalKey(programmeId, revisionId)), {
        method: 'HEAD',
        signal: AbortSignal.timeout(2000),
        next: { revalidate: 3600 },
      })
      if (!response.ok) return null
      const length = response.headers.get('content-length')
      return length === null ? null : Number(length)
    } catch {
      return null
    }
  },
)

export async function buildProgrammeView(
  loaded: LoadedRevision,
  derived: Derived,
): Promise<ProgrammeView> {
  const { row, revision, isCurrent } = loaded
  const db = getDb()

  const [revisions, lineage, ancestors, gzBytes] = await Promise.all([
    listRevisions(db, row.id),
    getLineageCounts(db, row.id, row.root_programme_id),
    getAncestors(db, row.id),
    loadDownloadSize(row.id, revision.id),
  ])
  const counts = lineage[0]

  return {
    programmeId: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    sectorCode: row.sector,
    sectorLabel: sectorLabel(row.sector),
    licence: row.licence,
    voteCount: row.vote_count,
    status: row.status,

    revision: {
      id: revision.id,
      revNo: revision.rev_no,
      uploadedAt: revision.uploaded_at.toISOString(),
      uploaderDisplayName: revision.uploader_display_name,
      p6Version: revision.p6_version,
      activityCount: revision.activity_count,
      pctComplete: revision.pct_complete,
      status: revision.status,
      removalClass: revision.removal_class,
      changeNote: revision.change_note,
    },
    isCurrentRevision: isCurrent,
    currentRevNo: row.revision?.rev_no ?? null,
    revisions: revisions.map((entry) => ({
      revNo: entry.rev_no,
      uploadedAt: entry.uploaded_at.toISOString(),
      status: entry.status,
      removalClass: entry.removal_class,
      uploaderDisplayName: entry.uploader_display_name,
      changeNote: entry.change_note,
    })),

    derived,
    lineage: {
      parentSlug: row.parent_slug,
      parentTitle: row.parent_title,
      parentRevNo: row.parent_rev_no,
      parentUploader: row.parent_uploader_display_name,
      revisionCount: counts?.revision_count ?? 0,
      forkCount: counts?.fork_count ?? 0,
      familyCount: counts?.family_count ?? 0,
    },
    ancestors: toAncestorViews(ancestors),

    downloadUrl: publicUrl(originalKey(row.id, revision.id)),
    activitiesUrl: publicUrl(activitiesKey(row.id, revision.id)),
    originalGzBytes: gzBytes,
    citationUrl: absoluteUrl(revisionPath(row.slug, revision.rev_no)),
  }
}

export async function buildTombstoneView(
  row: ProgrammePageRow,
  revision: Revision | null,
): Promise<TombstoneView> {
  const ancestors = await getAncestors(getDb(), row.id)
  const views = toAncestorViews(ancestors)
  return {
    slug: row.slug,
    title: row.title,
    uploaderDisplayName: revision?.uploader_display_name ?? row.slug,
    sectorLabel: sectorLabel(row.sector),
    revNo: revision?.rev_no ?? null,
    removalClass: revision?.removal_class ?? null,
    // The cascade line is owed to a fork whose *parent* was taken down; a tombstoned
    // ancestor is the only signal that distinguishes it from the complained-about
    // programme, and rendering the wrong one accuses somebody who is not accused.
    hasTombstonedAncestor: views.some((ancestor) => ancestor.status === 'tombstoned'),
    ancestors: views,
  }
}

function toAncestorViews(rows: Awaited<ReturnType<typeof getAncestors>>): AncestorView[] {
  return rows.map((ancestor) => ({
    slug: ancestor.slug,
    title: ancestor.title,
    status: ancestor.status,
  }))
}

/** The version the row claims. A row with no version at all reads the current object. */
export function derivedVersionOf(revision: Revision): number {
  return revision.derived_version ?? DERIVED_VERSION
}
