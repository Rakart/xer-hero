import { S3Client } from '@aws-sdk/client-s3'
import { env } from '@/lib/env'

/**
 * One S3 client, pointed at whatever `S3_ENDPOINT` says — MinIO locally, R2 in production.
 * This is the whole blob half of the dev↔production swap (§4.9): stock `@aws-sdk/client-s3`
 * against an endpoint, no adapter and no interface. A filesystem blob adapter was rejected
 * precisely because it would be the one option whose dev path can silently diverge — a stub
 * PUT endpoint writing to a directory shares no code with a presigned PUT to an S3 API.
 */
let client: S3Client | undefined

export function s3(): S3Client {
  if (client) return client
  const config = env.s3
  client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // MinIO serves path-style; R2 accepts it. Virtual-host style would require the bucket
    // name in the hostname, which the endpoint swap cannot express.
    forcePathStyle: true,
    // §5.6: SDK v3 computes a request checksum by default (`WHEN_SUPPORTED`), which adds
    // `x-amz-checksum-crc32` to a PUT. On a *presigned* browser PUT that silently becomes a
    // required signed header the browser must reproduce, and it has broken R2 and MinIO
    // presigned PUTs widely since early 2025. The set of signed headers is a dependency's
    // decision as much as ours, so we take it back: checksums only where the API demands one.
    requestChecksumCalculation: 'WHEN_REQUIRED',
  })
  return client
}

export function bucket(): string {
  return env.s3.bucket
}

/** The public URL for a key. No URL is ever stored in Postgres — keys are computed (§5.5). */
export function publicUrl(key: string): string {
  return `${env.blobPublicOrigin.replace(/\/$/, '')}/${key}`
}
