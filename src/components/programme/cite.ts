/**
 * Attribution, lineage and tombstone copy (§7.3, §7.5, §5.11).
 *
 * **The site generates attribution from lineage it already holds; the `.xer` is never
 * modified.** The format has five record markers and no comment mechanism, so there is
 * nowhere safe to inject a credit line and doing so would break byte-identical
 * round-tripping. What the page owes a reuser instead is the correct string, one click
 * away — off-site obligations are the reuser's, as with any CC-BY work.
 *
 * The uploader never types a credit line, so cannot get it wrong: every field below is a
 * column the schema already carries, including `uploader_display_name`, which is
 * **snapshotted onto the revision** rather than joined live so that renaming an account
 * never silently rewrites credit on past uploads.
 */

import { CC_BY_URL, SITE_NAME } from '@/components/site'
import type { RemovalClass } from '@/lib/contracts/domain'

export interface CitationFacts {
  title: string
  handle: string
  revNo: number
  /** The absolute URL of the revision being cited. */
  url: string
  /** From `programme.licence`; the schema defaults it and v1 has one value. */
  licence: string
}

/**
 * The copy-paste string, in the CC-BY-recommended title / author / source / licence shape.
 * The revision is named because a programme's numbers change between revisions and a
 * citation that cannot be resolved to one is not a citation.
 */
export function citation(facts: CitationFacts): string {
  const licence = facts.licence === 'CC-BY-4.0' ? 'CC BY 4.0' : facts.licence
  return (
    `"${facts.title}" (revision ${facts.revNo}) by ${facts.handle}, from ${SITE_NAME} — ` +
    `${facts.url} — licensed under ${licence} (${CC_BY_URL}).`
  )
}

/** `CC-BY-4.0` is how the column stores it; `CC BY 4.0` is how a byline reads. */
export function licenceLabel(licence: string): string {
  return licence === 'CC-BY-4.0' ? 'CC BY 4.0' : licence
}

export type TombstoneKind = 'withdrawn' | 'complaint' | 'cascade'

/**
 * Which of the three lines a tombstone renders.
 *
 * The third exists so a blameless owner is never rendered as accused: a Class B cascade is
 * unconditional and knowingly destroys innocent people's published work, so the
 * complained-about line would read as an accusation against someone who is not accused.
 */
export function tombstoneKind(
  removalClass: RemovalClass | null | undefined,
  hasTombstonedAncestor: boolean,
): TombstoneKind {
  if (removalClass === 'B') return hasTombstonedAncestor ? 'cascade' : 'complaint'
  return 'withdrawn'
}

export interface TombstoneCopy {
  /** The word in the heading position. */
  heading: string
  /** The line, verbatim from §5.11's table. */
  line: string
}

/**
 * The three lines, verbatim. **No case reference and no complainant**: publishing the case
 * id invites correlation across takedowns, and naming the complainant in a personal-data
 * complaint would republish the exact data the takedown was for.
 */
export const TOMBSTONE_COPY: Record<TombstoneKind, TombstoneCopy> = {
  withdrawn: { heading: 'Withdrawn', line: 'Withdrawn by uploader.' },
  complaint: {
    heading: 'Removed',
    line: 'Removed following a rights or personal-data complaint.',
  },
  cascade: {
    heading: 'Removed',
    line: 'Removed because a programme it was forked from was removed following a complaint.',
  },
}

export interface LineageFacts {
  parentSlug: string | null
  parentTitle: string | null
  parentRevNo: number | null
  parentUploader: string | null
  revisionCount: number
  forkCount: number
  familyCount: number
}

/** A root reads *"root — nothing was forked to make it"*, which is a fact, not an absence. */
export const ROOT_LINEAGE = 'root — nothing was forked to make it'

export function isRoot(facts: Pick<LineageFacts, 'parentSlug'>): boolean {
  return facts.parentSlug === null
}
