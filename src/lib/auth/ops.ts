import { env } from '@/lib/env'

/**
 * `/ops` authorisation, entire (§4.7, §5.10).
 *
 * An **env-var allowlist of Clerk user ids, checked as one equality against the session**:
 * zero schema, no role in a vendor dashboard, no grant UI, and the whole authz rule is one
 * greppable line a contributor can audit. Changing it is a redeploy, which is correct
 * friction for the only privileged surface in the system.
 *
 * `/ops` is strictly read-only, so there is no write-authz reasoning behind this, no CSRF
 * surface and no misclick story — every operator *write* is in the CLI (§5.12).
 */
export function isOperator(clerkUserId: string | null | undefined): boolean {
  if (!clerkUserId) return false
  return env.opsAllowedUserIds.includes(clerkUserId)
}
