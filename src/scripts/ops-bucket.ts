/**
 * `ops bucket apply` and `ops bucket check` (§5.12, §9.5, runbook steps 12 and 8 of 024).
 *
 *     pnpm ops:bucket apply
 *     pnpm ops:bucket check
 *
 * **It is an endpoint swap like everything else.** Pointed at `.env.local` it configures the
 * MinIO in `docker-compose.yml`; pointed at `.env.ops` it configures production R2. No vendor
 * is named here — `S3_ENDPOINT` decides which store answers, which is what lets CI assert
 * `ci.cors.document_applies` against a container and the operator assert the same document
 * against R2.
 *
 * `check` is the operator's drift detector: it reads the store back and diffs it against the
 * repo, exiting non-zero on any difference. 024 banned configuration reads *in the app* and
 * permitted them *on the laptop*, which is exactly the line this file sits on — it holds the
 * R2 admin credentials, and the app never does.
 *
 * Prints assertions, never object URLs or response bodies: this is runnable in CI, whose logs
 * on a public repo are world-readable.
 */

import {
  GetBucketCorsCommand,
  GetObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import {
  type CorsRule,
  corsRules,
  ROBOTS_CACHE_CONTROL,
  ROBOTS_CONTENT_TYPE,
  ROBOTS_KEY,
  ROBOTS_TXT,
} from '@/lib/blob/bucket-document'
import { bucket, s3 } from '@/lib/blob/client'
import { env } from '@/lib/env'

let failures = 0

function assert(label: string, condition: boolean, detail = '') {
  if (condition) console.log(`  ok    ${label}`)
  else {
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
    failures++
  }
}

/** Order is not meaningful in a CORS document, so compare as sets. */
function sameRules(a: CorsRule[], b: CorsRule[]): boolean {
  const norm = (rules: CorsRule[]) =>
    JSON.stringify(
      rules.map((r) => ({
        o: [...r.AllowedOrigins].sort(),
        m: [...r.AllowedMethods].sort(),
        h: [...r.AllowedHeaders].map((x) => x.toLowerCase()).sort(),
        e: [...(r.ExposeHeaders ?? [])].map((x) => x.toLowerCase()).sort(),
        a: r.MaxAgeSeconds ?? null,
      })),
    )
  return norm(a) === norm(b)
}

async function apply(rules: CorsRule[]): Promise<void> {
  console.log(`Applying the bucket document to ${bucket()}`)

  // MinIO answers `PutBucketCors` with 501 and takes its CORS from an environment variable
  // instead (`MINIO_API_CORS_ALLOW_ORIGIN` in `docker-compose.yml`). That is a real gap in
  // §5.6's "the same document applied twice", recorded rather than papered over: against MinIO
  // the *robots object* half still applies, and the CORS half is asserted statically by the
  // edge contract, which runs everywhere including a fork PR with no credentials.
  try {
    await s3().send(
      new PutBucketCorsCommand({ Bucket: bucket(), CORSConfiguration: { CORSRules: rules } }),
    )
    console.log('  ok    ops/bucket/cors.json applied')
  } catch (error) {
    if ((error as { Code?: string }).Code !== 'NotImplemented') throw error
    console.log('  skip  PutBucketCors — this store configures CORS out of band (MinIO)')
  }

  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: ROBOTS_KEY,
      Body: ROBOTS_TXT,
      ContentType: ROBOTS_CONTENT_TYPE,
      CacheControl: ROBOTS_CACHE_CONTROL,
    }),
  )
  console.log(`  ok    ${ROBOTS_KEY} written`)
}

async function check(rules: CorsRule[]): Promise<void> {
  console.log(`Checking ${bucket()} against the repo`)

  try {
    const live = await s3().send(new GetBucketCorsCommand({ Bucket: bucket() }))
    assert(
      'ops.cors.matches_repo',
      sameRules((live.CORSRules ?? []) as CorsRule[], rules),
      'the store disagrees with ops/bucket/cors.json',
    )
  } catch (error) {
    const code = (error as { Code?: string }).Code
    if (code === 'NotImplemented') console.log('  skip  GetBucketCors — not implemented (MinIO)')
    else assert('ops.cors.matches_repo', false, code ?? String(error))
  }

  const got = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: ROBOTS_KEY }))
  const body = await got.Body?.transformToString()
  assert('ops.robots.body_matches_repo', body === ROBOTS_TXT, JSON.stringify(body ?? null))
  assert('ops.robots.immutable', got.CacheControl === ROBOTS_CACHE_CONTROL, got.CacheControl ?? '')

  // `ops.r2dev.disabled` — the assertion §2 of 025's asset argued for. Two public origins for
  // the same bytes make a verified purge a lie: 017 step 3 purges the custom domain, 024's
  // `takedown.purge.landed` GETs it, sees a non-200 and writes `bytes_deleted_at` while the
  // object is still fetchable at `pub-….r2.dev`. This is a *config read*, which 024 permitted
  // on the laptop and banned in the app. Skipped when there is no Cloudflare token, which is
  // every local and CI run.
  const token = process.env.CLOUDFLARE_API_TOKEN
  const account = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!token || !account) {
    console.log('  skip  ops.r2dev.disabled — no Cloudflare credentials (local or CI)')
    return
  }
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${bucket()}/domains/managed`,
    { headers: { authorization: `Bearer ${token}` } },
  )
  const payload = (await response.json()) as { success: boolean; result?: { enabled?: boolean } }
  assert(
    'ops.r2dev.disabled',
    payload.success && payload.result?.enabled === false,
    payload.success ? `enabled=${payload.result?.enabled}` : 'the managed-domain read failed',
  )
}

const verb = process.argv[2]
const rules = corsRules(env.siteOrigin)

// `.env.ops` is loaded last and therefore wins, which is what points this at production from
// the operator's laptop — and is also the one way to run it against production by accident.
// Name the target before touching it; `xerhero` is MinIO and `xerhero-blobs` is R2.
console.log(
  `  store ${new URL(env.s3.endpoint).host} | bucket ${bucket()} | origins ${rules.flatMap((r) => r.AllowedOrigins).join(' ')}`,
)

if (verb === 'apply') await apply(rules)
else if (verb === 'check') await check(rules)
else {
  console.error('usage: pnpm ops:bucket <apply|check>')
  process.exit(2)
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`)
  process.exit(1)
}
