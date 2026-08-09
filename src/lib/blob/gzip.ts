import { gunzipSync, gzipSync } from 'node:zlib'
import { MAX_FILE_BYTES } from '@/lib/contracts/domain'

/**
 * Server-side gzip. Node built-ins are fine here — this module is never imported by the
 * parser, which stays isomorphic (§4.1). The browser gzips with `CompressionStream` on its
 * own side of the presigned PUT.
 */

export function gzip(bytes: Uint8Array | string): Uint8Array<ArrayBuffer> {
  const input = typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : bytes
  return new Uint8Array(gzipSync(input))
}

export class DecompressionLimitError extends Error {
  constructor(limit: number) {
    super(`Decompressed payload exceeded the ${limit}-byte cap and was aborted`)
    this.name = 'DecompressionLimitError'
  }
}

/**
 * Decompresses with a **hard byte limit**, defaulting to the 60 MB raw cap.
 *
 * This is not defensive dressing: a 12 MB gzip member can expand to gigabytes, and the
 * upload cap is enforced on the *compressed* length at presign time. Without a limit here,
 * the byte cap is being enforced on the wrong number (§5.4).
 */
export function gunzipBounded(bytes: Uint8Array, limit = MAX_FILE_BYTES): Uint8Array {
  const out = gunzipSync(bytes, { maxOutputLength: limit })
  return new Uint8Array(out)
}

/** As above, but reports the cap breach as our own error rather than zlib's. */
export function gunzipCapped(bytes: Uint8Array, limit = MAX_FILE_BYTES): Uint8Array {
  try {
    return gunzipBounded(bytes, limit)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('maxOutputLength') || message.includes('Output length exceeded')) {
      throw new DecompressionLimitError(limit)
    }
    throw error
  }
}
