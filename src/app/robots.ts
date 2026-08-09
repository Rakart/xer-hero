import type { MetadataRoute } from 'next'
import { SHELF_QUERY_PARAMS, SITE_ORIGIN } from '@/components/site/routes'

/**
 * `robots.txt` — a generated route rather than a static text file (§7.16.1), because the
 * disallow list is derived from `SHELF_QUERY_PARAMS`, the same constant the shelf's URL
 * builder uses. Adding a fifth facet without disallowing it is then a test failure rather
 * than an unbounded crawl discovered six months later.
 *
 * Four things about this file are decisions, not omissions:
 *
 *   - **`page=` is absent from the disallow list, on purpose.** `/?page=3` stays crawlable;
 *     `/?sector=rail&page=3` does not, because the `sector=` rule already matches it. The
 *     crawl-path argument was always about the unfiltered numbered sequence, and a filter
 *     is by construction a subset of a page that is already crawlable.
 *   - **One `User-agent: *` group. No per-agent rules, no AI-crawler block, no
 *     `Crawl-delay`.** Crawl-delay is unsupported. The AI block is refused on the licence:
 *     this site publishes every programme under CC-BY 4.0, and a `robots.txt` saying
 *     *anyone may reuse this except you* is incoherent against the licence in the footer.
 *   - **There is no `Noindex:` line and never will be** — that rule was retired from
 *     `robots.txt` handling in 2019.
 *   - **No bare `Disallow: /`.** The blob host's file on a different origin says exactly
 *     that (§7.9), and the failure mode this defends against is a copy-paste: a site
 *     serving `Disallow: /` looks completely normal and is completely invisible. CI
 *     asserts it, and the same assertion runs against production every 15 minutes.
 *
 * `Disallow` and `noindex` are mirror instruments and are never used together (§7.16.3):
 * facet URLs get `Disallow` and no robots meta at all.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [...SHELF_QUERY_PARAMS.map((param) => `/*?*${param}=`), '/me/', '/ops', '/api/'],
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  }
}
