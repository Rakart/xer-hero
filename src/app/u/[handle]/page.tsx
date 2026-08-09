import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { OwnerLink, UploaderVote } from '@/components/shelf/ContributorControls'
import { Pager } from '@/components/shelf/Pager'
import controls from '@/components/shelf/ShelfControls.module.css'
import { ShelfGrid } from '@/components/shelf/ShelfGrid'
import { loadContributor, loadContributorRank, loadShelfRows } from '@/components/shelf/shelf-data'
import { formatCount, formatJoined } from '@/components/shelf/shelf-format'
import {
  EMPTY_SHELF_PARAMS,
  parseShelfParams,
  type ShelfParams,
  shelfHref,
} from '@/components/shelf/shelf-url'
import { PageShell, SITE_NAME, Stat, StatGrid } from '@/components/site'

/**
 * `/u/{handle}` — the public contributor page (§6.10).
 *
 * Public, identical for every viewer, and it carries exactly: the Handle; an uploader
 * upvote pill and count, which is the **only** place an uploader vote can be cast; a
 * leaderboard rank line; the contributor's published Programmes as shelf rows, in the
 * shelf's order, paginated at 25; a programme count and a joined date; a live fork-count
 * fact; **no badges of any kind**; and exactly one owner-conditional element — a link to
 * `/me` carrying no data, mounted client-side from the viewer response.
 *
 * The page has **no owner-only tabs**. Bookmarks and the voting record were originally put
 * here and moved to `/me`, because the Handle exists only from first upload — so the
 * download-only planner, who is the modal signed-in user, has no contributor page at all
 * and would have been unreachable. Branching a public render on viewer identity is also the
 * shape of bug that leaks private data into a shared path.
 *
 * The fork count is a live `count(*)`, **never denormalised and never ranked on**: the grid
 * refused a fork counter because it needs every number denormalised for its one-query rule,
 * and a single-contributor page does not pay that cost.
 */
export const dynamic = 'force-dynamic'

type RawSearchParams = Record<string, string | string[] | undefined>
type PageProps = {
  params: Promise<{ handle: string }>
  searchParams: Promise<RawSearchParams>
}

/**
 * Indexable exactly when the eligibility gate says the contributor is listable — zero
 * published non-tombstoned Programmes drops you from the sitemap and adds `noindex,
 * follow` (§6.10). One gate, two consumers, covering the cascaded-tombstone and
 * account-deletion cases without either being reasoned about separately.
 *
 * The canonical is **self** in both states, including `?page=N`: a `noindex` and a canonical
 * pointing elsewhere are never emitted together, and page 2 of a contributor's rows is not a
 * duplicate of page 1.
 */
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { handle } = await params
  const contributor = await loadContributor(handle)
  if (!contributor) return {}

  const shelf = contributorShelfParams(await searchParams)
  const canonical = shelfHref(shelf, `/u/${contributor.display_name}`)
  const count = contributor.published_programme_count
  const description = `${count} published programme${count === 1 ? '' : 's'} on ${SITE_NAME}.`

  return {
    title: contributor.display_name,
    description,
    alternates: { canonical },
    robots: count === 0 ? { index: false, follow: true } : undefined,
    // §7.16.5 — a fixed template over columns the shelf row already renders, never authored
    // prose and never the uploader's own free text.
    openGraph: { title: `${contributor.display_name} — ${SITE_NAME}`, description },
  }
}

/**
 * `?page=N` and nothing else (§6.10). The facets belong to the shelf; a contributor page
 * that quietly honoured `?sector=rail` would be a second, undocumented filter surface with
 * no controls on it and no counts behind it.
 */
function contributorShelfParams(raw: RawSearchParams): ShelfParams {
  return { ...EMPTY_SHELF_PARAMS, page: parseShelfParams({ page: raw.page }).page }
}

export default async function ContributorPage({ params, searchParams }: PageProps) {
  const { handle } = await params
  const raw = await searchParams
  const shelf = contributorShelfParams(raw)

  const contributor = await loadContributor(handle)
  if (!contributor) notFound()

  // `?page=1` omits at its default here for the same reason it does on the shelf.
  if (raw.page !== undefined && shelf.page === 1) {
    permanentRedirect(`/u/${contributor.display_name}`)
  }

  const [{ rows, total }, rank] = await Promise.all([
    loadShelfRows(shelf, contributor.id),
    loadContributorRank(contributor.id),
  ])
  if (shelf.page > 1 && rows.length === 0) notFound()

  return (
    <PageShell width="wide">
      <div className={controls.contributorHead}>
        <h1 className={controls.handleName}>{contributor.display_name}</h1>
        <UploaderVote handle={contributor.display_name} count={contributor.uploader_vote_count} />
        <OwnerLink handle={contributor.display_name} />
      </div>

      <p className={controls.rankLine}>
        {rank === null ? (
          <>
            Not ranked on <a href="/contributors">the contributor board</a>, which lists
            contributors with at least one published programme.
          </>
        ) : (
          <>
            Ranked #{formatCount(rank)} on <a href="/contributors">the contributor board</a>, by
            upvotes on the Handle.
          </>
        )}
      </p>

      <StatGrid columns={4}>
        <Stat label="Programmes" value={formatCount(contributor.published_programme_count)} />
        <Stat
          label="Forks of them"
          value={formatCount(contributor.fork_count)}
          sub="by anyone, at any revision"
        />
        <Stat label="Upvotes" value={formatCount(contributor.uploader_vote_count)} />
        <Stat label="Joined" value={formatJoined(contributor.created_at)} />
      </StatGrid>

      <div className={controls.sectionRule}>
        {rows.length === 0 ? (
          <p className={controls.rankLine}>
            Nothing published here. Programmes that have been withdrawn keep their page, and are not
            listed.
          </p>
        ) : (
          <>
            <p className={controls.count}>
              {formatCount(total)} published programme{total === 1 ? '' : 's'}
            </p>
            <ShelfGrid rows={rows} />
            <Pager params={shelf} total={total} basePath={`/u/${contributor.display_name}`} />
          </>
        )}
      </div>
    </PageShell>
  )
}
