import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Metadata } from 'next'
import { firstSentence, parseMarkdown } from './markdown'

/**
 * The versioned legal texts: where the files live, which version is current, and how a
 * version number resolves to a pair of URLs (§7.10).
 *
 * Read from `docs/legal/` with `node:fs` at module scope. Both legal routes are
 * `force-static`, so every read happens during `next build` and no file is read at
 * runtime — the pages touch neither Postgres nor a blob and cost nothing after the build.
 *
 * Three rules from §7.10 that this module exists to keep true:
 *   1. One version number names BOTH documents. A bump ships both files even when one is
 *      byte-identical to its predecessor.
 *   2. A shipped file is never edited — not for substance, not for a typo, not for a
 *      broken link. Repo history is the audit trail; a typo in v1 costs a v2.
 *   3. The stored value is the string `v{n}`, so rendering "the version you agreed to"
 *      is string concatenation and never a lookup.
 */

export type LegalKind = 'terms' | 'privacy'

export const LEGAL_KINDS: readonly LegalKind[] = ['terms', 'privacy']

/**
 * The single repo constant of §7.10. `revision.terms_version` stores exactly this string,
 * and it resolves to `/terms/{v}` and `/privacy/{v}` — two URLs that both exist.
 */
export const CURRENT_TERMS_VERSION = 'v1'

/**
 * The date each version shipped, for the page header block's "Last changed" line. Kept
 * in code rather than inside the markdown because the header block is generated around
 * an immutable file, not part of it.
 */
export const LEGAL_VERSION_DATES: Record<string, string> = {
  v1: '2026-08-09',
}

export const LEGAL_TITLES: Record<LegalKind, string> = {
  terms: 'Terms of use',
  privacy: 'Privacy policy',
}

const LEGAL_DIR = join(process.cwd(), 'docs', 'legal')

const VERSION_FILE = /^(terms|privacy)-v(\d+)\.md$/

/** `'v1'` → `1`; anything else → `null`, which is how an unknown path 404s. */
export function versionNumber(version: string): number | null {
  const match = /^v(\d+)$/.exec(version)
  if (!match) return null
  const n = Number(match[1])
  return Number.isSafeInteger(n) && n >= 1 ? n : null
}

/**
 * Every version that has shipped, ascending. Derived from the files on disk rather than
 * from a list, so a pair that was added without bumping the constant still resolves —
 * and CI's "both files named by `CURRENT_TERMS_VERSION` exist" assertion has something
 * to assert against.
 */
export function shippedVersions(): string[] {
  const numbers = new Set<number>()
  for (const name of readdirSync(LEGAL_DIR)) {
    const match = VERSION_FILE.exec(name)
    if (match) numbers.add(Number(match[2]))
  }
  return [...numbers].sort((a, b) => a - b).map((n) => `v${n}`)
}

export function legalFilePath(kind: LegalKind, version: string): string {
  return join(LEGAL_DIR, `${kind}-${version}.md`)
}

export function readLegalDocument(kind: LegalKind, version: string): string {
  return readFileSync(legalFilePath(kind, version), 'utf8')
}

/** `/terms/v3` and `/privacy/v3` — the pair a stored `terms_version` resolves to. */
export function legalHref(kind: LegalKind, version: string): string {
  return `/${kind}/${version}`
}

/**
 * §7.16.3's rule for the `/terms/v{n}` and `/privacy/v{n}` route class, as a pure function.
 *
 * The **current** version canonicalises to the bare route and carries **no** `noindex` —
 * the two are never emitted together, because a canonical pointing elsewhere says "this
 * page is the same as that one" and a `noindex` says "remove this page" about one cluster.
 *
 * A **superseded** version carries `noindex, follow` and a **self** canonical, never a
 * canonical pointing at the current text: saying a superseded version is the same document
 * as the current one contradicts the exact thing the audit trail depends on being false.
 * It gets no `Disallow` either — there are few of them, each has an inbound link that must
 * keep working, and the point is to stop them being *listed*, not *fetched*.
 */
export function legalCrawlDirectives(
  kind: LegalKind,
  version: string,
): { canonical: string; noindex: boolean } {
  const current = version === CURRENT_TERMS_VERSION
  return { canonical: current ? `/${kind}` : legalHref(kind, version), noindex: !current }
}

/** The head tags for a numbered legal URL, built from {@link legalCrawlDirectives}. */
export function legalVersionMetadata(kind: LegalKind, version: string): Metadata {
  const { canonical, noindex } = legalCrawlDirectives(kind, version)
  const title = `${LEGAL_TITLES[kind]} — version ${versionNumber(version)}`
  const description = firstSentence(parseMarkdown(readLegalDocument(kind, version)))

  return {
    title: { absolute: `${title} — xer-hero` },
    description,
    alternates: { canonical },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title, description },
  }
}
