'use client'

import { SignOutButton } from '@clerk/nextjs'
import { useActionState } from 'react'
import {
  ACCOUNT_INITIAL_STATE,
  type AccountState,
  deleteAccount,
  renameHandle,
} from '@/app/me/actions'
import styles from './me.module.css'

/**
 * The three controls on `/me/account` (§6.12): rename, sign out, delete.
 *
 * **Sign-out lives here rather than behind a popover**, which costs one extra click on a
 * two-item menu that would otherwise need focus management and a client component of its own.
 * Clerk's `<UserButton>` is refused throughout — it renders the Google profile image, and
 * **the only thing standing between a Google profile image and a page on this site is the
 * rule that nothing renders `user.imageUrl`** (§4.7).
 */
export function AccountForms({ handle }: { handle: string }) {
  const [renamed, rename] = useActionState<AccountState, FormData>(
    renameHandle,
    ACCOUNT_INITIAL_STATE,
  )
  const [deleted, remove] = useActionState<AccountState, FormData>(
    deleteAccount,
    ACCOUNT_INITIAL_STATE,
  )

  return (
    <div className={styles.account}>
      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Your Handle</h2>
        <p className={styles.blockBody}>
          Changing your Handle retires the old one permanently. Nobody can claim it afterwards,
          including you. Programmes you have already published keep the Handle they were uploaded
          under.
        </p>
        <form action={rename} className={styles.formRow}>
          <input
            className={styles.input}
            name="handle"
            defaultValue={handle}
            maxLength={32}
            aria-label="Handle"
          />
          <button className={styles.button} type="submit">
            Change it
          </button>
        </form>
        <Message state={renamed} />
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Sign out</h2>
        <p className={styles.blockBody}>Sessions last seven days. Signing out ends this one.</p>
        <SignOutButton redirectUrl="/">
          <button className={styles.button} type="button">
            Sign out
          </button>
        </SignOutButton>
      </section>

      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Delete your account</h2>
        <p className={styles.blockBody}>
          Programmes you uploaded <strong>stay published</strong>, credited to{' '}
          <strong>{handle}</strong>. The Handle is retired forever and nobody can claim it again.
          Your bookmarks are deleted. Your upvotes stay counted but stop being linked to you. This
          cannot be undone.
        </p>
        <p className={styles.blockBody}>
          To remove your programmes as well, <strong>withdraw them first</strong> — on each
          programme&rsquo;s own page — then delete your account.
        </p>
        <form action={remove} className={styles.formRow}>
          <input
            className={styles.input}
            name="confirm"
            placeholder={handle}
            aria-label={`Type ${handle} to confirm`}
            autoComplete="off"
          />
          <button className={`${styles.button} ${styles.danger}`} type="submit">
            Delete my account
          </button>
        </form>
        <Message state={deleted} />
      </section>
    </div>
  )
}

function Message({ state }: { state: AccountState }) {
  if (state.status === 'idle' || !state.message) return null
  return (
    <p className={state.status === 'error' ? styles.error : styles.ok} role="status">
      {state.message}
    </p>
  )
}
