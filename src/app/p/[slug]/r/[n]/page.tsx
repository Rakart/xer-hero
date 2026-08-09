import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  buildProgrammeView,
  buildTombstoneView,
  derivedVersionOf,
  loadDerived,
  loadProgrammeRow,
  loadRevisionRow,
  OG_DEFAULTS,
  ogStrings,
  ProgrammeDocument,
  revisionHead,
  Tombstone,
} from '@/components/programme'
import { SITE_NAME } from '@/components/site'
import { sectorLabel } from '@/lib/contracts/domain'

/**
 * `/p/{slug}/r/{n}` — one revision at its own permanent URL (§2.11, §6.7, §7.16.3).
 *
 * A planner says "rev 12", not a uuid, which is why the segment is `rev_no` and why this
 * URL is the one a citation points at.
 *
 * The head rules are the whole reason this is a separate route rather than a query
 * parameter:
 *
 * - `n` **current** → canonical `/p/{slug}`. This is the estate's only true duplicate pair:
 *   byte-identical HTML at two URLs.
 * - `n` **superseded** → **self-canonical plus `noindex, follow`**. A superseded revision is
 *   not a duplicate — rev 7 of a two-year monthly series is a different programme's worth of
 *   dates, floats and DCMA marks — so claiming it is would be false.
 * - `n` **tombstoned** → the tombstone renders here, at its own URL.
 *
 * A canonical pointing elsewhere and a `noindex` are never emitted together: that pair says
 * "this page is the same as that one" and "remove this page" about one cluster.
 */
export const revalidate = 3600

type Params = { params: Promise<{ slug: string; n: string }> }

function parseRevNo(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null
  const value = Number(raw)
  return value >= 1 ? value : null
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, n } = await params
  const revNo = parseRevNo(n)
  if (revNo === null) return { title: SITE_NAME }

  const [row, revision] = await Promise.all([loadProgrammeRow(slug), loadRevisionRow(slug, revNo)])
  if (!row || !revision) return { title: SITE_NAME }

  const isCurrent = row.revision?.id === revision.id
  const tombstoned = row.status === 'tombstoned' || revision.status === 'tombstoned'
  const head = revisionHead(slug, revNo, { isCurrent, tombstoned })

  if (tombstoned || revision.status !== 'published') {
    return {
      title: { absolute: OG_DEFAULTS.title },
      description: OG_DEFAULTS.description,
      // `absolute` on both: Next resolves `openGraph.title` through the root layout's
      // `%s — xer-hero` template, and the default must not gain a second suffix.
      openGraph: {
        title: { absolute: OG_DEFAULTS.title },
        description: OG_DEFAULTS.description,
      },
      robots: { index: false, follow: true },
      alternates: { canonical: head.canonicalPath },
    }
  }

  const og = ogStrings({
    title: row.title,
    activityCount: revision.activity_count,
    sectorLabel: sectorLabel(row.sector),
    p6Version: revision.p6_version,
    pctComplete: revision.pct_complete,
    handle: revision.uploader_display_name,
    revNo,
  })

  // `{title} — rev {n}` in both slots; the root layout's template adds the ` — xer-hero`
  // suffix to the head title and to `og:title` alike (§7.16.5).
  return {
    title: og.title,
    description: og.description,
    openGraph: { title: og.title, description: og.description },
    alternates: { canonical: head.canonicalPath },
    ...(head.noindex ? { robots: { index: false, follow: true } } : {}),
  }
}

export default async function RevisionPage({ params }: Params) {
  const { slug, n } = await params
  const revNo = parseRevNo(n)
  if (revNo === null) notFound()

  const [row, revision] = await Promise.all([loadProgrammeRow(slug), loadRevisionRow(slug, revNo)])
  if (!row || !revision) notFound()

  if (row.status === 'tombstoned' || revision.status === 'tombstoned') {
    return <Tombstone view={await buildTombstoneView(row, revision)} />
  }

  // `pending` and `failed` are owner-visible states and this route cannot read a session,
  // so it takes the public path. The owner's view of an in-flight or failed revision lives
  // on the account surface (§6.12), which is inside the middleware matcher.
  if (revision.status !== 'published') notFound()

  const derived = await loadDerived(row.id, revision.id, derivedVersionOf(revision))
  if (!derived) {
    throw new Error(
      `derived.json is missing for ${slug} r${revNo}; the revision is published but its blob is not there`,
    )
  }

  const view = await buildProgrammeView(
    { row, revision, isCurrent: row.revision?.id === revision.id },
    derived,
  )
  return <ProgrammeDocument view={view} />
}
