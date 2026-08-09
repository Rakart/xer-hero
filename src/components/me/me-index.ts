import type { ProgrammeStatus, RemovalClass, RevisionStatus } from '@/lib/contracts/domain'

/**
 * `/me`'s index line, as a pure function (§6.12).
 *
 * **`/me` is an index, and it is not the shelf row.** The row exists to be compared down a
 * column, and nobody compares their own uploads to each other — they are looking for one. A
 * `pending` Programme also has no float sliver, no S-curve, no DCMA strip and no activity
 * count, so the row would render it as nine empty slots, which reads as missing data rather
 * than as a state.
 *
 * One line, fixed left to right: **title · state chip · clause · rev · sector · age**, and
 * the clause slot is empty for an ordinary published Programme, which is the common case.
 */

export type MeState = 'published' | 'pending' | 'failed' | 'withdrawn' | 'removed' | 'cascaded'

export interface MeLineInput {
  programmeStatus: ProgrammeStatus
  /** The newest revision's status, which is what the chip reports. */
  revisionStatus: RevisionStatus | null
  removalClass: RemovalClass | null
  /** True when the programme this was forked from is itself tombstoned — a Class B cascade. */
  parentTombstoned: boolean
}

export function meLineState(input: MeLineInput): MeState {
  if (input.programmeStatus === 'tombstoned' || input.revisionStatus === 'tombstoned') {
    if (input.removalClass !== 'B') return 'withdrawn'
    // The third line exists so a blameless owner is never rendered as accused: the cascade is
    // unconditional and knowingly destroys innocent people's published work, so the
    // complained-about copy would read as an accusation against someone who is not accused.
    return input.parentTombstoned ? 'cascaded' : 'removed'
  }
  if (input.revisionStatus === 'failed') return 'failed'
  if (input.revisionStatus === 'pending' || input.revisionStatus === null) return 'pending'
  return 'published'
}

/** The chip. `null` for a published Programme — the common case draws no chip at all. */
export function meLineChip(state: MeState): string | null {
  switch (state) {
    case 'pending':
      return 'Processing'
    case 'failed':
      return 'Failed'
    case 'withdrawn':
      return 'Withdrawn'
    case 'removed':
    case 'cascaded':
      return 'Removed'
    default:
      return null
  }
}

/**
 * The clause. **`failure_reason` renders inline**, not behind a click: an index that says
 * `Failed` and makes you click for the only sentence you wanted is worse than no index.
 *
 * `revision.failure_detail` never renders here — it carries the exception and the parse
 * position, and `/ops` is its sole reader (§5.10).
 */
export function meLineClause(state: MeState, failureReason: string | null): string | null {
  switch (state) {
    case 'pending':
      return 'Usually a few seconds.'
    case 'failed':
      return failureReason
    case 'withdrawn':
      return 'Withdrawn by you.'
    case 'removed':
      return 'Removed following a rights or personal-data complaint.'
    case 'cascaded':
      return 'Removed because a programme it was forked from was removed following a complaint.'
    default:
      return null
  }
}

/** The uploader's retry is the file picker — no retry control is built anywhere (§5.8). */
export function meLineAction(state: MeState): { href: string; label: string } | null {
  return state === 'failed' ? { href: '/upload', label: 'Upload again →' } : null
}

/**
 * Every title links to `/p/{slug}` **only when the Programme is published**: an unpublished
 * `/p/{slug}` 404s to everyone, owner included, because a cached route cannot serve a 404 to
 * one viewer and a page to another. That is what makes `/me` the only owner-visible surface
 * for an unpublished upload.
 */
export function meLineLinks(state: MeState): boolean {
  return state !== 'pending' && state !== 'failed'
}

/**
 * The age slot: `2m`, `1h`, `8d`, `3mo`. Written out rather than taken from
 * `Intl.RelativeTimeFormat`, because the slot is two or three characters wide in a fixed
 * column and "3 months ago" is not that.
 */
export function shortAge(from: Date, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 1000))
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo`
  return `${Math.floor(days / 365)}y`
}
