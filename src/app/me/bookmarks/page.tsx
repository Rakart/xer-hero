import type { Metadata } from 'next'
import { MeTabs } from '@/components/me/MeTabs'
import styles from '@/components/me/me.module.css'
import { SignInNotice } from '@/components/me/SignInNotice'
import { ShelfGrid } from '@/components/shelf'
import { PageShell } from '@/components/site'
import { findAppUser } from '@/lib/auth/app-user'
import { clerkConfigured, clerkUserId } from '@/lib/auth/session'
import { SHELF_PAGE_SIZE } from '@/lib/contracts/domain'
import { getDb } from '@/lib/db/client'
import { listBookmarkedProgrammes } from '@/lib/db/queries'

/**
 * `/me/bookmarks` — **save for later, private throughout** (§6.9, §6.12).
 *
 * No count, no public rendering, no board input, nothing to farm. It keeps a row rather than
 * `/me`'s index line because this genuinely is a comparison surface: it is a list of other
 * people's work, assembled to be read against itself.
 *
 * No facets, search or sort: conjunctive counts earn their place because a sparse catalogue
 * dead-ends, and **a list you assembled yourself has no dead ends**.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Saved programmes' }

export default async function BookmarksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? '1', 10) || 1)

  if (!clerkConfigured()) return <Shell>{<SignInNotice />}</Shell>
  const clerkId = await clerkUserId()
  if (!clerkId) return <Shell>{<SignInNotice />}</Shell>

  const db = getDb()
  const user = await findAppUser(db, clerkId)
  if (!user) return <Shell>{<Empty />}</Shell>

  // Shelf rows, not a reduced line (§6.12): this is a list of other people's work assembled
  // to be read against itself, which is exactly what the twelve slots are for.
  const rows = await listBookmarkedProgrammes(db, user.id, page)

  if (rows.length === 0) return <Shell>{<Empty />}</Shell>
  const total = rows[0]?.total_count ?? rows.length

  return (
    <Shell>
      <ShelfGrid rows={rows} />
      {page > 1 || total > page * SHELF_PAGE_SIZE ? (
        <div className={styles.pager}>
          {page > 1 ? (
            <a href={page === 2 ? '/me/bookmarks' : `/me/bookmarks?page=${page - 1}`}>← Newer</a>
          ) : null}
          {total > page * SHELF_PAGE_SIZE ? (
            <a href={`/me/bookmarks?page=${page + 1}`}>Older →</a>
          ) : null}
        </div>
      ) : null}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageShell title="Saved">
      <MeTabs current="bookmarks" />
      {children}
    </PageShell>
  )
}

function Empty() {
  return (
    <div className={styles.empty}>
      <p>Nothing saved yet. The bookmark control on any programme saves it here.</p>
      <a className={styles.emptyAction} href="/">
        Browse the shelf →
      </a>
    </div>
  )
}
