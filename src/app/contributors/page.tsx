import type { Metadata } from 'next'
import { loadLeaderboard } from '@/components/shelf/shelf-data'
import { formatCount } from '@/components/shelf/shelf-format'
import { PageShell } from '@/components/site'
import { LEADERBOARD_LIMIT } from '@/lib/contracts/domain'

/**
 * `/contributors` — the leaderboard (§6.11).
 *
 * **Its own page, linked only from the footer**, with a rank line on each contributor page.
 * Never a rail on the shelf — the left rail was rejected there and the same reasoning
 * applies here — and never in the main nav, which would invert what the site is and start
 * routing upload decisions through *does this help my rank*.
 *
 * Footer placement is itself the anti-gaming answer: farming 20 accounts to top a
 * footer-linked page is a bad trade. The cost — that the board motivates less because most
 * visitors never see it — is the intent. Someone with 20 Gmail accounts can top this board
 * on day one, and the answer to that is manual, on complaint, not an algorithm.
 *
 * One page, **top 100**, no pagination and no query parameters, which is what the closed URL
 * set requires of it (§10.7). 100 rows is one cached query at any catalogue size, and a
 * leaderboard's tail carries no information at launch.
 *
 * ISR at an hour (§6.1): one query on our schedule, cached bytes on everybody else's.
 */
export const revalidate = 3600

const TITLE = 'Contributors'
const DESCRIPTION =
  'Contributors are ranked here by the number of upvotes their Handle has been given.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/contributors' },
  // §7.16.5 — the page title and the page's own first sentence. No OG string is authored.
  openGraph: { title: TITLE, description: DESCRIPTION },
}

export default async function ContributorsPage() {
  const { rows, total } = await loadLeaderboard()

  return (
    <PageShell width="prose">
      <div className="prose">
        <h1>{TITLE}</h1>
        <p>{DESCRIPTION}</p>
        <p>
          The rule, in full: <strong>upvotes on the Handle</strong>, then{' '}
          <strong>published programmes</strong>, then the Handle itself, so the order is
          deterministic. Nothing is summed, weighted, blended or tuned. A programme is votable and
          an uploader is votable, separately, and this board reads the uploader counter alone:
          people vote for a person, and the board reports it. There is no second sort key, being
          forked is not a column, and there are no badges of any kind here or anywhere else.
        </p>
        <p>
          A contributor whose published programme count reaches zero is not listed. Their votes are
          kept, they are simply not ranked, and publishing again relists them.
        </p>

        {rows.length === 0 ? (
          <p>No one has published a programme yet.</p>
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Contributor</th>
                    <th scope="col">Upvotes</th>
                    <th scope="col">Programmes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id}>
                      <td className="tabular muted">{index + 1}</td>
                      <td>
                        <a href={`/u/${row.display_name}`}>{row.display_name}</a>
                      </td>
                      <td className="tabular">{formatCount(row.uploader_vote_count)}</td>
                      <td className="tabular">{formatCount(row.published_programme_count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              {formatCount(total)} contributor{total === 1 ? ' has' : 's have'} published at least
              one programme.
              {total > LEADERBOARD_LIMIT
                ? ` This page lists the top ${LEADERBOARD_LIMIT}; there is no second page.`
                : ''}
            </p>
          </>
        )}
      </div>
    </PageShell>
  )
}
