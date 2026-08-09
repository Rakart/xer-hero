import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SignInNotice } from '@/components/me/SignInNotice'
import { PageShell } from '@/components/site'
import { UploadFlow } from '@/components/upload/UploadFlow'
import { clerkConfigured } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { getProgrammeBySlug } from '@/lib/db/queries'

/**
 * `/p/{slug}/fork` — **a fork of any published programme** (§10.1, §5.1).
 *
 * Signed in, and that is the whole gate: a fork is how everyone who is not the uploader
 * publishes a changed version. `change_note` is **required on a fork's rev 1** (§5.4), which
 * the flow enforces from the intent it was handed, and the description and sector prefill
 * from the parent (§5.4's table) while the title still comes from the file's own root WBS
 * name.
 *
 * Votes reset on fork, because a fork is a new Programme (§6.9).
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Fork a programme' }

export default async function ForkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  if (!clerkConfigured()) {
    return (
      <PageShell title="Fork a programme">
        <SignInNotice />
      </PageShell>
    )
  }

  const [programme] = await getProgrammeBySlug(getDb(), slug)
  // A programme with nothing published has nothing to fork, and its page 404s to everyone
  // anyway — owner included — so this route says the same thing (§4.6.4).
  if (!programme?.revision || programme.status !== 'published') notFound()

  return (
    <PageShell
      title={`Fork ${programme.title}`}
      lede={
        <>
          A fork is a new programme that credits{' '}
          <a href={`/p/${programme.slug}`}>{programme.title}</a> as its parent. The lineage is
          rendered from the fork edge; the file itself is never modified.
        </>
      }
    >
      <UploadFlow
        context={{
          intent: 'fork',
          slug: programme.slug,
          parentTitle: programme.title,
          prefill: {
            description: programme.description ?? '',
            sector: programme.sector ?? '',
          },
        }}
      />
    </PageShell>
  )
}
