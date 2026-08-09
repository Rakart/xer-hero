import { desc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Metadata } from 'next'
import { MeTabs } from '@/components/me/MeTabs'
import styles from '@/components/me/me.module.css'
import { SignInNotice } from '@/components/me/SignInNotice'
import { ShelfGrid } from '@/components/shelf'
import { Chip, PageShell, SectionHeading } from '@/components/site'
import { findAppUser } from '@/lib/auth/app-user'
import { clerkConfigured, clerkUserId } from '@/lib/auth/session'
import { SHELF_PAGE_SIZE } from '@/lib/contracts/domain'
import { getDb } from '@/lib/db/client'
import { listVotedProgrammes } from '@/lib/db/queries'
import { appUser, uploaderVote } from '@/lib/db/schema'

/**
 * `/me/votes` — shelf rows for Programmes you upvoted, then **a short flat list of Handles**
 * from `uploader_vote` (§6.12).
 *
 * Two lists because there are two votable objects with two counters and two boards, and
 * therefore no standing formula: a Programme is voted from a row or its page, an uploader
 * only from `/u/{handle}` (§1.7). The Revision is not votable at all.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Upvoted' }

export default async function VotesPage({
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

  const subject = alias(appUser, 'subject')
  const [programmes, handles] = await db.batch([
    // Shelf rows, not a reduced line (§6.12), through the same twelve-slot projection the
    // grid uses — a programme you upvoted is worth comparing against the others you did.
    // Still inside the batch, so both lists cost one HTTP round trip on the `neon-http` wire.
    listVotedProgrammes(db, user.id, page),
    db
      .select({ handle: subject.display_name })
      .from(uploaderVote)
      .innerJoin(subject, eq(subject.id, uploaderVote.subject_user_id))
      .where(eq(uploaderVote.voter_user_id, user.id))
      .orderBy(desc(uploaderVote.created_at))
      .limit(100),
  ])

  if (programmes.length === 0 && handles.length === 0) return <Shell>{<Empty />}</Shell>
  const total = programmes[0]?.total_count ?? programmes.length

  return (
    <Shell>
      {programmes.length > 0 ? <ShelfGrid rows={programmes} /> : null}

      {page > 1 || total > page * SHELF_PAGE_SIZE ? (
        <div className={styles.pager}>
          {page > 1 ? (
            <a href={page === 2 ? '/me/votes' : `/me/votes?page=${page - 1}`}>← Newer</a>
          ) : null}
          {total > page * SHELF_PAGE_SIZE ? (
            <a href={`/me/votes?page=${page + 1}`}>Older →</a>
          ) : null}
        </div>
      ) : null}

      {handles.length > 0 ? (
        <>
          <SectionHeading as="h2" id="contributors">
            Contributors you upvoted
          </SectionHeading>
          <ul className={styles.handles}>
            {handles.map((row) => (
              <li key={row.handle}>
                <Chip href={`/u/${row.handle}`}>{row.handle}</Chip>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageShell title="Upvoted">
      <MeTabs current="votes" />
      {children}
    </PageShell>
  )
}

function Empty() {
  return (
    <div className={styles.empty}>
      <p>You haven&rsquo;t upvoted anything yet.</p>
      <a className={styles.emptyAction} href="/">
        Browse the shelf →
      </a>
    </div>
  )
}
