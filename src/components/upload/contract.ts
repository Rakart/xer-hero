import { handleProblem } from '@/lib/auth/handle'
import type { SectorCode } from '@/lib/contracts/domain'

/**
 * The wire between the upload screen and the four routes behind it (§5.1, §5.4, §10.1).
 *
 * It is one module because the browser and the Function must agree on the same shapes and
 * the same field rules: **the scan is advisory in the browser and authoritative in the
 * function**, so every rule here runs twice, and nothing the client computes is persisted.
 *
 * Pure and isomorphic — no database, no Clerk, no `next/*`. The client bundle imports it.
 */

/**
 * **Whether an upload is a new Programme, a new Revision or a Fork is declared by route and
 * never detected** (§5.1). No property of a file distinguishes a fork from a revision — only
 * the uploader's intent does — and a detector keyed on the P6 project id would collapse four
 * tender variants that are fork *siblings* into one revision series.
 */
export type UploadIntent = 'new' | 'revision' | 'fork'

export interface PresignRequest {
  intent: UploadIntent
  /** The parent programme, for a revision or a fork. The route carries it, not a query. */
  slug?: string
  /** The gzipped blob's exact byte count. The presigned URL signs it, not a range (§5.4). */
  contentLength: number
}

export interface PresignResponse {
  programmeId: string
  revisionId: string
  url: string
  key: string
  /** Signed, so the browser must send **exactly** these on the PUT (§5.4, §5.6). */
  headers: Record<string, string>
  /** The account's Handle, generated on this very call if this was its first write. */
  handle: string
  /** True when the account owns no Programme yet — the Handle field appears (§6.12). */
  firstUpload: boolean
}

export interface SubmitRequest {
  revisionId: string
  intent: UploadIntent
  slug?: string
  title: string
  description: string
  sector: string
  changeNote: string
  /** Only sent on a first upload, where the Handle is confirmed rather than generated. */
  handle?: string
  /** The rights checkbox. Snapshots `terms_version` + `asserted_at`, never a boolean (§7.2). */
  rights: boolean
}

export interface SubmitResponse {
  slug: string
  revisionId: string
}

/** What the poll reads while ingest runs (§5.1 step 7). */
export interface SubmitStatusResponse {
  status: 'pending' | 'failed' | 'published' | 'tombstoned'
  failure_reason: string | null
  slug: string
}

/** The dedup lookup the browser's hash drives — and drives nothing else (§5.8). */
export interface HashCheckResponse {
  /** A `removal_class = 'B'` tombstone matches: the file cannot be published by anyone. */
  removed: boolean
  /** A published root matches: offered as a fork, or as a revision if it is your own. */
  duplicate: { slug: string; title: string; own: boolean } | null
  /** The advisory same-project hint. A link, **never** a reroute (§5.1). */
  sameProject: { slug: string; title: string; nextRev: number }[]
}

export type UploadError = { error: string }

export interface MetadataValues {
  title: string
  description: string
  sector: string
  changeNote: string
  handle: string
  rights: boolean
}

export type MetadataField = keyof MetadataValues

export interface MetadataRules {
  /** `change_note` is required on a fork's rev 1 and optional afterwards (§5.4). */
  requireChangeNote: boolean
  /** The Handle is confirmed at first upload, required like the title (§6.12). */
  requireHandle: boolean
}

export const TITLE_MAX_LENGTH = 200
export const DESCRIPTION_MAX_LENGTH = 4000
export const CHANGE_NOTE_MAX_LENGTH = 1000

/**
 * The five fields of §5.4, checked once. **Title is required despite prefilling**, or the
 * shelf fills with rows named `C1042` — `PROJECT.proj_short_name` is the P6 *Project ID*, a
 * code, and the human-readable name lives in the root `PROJWBS` node's `wbs_name`. Sector
 * stays optional so an upload is never blocked on a dropdown the uploader cannot answer.
 */
export function validateMetadata(
  values: MetadataValues,
  rules: MetadataRules,
  sectorCodes: readonly string[],
): Partial<Record<MetadataField, string>> {
  const problems: Partial<Record<MetadataField, string>> = {}

  const title = values.title.trim()
  if (title === '') problems.title = 'A title is required. It is what the shelf shows.'
  else if (title.length > TITLE_MAX_LENGTH) {
    problems.title = `Too long — ${TITLE_MAX_LENGTH} characters at most.`
  }

  if (values.description.length > DESCRIPTION_MAX_LENGTH) {
    problems.description = `Too long — ${DESCRIPTION_MAX_LENGTH} characters at most.`
  }

  if (values.sector !== '' && !sectorCodes.includes(values.sector)) {
    problems.sector = 'That is not one of the sectors.'
  }

  const note = values.changeNote.trim()
  if (rules.requireChangeNote && note === '') {
    problems.changeNote = 'Say what changed. A fork carries an attribution obligation (§7.3).'
  } else if (note.length > CHANGE_NOTE_MAX_LENGTH) {
    problems.changeNote = `Too long — ${CHANGE_NOTE_MAX_LENGTH} characters at most.`
  }

  if (rules.requireHandle) {
    const problem = handleProblem(values.handle)
    if (problem) problems.handle = problem
  }

  if (!values.rights) {
    problems.rights = 'The upload cannot be published without this.'
  }

  return problems
}

/** `sector` is nullable and blank is a real state — never an inferred value (§1.6). */
export function sectorOrNull(value: string): SectorCode | null {
  return value === '' ? null : (value as SectorCode)
}
