/**
 * Slug and handle construction (§2.11).
 *
 * `programme.slug` is unique and **immutable**, generated from the title at creation with a
 * numeric suffix on collision. Immutability is load-bearing: titles are editable, so a frozen
 * slug means no redirect table, no link rot and no alias history. A slug drifting from a
 * renamed title is cosmetic.
 *
 * Collision suffixes are the **normal case, not a failure** — Forks prefill their title from
 * the parent, so a shelf reading `riverside-depot`, `riverside-depot-2` is honest about what
 * those two things are.
 */

const MAX_SLUG_LENGTH = 80

/** Reserved because they are, or could become, route segments at the same depth as a slug. */
const RESERVED_SLUGS = new Set([
  'about',
  'contributors',
  'me',
  'ops',
  'privacy',
  'report',
  'robots.txt',
  'sitemap.xml',
  'terms',
  'u',
  'upload',
  'p',
])

export function slugify(title: string): string {
  const base = title
    .normalize('NFKD')
    // Strip diacritics rather than transliterate: a `.xer` is CP1252 and a title carrying an
    // accented character should keep its letter, not acquire a different one.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '')
  return base || 'programme'
}

/**
 * Resolves a slug against what already exists. `taken` is asked rather than a table scanned,
 * so the caller decides whether that is a query or a set held in memory during a seed.
 */
export async function uniqueSlug(
  title: string,
  taken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(title)
  const first = RESERVED_SLUGS.has(base) ? `${base}-programme` : base
  if (!(await taken(first))) return first
  for (let n = 2; n < 1000; n++) {
    const candidate = `${first}-${n}`
    if (!(await taken(candidate))) return candidate
  }
  throw new Error(`Could not find a free slug for "${title}"`)
}

/**
 * Handles are unique case-insensitively (`citext`) and are never reassigned — a Handle is
 * written to `reserved_handle` on rename and on deletion, even one generated but never
 * published, because a wasted row is cheaper than a conditional.
 */
export function normaliseHandle(handle: string): string {
  return handle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
}
