import type { MetadataRoute } from 'next'
import { absoluteUrl, SITEMAP_STATIC_ROUTES } from '@/components/site/routes'
import { getDb } from '@/lib/db/client'
import { type SitemapSource, sitemapSource } from '@/lib/db/queries'

/**
 * `/sitemap.xml` (§7.16.2).
 *
 * ISR at one hour: one query, reading Postgres on **our** schedule once an hour and
 * serving cached bytes on the crawler's. Crawler volume does not enter the arithmetic.
 * Static-at-build loses on freshness rather than on cost — deploys happen on push, uploads
 * arrive continuously and *are* the product, so a build-time sitemap is wrong on day two.
 *
 * What it lists, with `lastModified` only:
 *   - `/` — `lastmod` = the newest published upload;
 *   - the other five static routes, **with no `lastModified`**, because those change by
 *     deploy and an unverifiable value is worse than none;
 *   - every published `/p/{slug}` — `lastmod` = the current revision's `uploaded_at`;
 *   - every listable `/u/{handle}`.
 *
 * **No `changeFrequency` and no `priority`** — both are ignored by Google, and
 * `priority: 0.8` is an unsubstantiable claim in a machine-readable file, which is §7.4's
 * rule arriving in XML.
 *
 * Deliberately absent: `/?page=N`; every `/p/{slug}/r/{n}`; every `/terms/v{n}` and
 * `/privacy/v{n}` — listing a URL you have canonicalised or `noindex`ed away argues
 * against yourself — and tombstoned and pending programmes, which fall out of the
 * published predicate with no exception written anywhere.
 */
export const revalidate = 3600

/**
 * An unreachable database yields the six static routes rather than a 500. A sitemap is a hint
 * to a crawler, and a hint that fails closed is better than a route that fails loudly — the
 * next revalidation an hour later picks the catalogue back up.
 */
async function loadSitemapSource(): Promise<SitemapSource> {
  try {
    return await sitemapSource(getDb())
  } catch {
    return { newestUploadAt: null, programmes: [], contributors: [] }
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { newestUploadAt, programmes, contributors } = await loadSitemapSource()

  const staticRoutes: MetadataRoute.Sitemap = SITEMAP_STATIC_ROUTES.map((route) =>
    route === '/' && newestUploadAt
      ? { url: absoluteUrl(route), lastModified: newestUploadAt }
      : { url: absoluteUrl(route) },
  )

  return [
    ...staticRoutes,
    ...programmes.map((programme) => ({
      url: absoluteUrl(`/p/${programme.slug}`),
      lastModified: programme.uploadedAt,
    })),
    ...contributors.map((contributor) => ({
      url: absoluteUrl(`/u/${contributor.handle}`),
    })),
  ]
}
