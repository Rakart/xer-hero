import type { Metadata } from 'next'
import { PageShell } from '@/components/site/PageShell'
import { OPERATOR_MAILBOX } from '@/components/site/routes'
import { SectionHeading } from '@/components/site/SectionHeading'
import { ReportForm } from './ReportForm'

/**
 * `/report` — takedown and complaint intake (§7.6). Public, no account: a rights holder
 * finding their programme here will not sign in with Google to complain.
 *
 * **The operator's published mailbox is printed on this page and nowhere else** (§7.19).
 * It is deliberately not a `mailto:` in the footer, because that would publish the
 * address on every page of a public site to every scraper.
 *
 * The page is indexable and self-canonical, and it is listed in the sitemap (§7.16). The
 * shell is static; only the submit is a Server Function.
 */
export const dynamic = 'force-static'

const TITLE = 'Report a problem'
const DESCRIPTION = 'This form is how a problem with something published on this site is reported.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/report' },
  openGraph: { title: TITLE, description: DESCRIPTION },
}

export default function ReportPage() {
  return (
    <PageShell width="prose">
      <div className="prose">
        <h1>{TITLE}</h1>
        <p>
          This form is how a problem with something published on this site is reported. Anyone can
          use it and no account is needed.
        </p>
        <p>
          Use it if a programme was published without the right to publish it, if it carries
          confidential information, if you are named in one, or if something else about it is wrong.{' '}
          <a href="/terms#7-reports-and-removals">The terms</a> set out what happens to a reported
          programme, and{' '}
          <a href="/privacy#6-if-you-are-named-in-a-programme-someone-else-uploaded">
            the privacy policy
          </a>{' '}
          covers being named in someone else&rsquo;s file.
        </p>
        <p>
          What the form does: it writes a record. One person reads those records and decides what to
          do, in their own time, with no service level. There is no automatic reply, and no case
          reference is quoted back to you.
        </p>
        <p>
          What is kept: what you reported, the reason you gave, and the name as it appears if that
          is the subject.{' '}
          <strong>Your contact details are deleted 90 days after the case is closed.</strong> The
          rest of the record is kept as the record of a decision.
        </p>
      </div>

      {/* The form sits outside `.prose`: those rules set a document, and a form's labels,
          hints and errors carry their own rhythm. */}
      <SectionHeading as="h2" id="the-form">
        The report
      </SectionHeading>
      <ReportForm />

      <SectionHeading as="h2" id="by-email">
        By email instead
      </SectionHeading>
      <div className="prose">
        <p>
          The form is the primary channel because it is the record. If you would rather write,{' '}
          <strong>{OPERATOR_MAILBOX}</strong> reaches the operator. Mail arriving there is copied
          into a record by hand before anything is done about it, so the form is the faster of the
          two.
        </p>
        <p>
          This address is printed on this page only. It is not in the footer and it is on no other
          page.
        </p>
      </div>
    </PageShell>
  )
}
