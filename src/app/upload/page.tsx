import type { Metadata } from 'next'
import { SignInNotice } from '@/components/me/SignInNotice'
import { PageShell } from '@/components/site'
import { UploadFlow } from '@/components/upload/UploadFlow'
import { clerkConfigured } from '@/lib/auth/session'

/**
 * `/upload` — **a new programme, no lineage** (§10.1).
 *
 * The first of the three upload routes, each carrying its context in the path rather than in
 * a query parameter, which keeps them out of the facet query space the crawl surface
 * disallows. All three are inside the `clerkMiddleware` matcher, so a signed-out request —
 * including a crawler's — is redirected exactly as on `/me` and **no `noindex` header is
 * needed here**.
 */

export const dynamic = 'force-dynamic'

const TITLE = 'Upload a programme'

export const metadata: Metadata = { title: TITLE }

export default function UploadPage() {
  return (
    <PageShell
      title={TITLE}
      lede="One file, one screen. The file is read here in your browser before anything is uploaded."
    >
      {clerkConfigured() ? <UploadFlow context={{ intent: 'new' }} /> : <SignInNotice />}
    </PageShell>
  )
}
