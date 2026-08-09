import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LegalDocument } from '@/components/site/LegalDocument'
import { legalVersionMetadata, shippedVersions, versionNumber } from '@/components/site/legal'

/**
 * `/terms/v{n}` — every version, current and superseded, permanently addressable (§7.10).
 * One path segment, because `revision.terms_version` stores the string `'v{n}'` and the
 * URL is that value concatenated onto the route: `https://xerhero.com/terms/v3`.
 *
 * Static at build, one path per file present. `dynamicParams = false` so a version that
 * has never shipped 404s rather than rendering.
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
  return legalVersionMetadata('terms', version)
}

export default async function TermsVersionPage({
  params,
}: {
  params: Promise<{ version: string }>
}) {
  const { version } = await params
  if (versionNumber(version) === null || !shippedVersions().includes(version)) notFound()
  return <LegalDocument kind="terms" version={version} />
}
