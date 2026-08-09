import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { Db } from '@/lib/db/client'
import { type AppUser, appUser, reservedHandle } from '@/lib/db/schema'
import { uniqueHandle } from './handle'

/**
 * The `app_user` lifecycle (§6.12, §4.7).
 *
 * A row is created on the **first authenticated write of any kind — a vote, a bookmark or a
 * presign** — with a generated Handle. **Reads create nothing**: `/me` for a signed-in user
 * who has never written renders three empty states rather than a row, and `/api/viewer`
 * answers `handle: null` for the same person.
 *
 * There is no Clerk webhook behind this. `user.created` would cost a public endpoint, a
 * signing secret, svix and retry semantics to move a row creation off a path that already
 * needs it.
 *
 * The Handle is authoritative **in our Postgres, never in Clerk's `username`**, and no
 * Google identity ever enters the schema — `app_user` holds `clerk_user_id`, the Handle and
 * `created_at`, and that is the whole of it (§4.7).
 */

/** `citext` makes both comparisons case-insensitive by construction rather than by memory. */
export async function handleTaken(db: Db, candidate: string): Promise<boolean> {
  const [live] = await db
    .select({ name: appUser.display_name })
    .from(appUser)
    .where(eq(appUser.display_name, candidate))
    .limit(1)
  if (live) return true
  const [retired] = await db
    .select({ name: reservedHandle.name })
    .from(reservedHandle)
    .where(eq(reservedHandle.name, candidate))
    .limit(1)
  return Boolean(retired)
}

/** A read. It creates nothing — that rule is the whole point of this module (§6.12). */
export async function findAppUser(db: Db, clerkUserId: string): Promise<AppUser | undefined> {
  const [row] = await db
    .select()
    .from(appUser)
    .where(eq(appUser.clerk_user_id, clerkUserId))
    .limit(1)
  return row
}

/**
 * The first-authenticated-write path. Called by presign, by a vote and by a bookmark, and by
 * nothing else.
 *
 * `on conflict do nothing` with **no conflict target** is deliberate: two concurrent first
 * writes race on `clerk_user_id`, and two unlucky mints race on `display_name`. Untargeted,
 * one statement absorbs both, and the re-select returns whichever row won.
 */
export async function ensureAppUser(db: Db, clerkUserId: string): Promise<AppUser> {
  const existing = await findAppUser(db, clerkUserId)
  if (existing) return existing

  const handle = await uniqueHandle((candidate) => handleTaken(db, candidate))
  await db
    .insert(appUser)
    .values({
      id: randomUUID(),
      clerk_user_id: clerkUserId,
      display_name: handle,
      created_at: new Date(),
    })
    .onConflictDoNothing()

  const created = await findAppUser(db, clerkUserId)
  if (!created) throw new Error('app_user row could not be created')
  return created
}

/**
 * Retires a Handle permanently — written on rename and on deletion, and **never reassigned**,
 * because a wasted row is cheaper than a conditional (§2.11). Idempotent, so a retried
 * account deletion cannot fail on its own second attempt.
 */
export async function retireHandle(db: Db, name: string): Promise<void> {
  await db.insert(reservedHandle).values({ name, released_at: new Date() }).onConflictDoNothing()
}
