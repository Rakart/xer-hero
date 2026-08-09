/**
 * Everything the programme page renders, resolved before a single component runs.
 *
 * The split is deliberate: the two route files do all the awaiting — one Postgres read, one
 * `derived.json` fetch, one `HEAD` for the download size — and `ProgrammeDocument` and every
 * block under it are **synchronous** server components over this bundle. That is what makes
 * the whole page testable without a database, which matters here because there is no
 * database to test it against.
 */

import type { Derived } from '@/lib/contracts/derived'
import type { ProgrammeStatus, RemovalClass, RevisionStatus } from '@/lib/contracts/domain'
import type { LineageFacts } from './cite'

/** One entry in the revision selector. Tombstoned entries stay listed, disabled. */
export interface RevisionEntry {
  revNo: number
  uploadedAt: string
  status: RevisionStatus
  removalClass: RemovalClass | null
  uploaderDisplayName: string
  changeNote: string | null
}

export interface RevisionView {
  id: string
  revNo: number
  /** ISO instant from `revision.uploaded_at`, the one real timestamp on the page. */
  uploadedAt: string
  uploaderDisplayName: string
  p6Version: string | null
  /** From the typed column, not from `derived.json` — the OG strings read the same source. */
  activityCount: number | null
  pctComplete: number | null
  status: RevisionStatus
  removalClass: RemovalClass | null
  changeNote: string | null
}

export interface AncestorView {
  slug: string
  title: string
  status: ProgrammeStatus
}

export interface ProgrammeView {
  programmeId: string
  slug: string
  title: string
  description: string | null
  sectorCode: string | null
  sectorLabel: string | null
  licence: string
  voteCount: number
  status: ProgrammeStatus

  revision: RevisionView
  /** Whether the revision on screen is the one `/p/{slug}` follows. */
  isCurrentRevision: boolean
  currentRevNo: number | null
  revisions: RevisionEntry[]

  derived: Derived
  lineage: LineageFacts
  /** Nearest parent first, the whole chain — A → B → C, not just the immediate parent. */
  ancestors: AncestorView[]

  /** Computed from the blob origin env var; never a hostname literal (§4.8). */
  downloadUrl: string
  activitiesUrl: string
  /**
   * Transferred bytes of `original.xer.gz` — what the user actually waits for. `null` where
   * the blob host did not answer; the control renders without the figure rather than
   * printing one nobody measured.
   */
  originalGzBytes: number | null
  /** Absolute, for the cite block. */
  citationUrl: string
}

/**
 * A tombstoned programme or revision: the page stays at its URL forever, stops being
 * findable, and renders the withdrawal copy. It carries **no** `derived.json`, because the
 * bytes are destroyed — which is exactly why the tombstone view is a different shape rather
 * than a flag on the one above.
 */
export interface TombstoneView {
  slug: string
  title: string
  uploaderDisplayName: string
  sectorLabel: string | null
  revNo: number | null
  removalClass: RemovalClass | null
  /** Drives the third line: a cascaded fork is not the complained-about programme. */
  hasTombstonedAncestor: boolean
  ancestors: AncestorView[]
}
