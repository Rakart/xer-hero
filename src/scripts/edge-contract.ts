/**
 * The edge contract (§9.5, job 4).
 *
 * This exists to make the presign's **signed header set** and the bucket's CORS
 * `AllowedHeaders` formally one decision. The preflight below sends an
 * `Access-Control-Request-Headers` list **derived from the presign's own output** rather than
 * from a constant, so changing either side alone is a CI failure — one test failure instead of
 * two unrelated incidents six weeks apart.
 *
 * It runs against MinIO locally and in CI, and the same document is what the operator applies
 * to R2. The same artefact applied twice is the point: local CORS and production CORS are one
 * thing rather than two things that resemble each other.
 *
 * Prints assertions, never object URLs or response bodies.
 */

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HeadObjectCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3'
import { bucket, s3 } from '@/lib/blob/client'
import { gzip } from '@/lib/blob/gzip'
import { presignOriginalPut } from '@/lib/blob/objects'
import { env } from '@/lib/env'

let failures = 0

function assert(label: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`  ok    ${label}`)
  } else {
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
    failures++
  }
}

interface CorsRule {
  AllowedOrigins: string[]
  AllowedMethods: string[]
  AllowedHeaders: string[]
  ExposeHeaders?: string[]
  MaxAgeSeconds?: number
}

async function main() {
  console.log('Edge contract — presign, PUT, HEAD, preflight')

  // 1. Apply the repo's bucket document. `<site-origin>` is a placeholder until provisioning
  //    step 12; locally the localhost origin is what the browser actually uses.
  const raw: CorsRule[] = JSON.parse(
    readFileSync(join(process.cwd(), 'ops/bucket/cors.json'), 'utf8'),
  )
  const rules = raw.map((rule) => ({
    ...rule,
    AllowedOrigins: rule.AllowedOrigins.map((o) =>
      o === '<site-origin>' ? env.siteOrigin : o,
    ).filter((o) => !o.includes('<')),
  }))
  await s3().send(
    new PutBucketCorsCommand({
      Bucket: bucket(),
      CORSConfiguration: { CORSRules: rules },
    }),
  )
  console.log('  ok    ops/bucket/cors.json applied')

  // 2. Presign exactly as the app does.
  const ref = { programmeId: randomUUID(), revisionId: randomUUID() }
  const body = gzip('ERMHDR\t8.3\t2026-08-09\tProject\tadmin\tAdmin\tdb\tProject Management\tUSD\n')
  const { url, key, headers } = await presignOriginalPut(ref, body.byteLength)

  assert(
    'the presign signs content-type, cache-control and x-robots-tag',
    ['content-type', 'cache-control', 'x-robots-tag'].every((h) => h in headers),
    Object.keys(headers).join(','),
  )
  assert(
    'the PI-bearing object gets the short TTL, not immutable',
    headers['cache-control'] === 'public, max-age=3600',
  )
  assert('the PI-bearing object is noindex', headers['x-robots-tag'] === 'noindex, noarchive')
  assert(
    'the key is id-addressed',
    key === `p/${ref.programmeId}/r/${ref.revisionId}/original.xer.gz`,
  )

  // 3. Execute the presigned PUT, sending exactly the headers the presign named — which is
  //    what a browser is obliged to do for a SigV4 presigned request.
  const put = await fetch(url, { method: 'PUT', headers, body: new Blob([body]) })
  assert('the presigned PUT is accepted', put.ok, `status ${put.status}`)

  // 4. HEAD it back and confirm the headers survived the write.
  const head = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }))
  assert('the object exists at its computed key', head.ContentLength === body.byteLength)
  assert('cache-control survived the write', head.CacheControl === headers['cache-control'])
  assert(
    'content-type describes what is inside the encoding',
    head.ContentType === 'text/plain; charset=windows-1252',
    head.ContentType ?? 'absent',
  )
  assert('content-encoding is gzip', head.ContentEncoding === 'gzip')

  // 5. The preflight. The requested header list comes from the presign's own output — this is
  //    the join that makes the two sides one decision. `content-length` is deliberately never
  //    in it: browsers set it themselves and forbid authors from setting it.
  const requested = Object.keys(headers)
    .filter((h) => h !== 'content-length')
    .sort()
    .join(', ')
  const preflight = await fetch(url.split('?')[0]!, {
    method: 'OPTIONS',
    headers: {
      origin: env.siteOrigin,
      'access-control-request-method': 'PUT',
      'access-control-request-headers': requested,
    },
  })
  assert('the preflight is allowed', preflight.status < 400, `status ${preflight.status}`)
  const allowOrigin = preflight.headers.get('access-control-allow-origin')
  assert('the preflight echoes an allowed origin', Boolean(allowOrigin), 'no allow-origin header')

  const allowedHeaders = (preflight.headers.get('access-control-allow-headers') ?? '').toLowerCase()
  for (const header of Object.keys(headers)) {
    if (header === 'content-length') continue
    assert(
      `the bucket allows the signed header ${header}`,
      allowedHeaders.includes(header) || allowedHeaders.includes('*'),
      allowedHeaders || 'none advertised',
    )
  }

  console.log(failures === 0 ? '\nEdge contract holds.' : `\n${failures} edge assertion(s) failed.`)
  if (failures > 0) process.exit(1)
}

await main()
