import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  buildProgrammeView,
  buildTombstoneView,
  derivedVersionOf,
  loadDerived,
  loadProgrammeRow,
  OG_DEFAULTS,
  ogStrings,
  ProgrammeDocument,
  programmeHead,
  Tombstone,
} from '@/components/programme'
import { SITE_NAME } from '@/components/site'
import { sectorLabel } from '@/lib/contracts/domain'

/**
 * `/p/{slug}` — the programme at `current_revision_id` (§6.7).
 *
 * **ISR at one hour, and the TTL is load-bearing rather than a tuning choice.** If this page
 * were cached long, tombstoning the row would not take it down: a crawler and a visitor
 * would both keep getting the pre-tombstone render, with every number and the download
 * button on it. One hour is the same clock `original.xer.gz` runs on, and it replaces a
 * fifth takedown step — there is no CDN in front of the site to purge.
 *
 * **Nothing here reads the session.** `auth()` structurally cannot work on this route: the
 * `clerkMiddleware` matcher covers `/me`, `/ops`, `/api` and `/__clerk` and nothing else, so
 * this render is byte-identical for every viewer and emits no `Set-Cookie` — which is the
 * precondition for it being cached at all.
 */
export const revalidate = 3600

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const row = await loadProgrammeRow(slug)
  if (!row) return { title: SITE_NAME }

  const tombstoned = row.status === 'tombstoned' || row.revision?.status === 'tombstoned'
  const head = programmeHead(slug, tombstoned)

  // A tombstone emits the site defaults and nothing else. The title stays visible *on the
  // page* — a URL somebody already holds — but an unfurl is the same title travelling
  // outward into a channel nobody asked (§7.16.5).
  if (tombstoned || !row.revision) {
    return {
      title: { absolute: OG_DEFAULTS.title },
      description: OG_DEFAULTS.description,
      // `absolute` on both, because Next resolves `openGraph.title` through the root
      // layout's `%s — xer-hero` template and the default must not gain a second suffix.
      openGraph: {
        title: { absolute: OG_DEFAULTS.title },
        description: OG_DEFAULTS.description,
      },
      robots: { index: false, follow: true },
      alternates: { canonical: head.canonicalPath },
    }
  }

  // Every OG value is a fixed template over Postgres columns and never over `derived.json`,
  // precisely so it still renders for a programme whose blobs do not exist.
  const og = ogStrings({
    title: row.title,
    activityCount: row.revision.activity_count,
    sectorLabel: sectorLabel(row.sector),
    p6Version: row.revision.p6_version,
    pctComplete: row.revision.pct_complete,
    handle: row.revision.uploader_display_name,
  })

  // `og.title` is the bare title in both slots: the root layout's `%s — xer-hero` template
  // is applied to `openGraph.title` as well as to the head title, which is exactly the
  // `{title} — xer-hero` §7.16.5 asks for.
  return {
    title: og.title,
    description: og.description,
    openGraph: { title: og.title, description: og.description },
    alternates: { canonical: head.canonicalPath },
  }
}

export default async function ProgrammePage({ params }: Params) {
  const { slug } = await params
  const row = await loadProgrammeRow(slug)
  if (!row) notFound()

  // `/p/{slug}` follows `current_revision_id`, which is repointed past a tombstone — so a
  // tombstoned current revision means the whole Programme went, and the page renders the
  // withdrawal copy at its own URL, forever.
  if (row.status === 'tombstoned' || row.revision?.status === 'tombstoned') {
    return <Tombstone view={await buildTombstoneView(row, row.revision ?? null)} />
  }

  // No published revision: the pointer is null while ingest runs, and an inner join drops
  // nulls everywhere else for the same reason. The owner-visible `pending` and `failed`
  // states live on the account surface (§6.12), which is the only surface that can read a
  // session; this public route has no way to tell an owner from anyone else and 404s.
  if (row.revision?.status !== 'published') notFound()

  const revision = row.revision
  const derived = await loadDerived(row.id, revision.id, derivedVersionOf(revision))
  if (!derived) {
    throw new Error(
      `derived.json is missing for ${slug} r${revision.rev_no}; the revision is published but its blob is not there`,
    )
  }

  const view = await buildProgrammeView({ row, revision, isCurrent: true }, derived)
  return <ProgrammeDocument view={view} />
}
