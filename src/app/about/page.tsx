import type { Metadata } from 'next'
import { PageShell } from '@/components/site/PageShell'
import { CC_BY_URL, SOURCE_REPO_URL } from '@/components/site/routes'

/**
 * `/about` — the long form. The homepage carries the description that Google's brand
 * verification fetches; this page is the overflow, and is free to be blunt (§7.13).
 *
 * Static at build, no data reads, no client JavaScript. It carries **no catalogue count**:
 * a count on an About page is traction dressed as a fact and it is wrong the day after it
 * is written (§7.4).
 *
 * Sections are in the order a stranger asks the questions in. "What this site does not do"
 * is the load-bearing section and is deliberately the longest — an About page whose
 * biggest block is a list of refusals cannot drift into a landing page without someone
 * noticing.
 */
export const dynamic = 'force-static'

const TITLE = 'About xer-hero'
const DESCRIPTION = 'xer-hero is a public library of Primavera P6 programmes.'

export const metadata: Metadata = {
  // Absolute rather than templated: the title already carries the site name (§7.13).
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/about' },
  // §7.16.5 — the page title and the page's own first sentence.
  openGraph: { title: TITLE, description: DESCRIPTION },
}

export default function AboutPage() {
  return (
    <PageShell width="prose">
      <div className="prose">
        <h1>{TITLE}</h1>

        <h2 id="what-this-is">What this is</h2>
        <p>
          xer-hero is a public library of Primavera P6 programmes. Planners upload <code>.xer</code>{' '}
          files, the site parses them and publishes them: a page per programme with its structure,
          logic, float, window and DCMA checks, and the original file to download.
        </p>
        <p>
          It exists because programmes are how construction and infrastructure work is actually
          planned, and almost none of them are public. A planner starting a rail depot, a pumping
          station or a tender programme has nothing to look at except their own last job.
        </p>
        <p>
          Everything published here is under <a href={CC_BY_URL}>CC-BY 4.0</a>: you may use it,
          change it and build on it commercially, as long as you credit whoever uploaded it. Every
          programme page carries a ready-made citation line.
        </p>

        <h2 id="what-you-can-do-without-an-account">What you can do without an account</h2>
        <p>
          Browse the shelf, filter it by sector, size, P6 version and whether the job has started,
          search titles and descriptions, open any programme, read its charts and tables, and
          download the original <code>.xer</code>. None of that asks you to sign in.
        </p>

        <h2 id="what-you-can-do-signed-in">What you can do signed in</h2>
        <p>
          Upload a programme. Upload a new revision of one you already own. Fork someone
          else&rsquo;s and upload your version of it. Upvote a programme or a contributor. Bookmark
          programmes privately for yourself.
        </p>

        <h2 id="what-happens-when-you-upload">What happens when you upload</h2>
        <p>
          Your browser reads the file before anything is sent. It tells you the activity count, the
          P6 version, the date range and whether the file is one this site can take, and it shows
          you a panel listing the people and free text it found inside &mdash; resource names,
          activity notes, the user the file was exported by. <code>.xer</code> files carry more than
          a schedule, and most planners have never opened one in a text editor.
        </p>
        <p>
          Nothing is removed from your file. It is published exactly as you uploaded it, and the
          download is the same bytes you sent. There is no way to publish part of a file, and no way
          to edit one after it is published: a correction is a new revision, and a programme that
          should not have been published is removed rather than edited.
        </p>
        <p>
          Publishing is immediate and it is public. There is no private tier, no drafts and no
          unlisted programmes.
        </p>

        <h2 id="signing-in-with-google">Signing in with Google</h2>
        <p>
          Google sign-in is the only way in, and it is used only to sign you in. Your Google name,
          email address and profile picture are held by Clerk, the sign-in provider, and this site
          never stores or displays any of them.
        </p>
        <p>
          What this site stores about you is a sign-in id and a <strong>Handle</strong> &mdash; a
          name you choose, which is the only name anyone else sees. The Handle is snapshotted onto
          each programme when you publish it, so renaming yourself later never rewrites credit on
          work you have already published.
        </p>
        <p>
          You can delete your account from your account page. Programmes you have already published
          stay published, because the CC-BY licence was granted irrevocably and other people may
          have forked them. If you want a programme gone as well, withdraw it first, then delete the
          account. <a href="/privacy">The privacy policy</a> says exactly what is stored and what
          happens to each of it.
        </p>

        <h2 id="what-this-site-does-not-do">What this site does not do</h2>
        <ul>
          <li>
            <strong>It does not review anything.</strong> No programme is looked at, approved, rated
            or endorsed by anyone before or after it is published.
          </li>
          <li>
            <strong>It does not screen files for personal data.</strong> The upload screen lists
            what it finds; it does not remove anything and it does not block a publication. The
            fields that can be detected reliably are empty in every real file this was measured
            against, and the fields that are populated cannot be told apart from ordinary scheduling
            data by any rule.
          </li>
          <li>
            <strong>DCMA checks are computed, not endorsed.</strong> They are a compliance audit of
            how a programme is built, not a measure of whether it is any good. A real, live,
            well-managed contract can fail several of them; a template built to pass will pass all
            of them. Sort by them if that is what you want; do not read them as a score.
          </li>
          <li>
            <strong>It does not schedule.</strong> Dates, float and progress are read from what P6
            wrote into the file. The site does not run its own forward or backward pass, and it does
            not recalculate anything.
          </li>
          <li>
            <strong>It makes no promise about any file here.</strong> Programmes are other
            people&rsquo;s work, published as uploaded. Whether one is correct, current, complete or
            safe to rely on is not something this site knows or claims.{' '}
            <a href="/terms">The terms</a> put that in the formal words.
          </li>
        </ul>

        <h2 id="who-runs-it">Who runs it</h2>
        <p>
          One person, in their own time, best effort. There is no company, no support desk and no
          service level. Reports and questions go to <a href="/report">the report page</a>, which is
          read.
        </p>
        <p>The site is free to use. There is no paid tier and nothing on it is for sale.</p>

        <h2 id="licences-and-source">Licences and source</h2>
        <p>
          The <strong>programmes</strong> are licensed by their uploaders under{' '}
          <a href={CC_BY_URL}>CC-BY 4.0</a>. The <strong>code</strong> is Apache-2.0 and the
          repository is public:{' '}
          <a href={SOURCE_REPO_URL}>{SOURCE_REPO_URL.replace('https://', '')}</a> &mdash; issues and
          pull requests welcome.
        </p>
      </div>
    </PageShell>
  )
}
