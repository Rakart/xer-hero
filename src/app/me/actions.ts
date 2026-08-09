'use server'

import { clerkClient } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { findAppUser, handleTaken, retireHandle } from '@/lib/auth/app-user'
import { handleProblem } from '@/lib/auth/handle'
import { clerkUserId } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { appUser, uploaderVote } from '@/lib/db/schema'
import { normaliseHandle } from '@/lib/identity'

/**
 * The two writes on `/me/account` (§6.12).
 *
 * Everything else on `/me` writes nothing: **`/me` writes nothing about a Programme**, and
 * every Programme-scoped write lives on that Programme's own page. These two are about the
 * account, which is the one thing `/me` owns.
 */

export type AccountState = { status: 'idle' | 'ok' | 'error'; message?: string }

export const ACCOUNT_INITIAL_STATE: AccountState = { status: 'idle' }

/**
 * *"Changing your Handle retires the old one permanently. Nobody can claim it afterwards,
 * including you. Programmes you have already published keep the Handle they were uploaded
 * under."*
 *
 * That last clause is not a caveat, it is the mechanism: `revision.uploader_display_name` is
 * a **snapshot, never a join**, which is what makes account deletion work at all (§2.11).
 */
export async function renameHandle(_previous: AccountState, form: FormData): Promise<AccountState> {
  const clerkId = await clerkUserId()
  if (!clerkId) return { status: 'error', message: 'Sign in first.' }

  const db = getDb()
  const user = await findAppUser(db, clerkId)
  if (!user) return { status: 'error', message: 'There is no account to rename yet.' }

  const raw = String(form.get('handle') ?? '')
  const problem = handleProblem(raw)
  if (problem) return { status: 'error', message: problem }

  const next = normaliseHandle(raw)
  if (next.toLowerCase() === user.display_name.toLowerCase()) {
    return { status: 'ok', message: 'That is already your Handle.' }
  }
  if (await handleTaken(db, next)) {
    return { status: 'error', message: 'That Handle is taken or has been retired.' }
  }

  await db.update(appUser).set({ display_name: next }).where(eq(appUser.id, user.id))
  await retireHandle(db, user.display_name)
  revalidatePath('/me/account')
  return { status: 'ok', message: `You are now ${next}. The old Handle is retired for good.` }
}

/**
 * Account deletion, in the order that matters: **our rows first, then Clerk** (§4.7, §6.12).
 *
 * The reversible half commits first, so a failure after step 1 means the user signs in again
 * and gets a fresh account — which is what they asked for. The other way round leaves rows
 * pointing at a Clerk user that no longer exists.
 *
 * What survives, stated on the page as plainly as here: uploaded programmes **stay
 * published**, credited to the Handle; the Handle is retired forever; bookmarks are deleted;
 * upvotes stay counted but stop being linked to anyone. The database does most of it by
 * itself — `bookmark` cascades, `upload_intent` cascades, both vote tables null their voter,
 * and `programme.owner_user_id` becomes null — which is why the only explicit delete here is
 * the one FK that cannot be nulled.
 */
export async function deleteAccount(
  _previous: AccountState,
  form: FormData,
): Promise<AccountState> {
  const clerkId = await clerkUserId()
  if (!clerkId) return { status: 'error', message: 'Sign in first.' }

  const db = getDb()
  const user = await findAppUser(db, clerkId)
  if (!user) return { status: 'error', message: 'There is no account to delete.' }

  const typed = String(form.get('confirm') ?? '').trim()
  if (typed.toLowerCase() !== user.display_name.toLowerCase()) {
    return { status: 'error', message: 'Type your Handle exactly to confirm.' }
  }

  // `uploader_vote.subject_user_id` is the one reference to this row that is neither
  // cascaded nor nullable: a vote *for* a contributor who no longer exists ranks nothing.
  await db.delete(uploaderVote).where(eq(uploaderVote.subject_user_id, user.id))
  await retireHandle(db, user.display_name)
  await db.delete(appUser).where(eq(appUser.id, user.id))

  // Then Clerk, where the Google identity has lived all along. Nothing to erase on our side:
  // no `google_sub`, no `email` — that structural fact is why Clerk was chosen (§4.7).
  const client = await clerkClient()
  await client.users.deleteUser(clerkId)

  redirect('/')
}
