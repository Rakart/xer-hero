/**
 * Environment access, in one place.
 *
 * Two of these names are the entire dev↔production difference (§4.9): `S3_ENDPOINT` swaps
 * MinIO for R2, and `NEON_FETCH_ENDPOINT` swaps the local HTTP proxy for Neon itself. Both
 * substitutions are **endpoint swaps, not adapters** — the production clients are already
 * vendor-neutral, and no vendor is named anywhere in product code. Keeping the reads here
 * rather than scattered is what makes that checkable by grep.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local — its local-dev ` +
        'defaults are committed on purpose and guard nothing.',
    )
  }
  return value
}

function optional(name: string): string | undefined {
  const value = process.env[name]
  return value === '' ? undefined : value
}

export const env = {
  get siteOrigin(): string {
    return process.env.SITE_ORIGIN ?? 'http://localhost:3000'
  },

  get databaseUrl(): string {
    return required('DATABASE_URL')
  },

  /** Present locally, absent in production, where the driver talks to Neon directly. */
  get neonFetchEndpoint(): string | undefined {
    return optional('NEON_FETCH_ENDPOINT')
  },

  get s3(): {
    endpoint: string
    region: string
    bucket: string
    accessKeyId: string
    secretAccessKey: string
  } {
    return {
      endpoint: required('S3_ENDPOINT'),
      region: process.env.S3_REGION ?? 'auto',
      bucket: required('S3_BUCKET'),
      accessKeyId: required('S3_ACCESS_KEY_ID'),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
    }
  },

  /** Never a literal in code, so CI can point the same code at MinIO (§4.8). */
  get blobPublicOrigin(): string {
    return required('BLOB_PUBLIC_ORIGIN')
  },

  /** Blank in tier 1. Every signed-out surface works without them (§4.9). */
  get clerkConfigured(): boolean {
    return Boolean(optional('CLERK_SECRET_KEY') && optional('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'))
  },

  get turnstileSecret(): string | undefined {
    return optional('TURNSTILE_SECRET_KEY')
  },

  /** One greppable equality; changing it is a redeploy (§4.8). */
  get opsAllowedUserIds(): readonly string[] {
    const raw = optional('OPS_ALLOWED_USER_IDS')
    if (!raw) return []
    return raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  },
}
