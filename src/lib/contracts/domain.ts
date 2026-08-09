/**
 * Values shared by more than one module, defined once so two modules cannot disagree.
 * Everything here is fixed by the spec and is not a build-time judgement call.
 */

// --- sector taxonomy (§1.6) -------------------------------------------------
//
// Declared by the uploader, single-valued, one axis — asset class. Nothing is inferred, in
// v1 not even as a prefill. Ordered transport → vertical → utilities → process, NOT
// alphabetically, so the chip row reads as related things sitting together.
//
// There is no `unsectored` code, no ninth chip and no `sector=none`: absent renders as
// `unsectored` in the row's fixed slot and the breadcrumb drops the segment.

export const SECTORS = [
  { code: 'rail', label: 'Rail', sort_order: 10 },
  { code: 'highways', label: 'Highways & roads', sort_order: 20 },
  { code: 'aviation', label: 'Aviation', sort_order: 30 },
  { code: 'marine', label: 'Marine & ports', sort_order: 40 },
  { code: 'building', label: 'Buildings', sort_order: 50 },
  { code: 'water', label: 'Water & wastewater', sort_order: 60 },
  { code: 'power', label: 'Power & energy', sort_order: 70 },
  { code: 'process', label: 'Oil, gas & process', sort_order: 80 },
] as const

export type SectorCode = (typeof SECTORS)[number]['code']

export const SECTOR_CODES: readonly string[] = SECTORS.map((s) => s.code)

export function sectorLabel(code: string | null | undefined): string | null {
  if (!code) return null
  return SECTORS.find((s) => s.code === code)?.label ?? null
}

// --- size bands (§1.5) ------------------------------------------------------

/**
 * §1.5 writes the bands as `s` <500 · `m` 500–2,000 · `l` 2,000–5,000 · `xl` >5,000, which
 * names 2,000 and 5,000 twice each. The two outer bands are strict, so the partition that
 * makes all four disjoint and complete puts each shared boundary in the **upper** band:
 * 5,000 is `l` because `xl` is *over* 5,000, and 2,000 is therefore `l` too.
 */
export const SIZE_BANDS = [
  { code: 's', label: 'Small', min: 0, max: 499 },
  { code: 'm', label: 'Medium', min: 500, max: 1999 },
  { code: 'l', label: 'Large', min: 2000, max: 5000 },
  { code: 'xl', label: 'Very large', min: 5001, max: Number.POSITIVE_INFINITY },
] as const

export type SizeBandCode = (typeof SIZE_BANDS)[number]['code']

export function sizeBandFor(activityCount: number | null | undefined): SizeBandCode | null {
  if (activityCount == null) return null
  const band = SIZE_BANDS.find((b) => activityCount >= b.min && activityCount <= b.max)
  return band?.code ?? null
}

// --- ingest caps (§5.3) -----------------------------------------------------
//
// Rejected rather than degraded, and rejected in the browser before a byte is uploaded, so
// a rejection costs a file-picker click rather than a 60 MB upload.

export const MAX_ACTIVITIES = 20_000
export const MAX_FILE_BYTES = 60 * 1024 * 1024

// --- row and page shapes ----------------------------------------------------

/** Numbered pages at 25 (§1.5). */
export const SHELF_PAGE_SIZE = 25

/** One page, top 100, no pagination and no query parameters (§10.7). */
export const LEADERBOARD_LIMIT = 100

/** Every capped exemplar list in `derived.json` (§3.7). */
export const EXEMPLAR_CAP = 50

/** First-level WBS nodes in `shape.wbs_summary` (§3.3). */
export const WBS_SUMMARY_CAP = 20

// --- persisted enumerations (§2.10) -----------------------------------------

export const PROGRAMME_STATUS = ['published', 'tombstoned'] as const
export type ProgrammeStatus = (typeof PROGRAMME_STATUS)[number]

export const REVISION_STATUS = ['pending', 'failed', 'published', 'tombstoned'] as const
export type RevisionStatus = (typeof REVISION_STATUS)[number]

/** A — voluntary withdrawal. B — adjudicated complaint, cascades down the fork subtree. */
export const REMOVAL_CLASS = ['A', 'B'] as const
export type RemovalClass = (typeof REMOVAL_CLASS)[number]

// --- P6 enumerations (§2.4) -------------------------------------------------
//
// These may never be treated as closed. Every list below is what has been *observed*; an
// unknown value is counted and carried, never a rejection. `unknown-table-and-enum.xer`
// exists in the corpus to hold that line.

export const TASK_TYPES = [
  'TT_Task',
  'TT_Rsrc',
  'TT_LOE',
  'TT_Mile',
  'TT_FinMile',
  'TT_WBS',
] as const

export const MILESTONE_TYPES: readonly string[] = ['TT_Mile', 'TT_FinMile']

export const STATUS_CODES = ['TK_NotStart', 'TK_Active', 'TK_Complete'] as const

export const RELATIONSHIP_TYPES = ['PR_FS', 'PR_SS', 'PR_FF', 'PR_SF'] as const
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number]

// --- blob keys (§5.5, §10.4) ------------------------------------------------
//
// Three objects per revision, id-addressed. `derived.v{N}.json` carries no `.gz` despite
// being stored gzipped: the key was fixed by the contract and encoding is a header, not a
// filename.

export function originalKey(programmeId: string, revisionId: string): string {
  return `p/${programmeId}/r/${revisionId}/original.xer.gz`
}

export function activitiesKey(programmeId: string, revisionId: string): string {
  return `p/${programmeId}/r/${revisionId}/activities.json.gz`
}

export function derivedKey(programmeId: string, revisionId: string, version: number): string {
  return `p/${programmeId}/r/${revisionId}/derived.v${version}.json`
}

/** The `Content-Type` describes the object *inside* the encoding; all three are gzipped. */
export const BLOB_CONTENT_TYPES = {
  original: 'text/plain; charset=windows-1252',
  activities: 'application/json',
  derived: 'application/json',
} as const
