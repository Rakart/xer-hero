import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { activitiesKey, BLOB_CONTENT_TYPES, derivedKey, originalKey } from '@/lib/contracts/domain'
import { bucket, s3 } from './client'

/**
 * The three objects a revision owns, and the headers each is written under (§5.5, §10.4).
 *
 * Blobs are **id-addressed, not content-addressed**, so every key is computable from two
 * uuids and a version integer. That layout pays three times: a tombstone is one prefix
 * delete, a Class B cascade is N prefix deletes with no cross-referencing first, and the
 * purge list is a constant 3 URLs per revision — which matters because purge-by-prefix is
 * Enterprise-only and purge by explicit URL is on every plan.
 */

/**
 * The TTL split is one rule, not an exception: **the PI-bearing object is served under
 * different terms**, expressed by three properties on one object — `noindex`, a 1-hour TTL
 * and a 30-day Class B quarantine. At a year-long immutable TTL a silent purge failure looks
 * exactly like success; at an hour, purge is the fast path and the TTL is the backstop.
 */
export const ORIGINAL_CACHE_CONTROL = 'public, max-age=3600'
export const DERIVED_CACHE_CONTROL = 'public, max-age=31536000, immutable'
export const ORIGINAL_ROBOTS_TAG = 'noindex, noarchive'

/** Every object is stored gzipped; `Content-Type` describes what is *inside* the encoding. */
const GZIP = 'gzip'

export interface RevisionRef {
  programmeId: string
  revisionId: string
}

/**
 * The presigned PUT the browser uploads through (§5.4).
 *
 * Bytes go browser → R2 directly because Vercel caps a request body at 4.5 MB on every plan
 * against 4.8 MB and 6.8 MB real fixtures — the app server is not a viable path for them at
 * any size that matters.
 *
 * The URL carries an **exact content-length, not a range**: the client has already produced
 * the compressed blob and knows its byte count, and R2 rejects anything else, so the cap does
 * not rest on client honesty. `Cache-Control` and `X-Robots-Tag` are signed, which is why
 * both appear in the bucket's CORS `AllowedHeaders` — a browser sending an author-set header
 * needs it allowed at preflight.
 */
export async function presignOriginalPut(
  ref: RevisionRef,
  contentLength: number,
  expiresInSeconds = 900,
): Promise<{ url: string; key: string; headers: Record<string, string> }> {
  const key = originalKey(ref.programmeId, ref.revisionId)
  const headers = {
    'content-type': BLOB_CONTENT_TYPES.original,
    'content-encoding': GZIP,
    'cache-control': ORIGINAL_CACHE_CONTROL,
    'x-robots-tag': ORIGINAL_ROBOTS_TAG,
  }
  const url = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: BLOB_CONTENT_TYPES.original,
      ContentEncoding: GZIP,
      ContentLength: contentLength,
      CacheControl: ORIGINAL_CACHE_CONTROL,
      Metadata: {},
      // `x-robots-tag` is not a modelled S3 header; it rides as an unsigned-payload header
      // the client must send, and the bucket's CORS document allows it for that reason.
    }),
    { expiresIn: expiresInSeconds, unhoistableHeaders: new Set(['x-robots-tag']) },
  )
  return { url, key, headers }
}

/** Server-side PUT during ingest. Version-stamped in the key, so a bump writes a new object. */
export async function putDerived(
  ref: RevisionRef,
  version: number,
  gzippedBody: Uint8Array,
): Promise<string> {
  const key = derivedKey(ref.programmeId, ref.revisionId, version)
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: gzippedBody,
      ContentType: BLOB_CONTENT_TYPES.derived,
      ContentEncoding: GZIP,
      CacheControl: DERIVED_CACHE_CONTROL,
    }),
  )
  return key
}

export async function putActivities(ref: RevisionRef, gzippedBody: Uint8Array): Promise<string> {
  const key = activitiesKey(ref.programmeId, ref.revisionId)
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: gzippedBody,
      ContentType: BLOB_CONTENT_TYPES.activities,
      ContentEncoding: GZIP,
      CacheControl: DERIVED_CACHE_CONTROL,
    }),
  )
  return key
}

/**
 * Writes the original directly, bypassing the presigned hop. Used by seeding only, which
 * runs the real ingest path server-side and skips exactly two things: the browser parse and
 * the presigned PUT (§4.9).
 */
export async function putOriginal(ref: RevisionRef, gzippedBody: Uint8Array): Promise<string> {
  const key = originalKey(ref.programmeId, ref.revisionId)
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: gzippedBody,
      ContentType: BLOB_CONTENT_TYPES.original,
      ContentEncoding: GZIP,
      CacheControl: ORIGINAL_CACHE_CONTROL,
    }),
  )
  return key
}

/**
 * An object's stored size and headers, without pulling its bytes.
 *
 * The programme page prints the download's gzipped weight beside the control, and there is no
 * size column on `revision` to read it from. Fetching the object to measure it would put a
 * ~900 KB read on every render, which is exactly the two-layer cost model §6.8 sets out to
 * avoid — a `HEAD` is a Class B operation against a metadata lookup. Returns `null` rather
 * than throwing, because a missing figure is a control that renders without one.
 */
export async function headObject(
  key: string,
): Promise<{ contentLength: number; contentType?: string; cacheControl?: string } | null> {
  try {
    const result = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }))
    if (result.ContentLength === undefined) return null
    return {
      contentLength: result.ContentLength,
      contentType: result.ContentType,
      cacheControl: result.CacheControl,
    }
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

/** Reads an object's bytes as stored — still gzipped. Callers decompress. */
export async function getObject(key: string): Promise<Uint8Array | null> {
  try {
    const result = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }))
    const bytes = await result.Body?.transformToByteArray()
    return bytes ?? null
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

/**
 * Deletes everything under a revision's prefix — the tombstone primitive. One call per
 * revision, which is what makes a Class B fork-subtree cascade N prefix deletes rather than
 * a cross-referencing exercise.
 */
export async function deleteRevisionPrefix(ref: RevisionRef): Promise<string[]> {
  const prefix = `p/${ref.programmeId}/r/${ref.revisionId}/`
  const listed = await s3().send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix }))
  const keys = (listed.Contents ?? []).map((o) => o.Key).filter((k): k is string => Boolean(k))
  if (keys.length === 0) return []
  await s3().send(
    new DeleteObjectsCommand({
      Bucket: bucket(),
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    }),
  )
  return keys
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const name = (error as { name?: string }).name
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
  return name === 'NoSuchKey' || name === 'NotFound' || status === 404
}
