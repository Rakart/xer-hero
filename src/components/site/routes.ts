/**
 * The route and identity constants the chrome, `robots.txt` and the sitemap all build
 * from. Every value here is fixed by the spec; none is a build-time judgement call.
 *
 * `PUBLIC_ROUTES` and `SHELF_QUERY_PARAMS` are named as real constants by §6.1 and
 * §7.16.1 precisely so that adding a public route or a fifth facet without updating the
 * middleware matcher or the disallow list is a test failure rather than a silently
 * uncached page or an unbounded crawl.
 */

/** Apex throughout (§7). `SITE_ORIGIN` is server-side only — never read in a client bundle. */
export const SITE_ORIGIN = process.env.SITE_ORIGIN ?? 'http://localhost:3000'

export const SITE_NAME = 'xer-hero'

/**
 * The header strap, verbatim (§1.5). It is also the root Open Graph description
 * (§7.16.5) — the same string in both places, because §7.16.5's rule is that no OG
 * string in this site is authored.
 */
export const SITE_STRAP = 'Public Primavera P6 programmes. Browse, download, fork.'

/** Apache-2.0, public, and where `docs/legal/*.md` history — the audit trail — lives. */
export const SOURCE_REPO_URL = 'https://github.com/Rakart/xer-hero'

export const CC_BY_URL = 'https://creativecommons.org/licenses/by/4.0/'

/** §7.19 — printed on `/report` and named in the legal texts. Nowhere else in any markup. */
export const OPERATOR_MAILBOX = 'carlos.greblo@gmail.com'

export const OPERATOR_NAME = 'Carlo Greblo'

/**
 * The shelf's four facets plus `q` and `sort` (§1.5). `page` is deliberately absent:
 * `/?page=3` stays crawlable, and `/?sector=rail&page=3` does not because the `sector=`
 * rule already matches it (§7.16.1).
 */
export const SHELF_QUERY_PARAMS = ['sector', 'size', 'p6', 'progressed', 'q', 'sort'] as const

export type ShelfQueryParam = (typeof SHELF_QUERY_PARAMS)[number]

/**
 * Every route readable signed-out. CI evaluates the exported `clerkMiddleware` matcher
 * against this list — no public route may match it (§6.1). Dynamic segments are written
 * in `:param` form because the assertion is about prefixes, not about matching.
 */
export const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/terms',
  '/terms/:version',
  '/privacy',
  '/privacy/:version',
  '/contributors',
  '/report',
  '/p/:slug',
  '/p/:slug/r/:n',
  '/u/:handle',
  '/robots.txt',
  '/sitemap.xml',
] as const

/**
 * The six static routes the sitemap lists (§7.16.2). `/` carries a `lastModified` taken
 * from the newest published upload; the other five carry none, because they change by
 * deploy and an unverifiable value is worse than none.
 */
export const SITEMAP_STATIC_ROUTES = [
  '/',
  '/about',
  '/terms',
  '/privacy',
  '/contributors',
  '/report',
] as const

/**
 * Exactly six links, in this order (§7.14). No `mailto:`, no cookie link, no licence
 * badge, no catalogue count, and no repeat of `/`, `/upload` or `/me` — the header
 * already carries those and a footer that repeats the nav is a sitemap nobody reads.
 */
export const FOOTER_LINKS = [
  { label: 'About', href: '/about' },
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Contributors', href: '/contributors' },
  { label: 'Report a problem', href: '/report' },
  { label: 'Source', href: SOURCE_REPO_URL },
] as const

/**
 * Where the header's signed-out control points.
 *
 * `/me` is inside the `clerkMiddleware` matcher (§4.6.1) and every public route is
 * outside it, so a signed-out click lands on the one surface that *can* redirect to
 * Clerk and come back. No `/sign-in` route is invented: §1.5's URL set is closed, and
 * the header may not read the session to decide anything server-side.
 */
export const SIGN_IN_HREF = '/me'

/** The header's signed-in cluster: `Upload · {Handle}`, the Handle linking to `/me` (§6.3). */
export const UPLOAD_HREF = '/upload'
export const OWN_SPACE_HREF = '/me'

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_ORIGIN).toString()
}
