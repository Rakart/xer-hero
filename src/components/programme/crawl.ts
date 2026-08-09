/**
 * The head tags for the two programme routes (§7.16.3, §7.16.5).
 *
 * Two governing rules, and swapping them is the bug:
 *
 * - **A URL emits a canonical pointing elsewhere, *or* a `noindex`, never both.** Together
 *   they say "this page is the same as that one" and "remove this page" about one cluster.
 * - **`Disallow` and `noindex` are mirror instruments and are never used together.** These
 *   routes are `Allow`ed and few in number, each with an inbound link that must keep
 *   working, so they get `noindex` and no `Disallow`.
 *
 * A superseded revision is **not** a duplicate of the current one — rev 7 of a two-year
 * monthly series is a different programme's worth of dates, floats and DCMA marks — so it
 * self-canonicalises and is de-listed, rather than making a false duplicate claim.
 *
 * Every OG value is a fixed template over Postgres columns, **never over `derived.json`**,
 * precisely so it still renders for a tombstoned programme whose blobs no longer exist.
 */

import { SITE_NAME, SITE_STRAP } from '@/components/site'

export interface HeadRules {
  /** Path only; `metadataBase` in the root layout makes it absolute. */
  canonicalPath: string
  /** `noindex, follow`. Never set at the same time as a foreign canonical. */
  noindex: boolean
}

export function programmePath(slug: string): string {
  return `/p/${slug}`
}

export function revisionPath(slug: string, revNo: number): string {
  return `/p/${slug}/r/${revNo}`
}

/** `/p/{slug}` — self-canonical always; `noindex, follow` from the moment a tombstone commits. */
export function programmeHead(slug: string, tombstoned: boolean): HeadRules {
  return { canonicalPath: programmePath(slug), noindex: tombstoned }
}

/**
 * `/p/{slug}/r/{n}` — the estate's only true duplicate pair is the current revision, which
 * is byte-identical HTML at two URLs, so it canonicalises to the bare route and carries no
 * robots meta. Everything else self-canonicalises and is de-listed.
 */
export function revisionHead(
  slug: string,
  revNo: number,
  opts: { isCurrent: boolean; tombstoned: boolean },
): HeadRules {
  if (opts.isCurrent && !opts.tombstoned) {
    return { canonicalPath: programmePath(slug), noindex: false }
  }
  return { canonicalPath: revisionPath(slug, revNo), noindex: true }
}

export interface OgFacts {
  title: string
  /** From `revision.activity_count`, which is null until ingest writes it. */
  activityCount: number | null
  /** The label, or `Unsectored` — blank is plausibly the largest bucket. */
  sectorLabel: string | null
  p6Version: string | null
  pctComplete: number | null
  handle: string
  /** Set on `/p/{slug}/r/{n}`; the bare route omits it. */
  revNo?: number
}

export interface OgStrings {
  title: string
  description: string
}

/**
 * The site defaults, emitted whole for a tombstone. The title stays visible *on the page*,
 * which is a URL somebody already holds; an unfurl is the same title travelling outward
 * into a channel nobody asked.
 */
export const OG_DEFAULTS: OgStrings = { title: SITE_NAME, description: SITE_STRAP }

/**
 * The published template. **The uploader's free-text description is never used** — it is
 * optional, empty for the guaranteed state of an uncaring upload, and a snippet is where
 * the wording rules are least enforceable when the words are somebody else's.
 */
export function ogStrings(facts: OgFacts): OgStrings {
  const progress =
    facts.pctComplete === null || facts.pctComplete <= 0
      ? 'Not started'
      : `${facts.pctComplete}% complete`
  const parts = [
    `${facts.activityCount === null ? 'Unknown' : facts.activityCount.toLocaleString('en-GB')} activities`,
    facts.sectorLabel ?? 'Unsectored',
    `P6 ${facts.p6Version ?? 'unknown'}`,
    progress,
    `uploaded by ${facts.handle}`,
    'CC-BY 4.0',
  ]
  return {
    title: facts.revNo === undefined ? facts.title : `${facts.title} — rev ${facts.revNo}`,
    description: parts.join(' · '),
  }
}
