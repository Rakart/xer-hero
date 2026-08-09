import type { Metadata } from 'next'
import { LegalDocument } from '@/components/site/LegalDocument'
import { CURRENT_TERMS_VERSION, LEGAL_TITLES, readLegalDocument } from '@/components/site/legal'
import { firstSentence, parseMarkdown } from '@/components/site/markdown'

/**
 * `/privacy` renders the **current** version and is canonical (§7.10). It is required on
 * every page's footer precisely so it is reachable without login from any entry point —
 * and Google's brand verification fetches it on the verified domain (§7.11 §2).
 */
export const dynamic = 'force-static'

const description = firstSentence(
  parseMarkdown(readLegalDocument('privacy', CURRENT_TERMS_VERSION)),
)

export const metadata: Metadata = {
  title: LEGAL_TITLES.privacy,
  description,
  alternates: { canonical: '/privacy' },
  openGraph: { title: LEGAL_TITLES.privacy, description },
}

export default function PrivacyPage() {
  return <LegalDocument kind="privacy" version={CURRENT_TERMS_VERSION} />
}
