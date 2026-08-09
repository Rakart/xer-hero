import type { Metadata } from 'next'
import { LegalDocument } from '@/components/site/LegalDocument'
import { CURRENT_TERMS_VERSION, LEGAL_TITLES, readLegalDocument } from '@/components/site/legal'
import { firstSentence, parseMarkdown } from '@/components/site/markdown'

/**
 * `/terms` renders the **current** version and is canonical (§7.10). Static at build: it
 * reads neither Postgres nor a blob, so after the build it costs nothing at runtime.
 */
export const dynamic = 'force-static'

const description = firstSentence(parseMarkdown(readLegalDocument('terms', CURRENT_TERMS_VERSION)))

export const metadata: Metadata = {
  title: LEGAL_TITLES.terms,
  description,
  alternates: { canonical: '/terms' },
  // §7.16.5 — the page title and the page's own first sentence. Nothing authored.
  openGraph: { title: LEGAL_TITLES.terms, description },
}

export default function TermsPage() {
  return <LegalDocument kind="terms" version={CURRENT_TERMS_VERSION} />
}
