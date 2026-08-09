import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SignInNotice } from '@/components/me/SignInNotice'
import { PageShell } from '@/components/site'
import { UploadFlow } from '@/components/upload/UploadFlow'
import { findAppUser } from '@/lib/auth/app-user'
import { clerkConfigured, clerkUserId } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { getProgrammeBySlug, listRevisions } from '@/lib/db/queries'

/**
 * `/p/{slug}/upload` — **a new revision of a programme you own** (§10.1, §5.1).
 *
 * Owner-only, and **the parent comes from the URL**. Whether an upload is a new Programme, a
 * new Revision or a Fork is declared by route and never detected: no property of a file
 * distinguishes a fork from a revision, only the uploader's intent does, and the four Fixture
 * B tender variants are fork *siblings* that any detector keyed on the P6 project id would
 * collapse into one revision series.
 *
 * A non-owner gets `notFound()` rather than a redirect to the fork route — the fork offer
 * belongs on the programme page, where the person already is.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Add a revision' }

export default async function NewRevisionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  if (!clerkConfigured()) {
    return (
      <PageShell title="Add a revision">
        <SignInNotice />
      </PageShell>
    )
  }

  const db = getDb()
  const [programme] = await getProgrammeBySlug(db, slug)
  if (!programme) notFound()

  const clerkId = await clerkUserId()
  const viewer = clerkId ? await findAppUser(db, clerkId) : undefined
  if (!viewer || programme.owner_user_id !== viewer.id) notFound()

  const revisions = await listRevisions(db, programme.id)
  const nextRevNo = (revisions[0]?.rev_no ?? 0) + 1

  return (
    <PageShell
      title={`Add revision ${nextRevNo}`}
      lede={
        <>
          A new revision of <a href={`/p/${programme.slug}`}>{programme.title}</a>. The title,
          description and sector stay on the programme; this adds a file and a note.
        </>
      }
    >
      <UploadFlow
        context={{
          intent: 'revision',
          slug: programme.slug,
          parentTitle: programme.title,
          nextRevNo,
          prefill: {
            title: programme.title,
            description: programme.description ?? '',
            sector: programme.sector ?? '',
          },
        }}
      />
    </PageShell>
  )
}
