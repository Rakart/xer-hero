import type { Metadata } from 'next'
import { AccountForms } from '@/components/me/AccountForms'
import { MeTabs } from '@/components/me/MeTabs'
import styles from '@/components/me/me.module.css'
import { SignInNotice } from '@/components/me/SignInNotice'
import { PageShell } from '@/components/site'
import { findAppUser } from '@/lib/auth/app-user'
import { clerkConfigured, clerkUserId } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'

/**
 * `/me/account` — Handle, rename, sign out, delete account (§6.12).
 *
 * Nothing here shows an email address, a name or an avatar, because **no Google identity is
 * in our schema**: `app_user` holds `clerk_user_id`, the Handle and `created_at`. That is
 * what turns the erasure position from a routine we must write correctly into a structural
 * fact (§4.7).
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Account' }

export default async function AccountPage() {
  if (!clerkConfigured()) return <Shell>{<SignInNotice />}</Shell>
  const clerkId = await clerkUserId()
  if (!clerkId) return <Shell>{<SignInNotice />}</Shell>

  // Reads create nothing, so an account that has never written has no Handle to show yet —
  // it is minted by the first vote, bookmark or presign (§6.12).
  const user = await findAppUser(getDb(), clerkId)
  if (!user) {
    return (
      <Shell>
        <div className={styles.empty}>
          <p>
            You have no Handle yet. One is generated the first time you upload, upvote or save
            something, and you confirm it on your first upload.
          </p>
          <a className={styles.emptyAction} href="/upload">
            Upload a programme →
          </a>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <AccountForms handle={user.display_name} />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageShell title="Account">
      <MeTabs current="account" />
      {children}
    </PageShell>
  )
}
