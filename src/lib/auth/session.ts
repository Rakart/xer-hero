import { auth } from '@clerk/nextjs/server'
import { env } from '@/lib/env'

/**
 * Session reads, and the one place the tier-1 "no Clerk keys" case is handled (§4.8, §4.9).
 *
 * `auth()` structurally cannot work outside the `clerkMiddleware` matcher, which is the
 * property §4.6.1 buys by narrowing it — so every caller of this module is under `/me`,
 * `/ops`, `/api` or one of the three upload routes, and nothing public may import it.
 *
 * **A no-auth dev mode is refused.** There is no `DEV_USER_ID` bypass and there must never be
 * one: Clerk ships no emulator, and the failure mode is asymmetric — a bypass honoured in
 * production makes every visitor the same user, silently. Tier 1 gets a signed-out surface
 * that says so, which is a working site rather than a fake account.
 */

export function clerkConfigured(): boolean {
  return env.clerkConfigured
}

/** The Clerk user id, or `null` — signed out, or Clerk not configured on this deployment. */
export async function clerkUserId(): Promise<string | null> {
  if (!env.clerkConfigured) return null
  const { userId } = await auth()
  return userId ?? null
}
