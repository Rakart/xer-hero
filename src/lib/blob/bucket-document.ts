/**
 * The bucket document — the one artefact `ops bucket apply` writes and `ops bucket check`
 * reads back (§5.6, §5.12).
 *
 * It lives here rather than inside either caller because **the same document applied twice**
 * is the whole point: CI applies it to MinIO, the operator applies it to R2, and the edge
 * contract asserts the presign's signed header set against it. Three readers, one parse. If
 * this were duplicated, the join the edge contract exists to make would be a join between two
 * copies rather than one decision.
 *
 * `<site-origin>` stays a placeholder in `ops/bucket/cors.json` and is resolved from
 * `SITE_ORIGIN` here, at apply time. The runbook's step 12 says to edit the file in place with
 * `https://xerhero.com`; that predates this resolution existing in code, and editing it would
 * both put a hostname literal in a repo artefact (§4.8 says no hostname is ever a literal) and
 * drop whatever origin the operator actually develops against.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface CorsRule {
  AllowedOrigins: string[]
  AllowedMethods: string[]
  AllowedHeaders: string[]
  ExposeHeaders?: string[]
  MaxAgeSeconds?: number
}

/**
 * `robots.txt` for the blob host, verbatim.
 *
 * 013 confined every piece of personal data to `original.xer.gz` and mitigated it with
 * "public and cacheable but not indexable". That mitigation has two halves: the
 * `X-Robots-Tag` set per-PUT by the presign, and this file. It is only coherent on a hostname
 * that is not the indexable site — a `robots.txt` governs its own scheme+host+port and nothing
 * else — which is the entire argument for `blobs.xerhero.com` existing as a separate hostname
 * rather than a path.
 */
export const ROBOTS_TXT = 'User-agent: *\nDisallow: /\n'

/** §4.3: the blob host's `robots.txt` is immutable — it never changes and never needs to. */
export const ROBOTS_CACHE_CONTROL = 'public, max-age=31536000, immutable'
export const ROBOTS_KEY = 'robots.txt'
export const ROBOTS_CONTENT_TYPE = 'text/plain'

/**
 * Read `ops/bucket/cors.json` and resolve its placeholder against the given origin.
 *
 * Origins that still contain a `<`ny unresolved placeholder are dropped rather than sent to
 * the store, so a document with a placeholder nobody filled fails loudly at the assertion
 * rather than quietly allowing an origin named `<site-origin>`.
 */
export function corsRules(siteOrigin: string): CorsRule[] {
  const raw: CorsRule[] = JSON.parse(
    readFileSync(join(process.cwd(), 'ops/bucket/cors.json'), 'utf8'),
  )
  return raw.map((rule) => ({
    ...rule,
    AllowedOrigins: [
      ...new Set(
        rule.AllowedOrigins.map((o) => (o === '<site-origin>' ? siteOrigin : o)).filter(
          (o) => !o.includes('<'),
        ),
      ),
    ],
  }))
}
