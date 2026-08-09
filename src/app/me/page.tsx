import { desc, eq, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Metadata } from 'next'
import { MeTabs } from '@/components/me/MeTabs'
import styles from '@/components/me/me.module.css'
import { ProgrammeLine } from '@/components/me/ProgrammeLine'
import { SignInNotice } from '@/components/me/SignInNotice'
import { PageShell } from '@/components/site'
import { findAppUser } from '@/lib/auth/app-user'
import { clerkConfigured, clerkUserId } from '@/lib/auth/session'
import { SHELF_PAGE_SIZE } from '@/lib/contracts/domain'
import { getDb } from '@/lib/db/client'
import { programme, revision } from '@/lib/db/schema'

/**
 * `/me` — **every Programme you own, one line each, published and not** (§6.12).
 *
 * Signed-out requests never reach here: `/me/:path*` is inside the `clerkMiddleware` matcher,
 * so Clerk redirects them and **no crawler ever sees a private list**, which is why there is
 * no `noindex` header on any of these four pages.
 *
 * It is also the **only owner-visible surface for an unpublished upload**, because a cached
 * route cannot serve a 404 to one viewer and a page to another — so `/p/{slug}` 404s to
 * everyone until publish, owner included.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Your uploads' }

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? '1', 10) || 1)

  if (!clerkConfigured()) return <Shell>{<SignInNotice />}</Shell>
  const clerkId = await clerkUserId()
  if (!clerkId) return <Shell>{<SignInNotice />}</Shell>

  const db = getDb()
  // **Reads create nothing.** A signed-in user who has never written has no `app_user` row
  // and gets the empty state rather than a row conjured by looking (§6.12).
  const user = await findAppUser(db, clerkId)
  if (!user) return <Shell>{<Empty />}</Shell>

  const parent = alias(programme, 'parent_programme')
  const rows = await db
    .select({
      id: programme.id,
      slug: programme.slug,
      title: programme.title,
      sector: programme.sector,
      status: programme.status,
      created_at: programme.created_at,
      parent_status: parent.status,
    })
    .from(programme)
    .leftJoin(parent, eq(parent.id, programme.parent_programme_id))
    .where(eq(programme.owner_user_id, user.id))
    // The same frozen order as the shelf, and total because `(created_at, id)` is unique.
    .orderBy(desc(programme.created_at), desc(programme.id))
    .limit(SHELF_PAGE_SIZE + 1)
    .offset((page - 1) * SHELF_PAGE_SIZE)

  const visible = rows.slice(0, SHELF_PAGE_SIZE)
  if (visible.length === 0) return <Shell>{page === 1 ? <Empty /> : <PastTheEnd />}</Shell>

  // The newest revision decides the chip. One extra statement rather than a lateral join:
  // `neon-http` sends each of these as its own request and a 25-row `in` list is one index
  // scan either way.
  const revisions = await db
    .select({
      programme_id: revision.programme_id,
      rev_no: revision.rev_no,
      status: revision.status,
      removal_class: revision.removal_class,
      failure_reason: revision.failure_reason,
    })
    .from(revision)
    .where(
      inArray(
        revision.programme_id,
        visible.map((row) => row.id),
      ),
    )
    .orderBy(desc(revision.rev_no))

  const newest = new Map<string, (typeof revisions)[number]>()
  for (const row of revisions) if (!newest.has(row.programme_id)) newest.set(row.programme_id, row)

  return (
    <Shell>
      <div className={styles.lines}>
        {visible.map((row) => {
          const rev = newest.get(row.id)
          return (
            <ProgrammeLine
              key={row.id}
              slug={row.slug}
              title={row.title}
              sector={row.sector}
              createdAt={row.created_at}
              revNo={rev?.rev_no ?? null}
              failureReason={rev?.failure_reason ?? null}
              programmeStatus={row.status}
              revisionStatus={rev?.status ?? null}
              removalClass={rev?.removal_class ?? null}
              parentTombstoned={row.parent_status === 'tombstoned'}
            />
          )
        })}
      </div>
      <Pager page={page} hasNext={rows.length > SHELF_PAGE_SIZE} />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageShell title="Your uploads">
      <MeTabs current="index" />
      {children}
    </PageShell>
  )
}

function Empty() {
  return (
    <div className={styles.empty}>
      <p>You haven&rsquo;t uploaded a programme yet.</p>
      <a className={styles.emptyAction} href="/upload">
        Upload a programme →
      </a>
    </div>
  )
}

function PastTheEnd() {
  return (
    <div className={styles.empty}>
      <p>Nothing on this page.</p>
      <a className={styles.emptyAction} href="/me">
        Back to the first page →
      </a>
    </div>
  )
}

function Pager({ page, hasNext }: { page: number; hasNext: boolean }) {
  if (page === 1 && !hasNext) return null
  return (
    <div className={styles.pager}>
      {page > 1 ? <a href={page === 2 ? '/me' : `/me?page=${page - 1}`}>← Newer</a> : null}
      {hasNext ? <a href={`/me?page=${page + 1}`}>Older →</a> : null}
    </div>
  )
}
