import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LegalDocument } from '@/components/site/LegalDocument'
import { legalVersionMetadata, shippedVersions, versionNumber } from '@/components/site/legal'

/**
 * `/privacy/v{n}` — same rule as `/terms/v{n}` (§7.10). One version number names both
 * documents, so this route and its terms twin always resolve for the same `n`.
 */
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return shippedVersions().map((version) => ({ version }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ version: string }>
}): Promise<Metadata> {
  const { version } = await params
  return legalVersionMetadata('privacy', version)
}

export default async function PrivacyVersionPage({
  params,
}: {
  params: Promise<{ version: string }>
}) {
  const { version } = await params
  if (versionNumber(version) === null || !shippedVersions().includes(version)) notFound()
  return <LegalDocument kind="privacy" version={version} />
}
