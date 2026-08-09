import type { Metadata } from 'next'
import { PageShell } from '@/components/site/PageShell'

/**
 * The 404. It carries no robots meta: the status code is the instruction, and a `noindex`
 * on a page that already answers 404 is a second instrument saying the same thing —
 * §7.16.3's rule is that the two are never doubled up.
 *
 * A programme with no published revision 404s **to everyone, including its owner** (§6.1),
 * so this page must not hint that something exists behind a sign-in. It says what happened
 * and offers the shelf.
 */
export const metadata: Metadata = {
  title: 'Not found',
}

export default function NotFound() {
  return (
    <PageShell width="prose">
      <div className="prose">
        <h1>Not found</h1>
        <p>
          There is nothing at this address. A programme that has been withdrawn or removed keeps its
          page, so this is not that — the address is either mistyped or was never one.
        </p>
        <p>
          <a href="/">Browse the shelf</a> · <a href="/about">About this site</a> ·{' '}
          <a href="/report">Report a problem</a>
        </p>
      </div>
    </PageShell>
  )
}
