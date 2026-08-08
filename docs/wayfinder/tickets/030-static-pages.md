---
id: 030
title: "The site's static pages: home copy, /about, /privacy, /terms"
type: grilling
status: closed
assignee: carlo
blocked_by: []
---

## Question

Where do the words live, and at what URLs?

Surfaced by [Google OAuth in production](027-google-oauth-in-production.md), which found
the first thing in this effort that *requires* these pages to exist at public URLs rather
than merely to have been written. Google's brand verification — the free, automated step
that makes the consent screen say `xer-hero` instead of a hostname — requires a homepage
*"Hosted on a verified domain you own"*, *"Visible to users without requiring them to
log-in"*, that *"Fully describe[s] your apps functionality to users"* and
*"Explain[s] with transparency the purpose for which your app requests user data"*, with a
privacy policy *"hosted within the domain that hosts your homepage"* and a terms of
service.

Nothing in the closed set provides them. 003 versioned the legal **texts** as
`docs/legal/terms-v1.md` and `docs/legal/privacy-v1.md` and made `terms_version` snapshot
against them, but fixed no route. 023 *closed the URL set* — `/`, `/p/{slug}`,
`/p/{slug}/r/{n}`, `/u/{handle}`, the footer leaderboard, everything private under `/me` —
and the legal pages are not in it. 009 made `/` the shelf: a row list under a permanent
strap, which is the opposite of a page that describes what the site is.

Settle:

- **Does `/` have to change, or does an `/about` absorb it?** 009 froze the shelf as the
  homepage on an argument about crawlability and browsing, and that argument is untouched.
  But a reviewer landing on a bare grid of programmes has to be able to tell what the site
  does and why it asks for a Google identity. Decide whether the strap grows, whether a
  short lede sits above the shelf, or whether `/about` carries it and `/` links to it —
  and check the answer against 007's row-list finding and 009's frozen ordering.
- **What routes serve 003's legal texts, and how.** The texts are versioned markdown in
  the repo and `terms_version` points at repo history. Decide whether `/terms` renders the
  current version, whether older versions are addressable (an uploader's snapshot points
  at one), and whether these are static or built. Note 013 amended the privacy policy,
  017 added the 90-day contact purge, 027 adds a Google-user-data disclosure, and 010
  rewrote its personal-data section — four amendments against a file nobody renders.
- **Does the footer become the navigation for all of it?** 016 made the leaderboard
  footer-linked deliberately, so a footer exists as a concept. Terms, privacy, the repo
  link and the CC-BY notice all want the same place.
- **What the pages must not say.** 013's no-warranty standing decision bans anything
  worded as a guarantee, and these are the pages most likely to break it — an "about" page
  is where a project describes itself flatteringly. Google requires description, not
  assurance; state the line.
- **Whether any of this blocks provisioning.** 027 put brand verification after the site
  is deployed with `/privacy` and `/terms` live. If those routes do not exist, step 14.10
  cannot run and the consent screen keeps showing a hostname. Say whether that is a launch
  blocker or a post-launch tidy.

## Resolution

**Five public routes, a site-wide footer, one number that names a pair of files, and a
95-word lede on the shelf.** `/` stays 009's shelf and gains three paragraphs of prose at
the canonical bare URL only; `/about` carries the long form; `/terms` and `/privacy` render
the current version with every superseded version addressable at `/terms/v{n}` and
`/privacy/v{n}`; the footer carries six links and one sentence, on every page. **Zero schema
demand, zero backfill, and nothing enters `derived.json`, `activities.json` or `card`** —
these pages read no programme data at all.

Routes, the version scheme, the wording rules and the actual copy — the home lede, the whole
of `/about`, the footer, and both legal documents' section structure with the four privacy
amendments folded in — are [in the asset](assets/static-pages.md).

**The finding worth stating before anything else: the file is not merely unrendered, it has
never been written.** 003 named `docs/legal/terms-v1.md` and `docs/legal/privacy-v1.md`
in July; 010 rewrote its personal-data section, 013 added a third-party-personal-data
section, 017 added the 90-day contact purge and 027 added a Google-user-data disclosure.
**`docs/legal/` does not exist.** Four amendments have accumulated against a path, not a
document — which is why this resolution's asset drafts the structure rather than describing
edits to it, and why `terms_version` currently points at nothing an uploader could be shown.

### The homepage question is a reading question, not a layout one

The ticket offered three options — grow the strap, put a lede above the shelf, or let
`/about` absorb it — and framed them as a layout trade against 009. **The trade is not with
009. It is with a reviewer.**

Google's branding form has one field named *App home page*, and its stated requirements are
that the page *"Fully describe[s] your apps functionality"* and *"Explain[s] with
transparency the purpose for which your app requests user data"* (027, asset fact 17). The
automated check that 027 priced at *"a few minutes"* is a fetch — reachable, on the verified
domain, no login — and `/about` would pass it. The fallback is **a manual review that
"usually takes 2-3 business days"**, and a human reviewer typing `xerhero.com` has to find
the description at the address they were given. Nominating `/about` bets one manual review
on a path reading of the word *home*, to save four sentences.

**So `/` carries the description, and `https://xerhero.com/` is what goes in the field.**
027's own asset already wrote that URL into step 14.10 and nobody had checked whether the
page underneath could support it. Now it can, and `/about` becomes free rather than
load-bearing: no reading of the requirement can fail, because the strict reading is
satisfied.

**009's shelf is untouched and its ordering is not re-litigated.** What changes is that the
page gains prose above the filter bar. Three things make that survive rather than reopen §1:

1. **The dismissible intro band was rejected for *state*, not for prose.** 009's words: it
   *"costs a state flag and produces two different first screens, so the page you describe to
   someone is not the page they get."* A lede keyed on the **URL** has no state — bare `/`
   always renders it, `/?sector=rail` never does, and it is identical for every viewer signed
   in or out. That is the same mechanism 009 itself used twice: relevance appears in the sort
   control *only while `q` is set*, and pagination chrome does not render when page 1 holds
   everything. A block that varies with the canonical URL is a different page, which is
   exactly what 009 asked for.
2. **007's relief rule is about width, and the lede costs height.** The reason 009 refused a
   left rail is that it compresses the drawn columns — the 30px float sliver with its three
   numeric slots, and the S-curve on a local axis — which 007 called a relief rule rather than
   decoration. A block above the grid takes no horizontal space from any row. Bounded at
   ~95 words, it costs roughly two rows above the fold, on one URL.
3. **The strap does not grow**, and the reason is that the header renders everywhere. A
   sign-in disclosure at the top of `/p/{slug}` is noise; 009 fixed the strap at one line and
   it stays *"Public Primavera P6 programmes. Browse, download, fork."*

The minimum, stated concretely because the ticket asked for a minimum: **three paragraphs and
a link row.** What the site is; what you can do with it and that nothing here is reviewed;
and why it asks for a Google identity, which is the paragraph Google's requirement is
actually about and which nothing in the closed set had ever written down. Full text in the
asset §5.

### The legal texts: one number names a pair, and the files are immutable

Four decisions, and the second is the one that was not obvious.

**Old versions are addressable.** `/terms` and `/privacy` render the current text and are
canonical; `/terms/v{n}` and `/privacy/v{n}` render version `n`. This is not tidiness: 003
made `terms_version` *"the only thing that matters if an upload is ever disputed"*, and 013
then fused the checkbox wording and the pre-publish panel into **one claim under one
`terms_version`**. A snapshot that resolves only to a git blame on a file in `docs/` is a
snapshot of something the person who agreed to it cannot read. The cost is zero — the
versions are files that already have to exist, so the route is a static param map over the
files present.

**One version number covers both documents.** `terms_version` is one column, so it resolves
to one coordinate; independent numbering needs a second column and a rule about which number
the checkbox pins. 013 settled that in advance without naming it: it hardened the checkbox
*and* added a privacy-policy section as a single change, because the third-party-personal-data
disclosure is part of what the uploader is warranting about. **A bump ships both files even
when one is byte-identical.** A duplicated few kilobytes buys `terms_version = 'v3'`
resolving to exactly two URLs that both exist.

**A shipped legal file is never edited — not for substance, not for a typo.** Repo history is
the audit trail (003), and an in-place edit is precisely the case history cannot distinguish
at a glance. A typo in v1 costs a v2, which is the correct price. CI asserts that no
previously-shipped file changed in a diff and that both files named by the current-version
constant exist.

**Static, built, and living where 003 put them.** `docs/legal/` stays — the path is cited by
a closed ticket and by the map, and there is nothing to migrate because there is nothing
there. Markdown → HTML **at build time**, one dependency, no MDX, no CMS, no runtime file
read, no client JavaScript on the page. These are the only routes in the estate that read
neither Postgres nor a blob, so after the build they cost nothing on 010's Active CPU meter —
which matters slightly more than usual, because `/privacy` is a URL a search crawler and a
verification robot both fetch.

Crawl handling, since 023 and 025 have been accumulating a canonical-URL story: the current
version's numbered URL canonicalises to the bare route, and **superseded versions are
`noindex`** so stale legal text is not what a search for "xerhero terms" returns.

### The footer: six links, and 016 built the container without knowing it

**016 invented the footer as an anti-gaming device** — *"farming 20 accounts to top a
footer-linked page is a bad trade"* — and it turns out to be the only site-wide container in
the design. Google requires the privacy policy reachable *"without requiring [users] to
log-in"*, and a link that exists only on `/` is reachable from exactly one of the site's
public entry points — while most arrivals are a shared `/p/{slug}`. A structural choice made to demote a leaderboard is what makes the legal
pages reachable from a shared `/p/{slug}` link.

Exactly six links and one sentence: **About · Terms · Privacy · Contributors · Report a
problem · Source**, then *"Programmes are published by their uploaders under CC-BY 4.0. This
site's code is Apache-2.0. Run by one person, best effort, with no warranty — see the
terms."*

Two URLs are **fixed here because a footer cannot be enumerated without hrefs**, and neither
had one: 016's leaderboard becomes **`/contributors`** and 017's intake form becomes
**`/report`**. Both tickets' contents are unchanged; this ticket gives them addresses and a
link.

**017's published mailbox is printed on `/report`, not in the footer.** A `mailto:` in the
root layout publishes the operator's address on every page of a public site to every scraper
that visits, for a channel 017 explicitly made *secondary* to the row. The footer links the
page; the page prints the address.

Refused, with reasons in the asset §7: a licence badge image, the catalogue count, a repeat
of the header nav, and a cookie-policy link — there being nothing to consent to (below).

### What the pages must not say — the rule, not the principle

The line is: **describe mechanism and behaviour in the present tense; never characterise
outcome, quality or safety.** "The file is published exactly as you uploaded it" is
mechanism. "Your file is published safely" is an outcome and is banned.

The distinguishing test, which is what makes this applicable rather than tasteful: **could
the sentence become false without anyone changing the code?** If yes it is a promise and it
is banned. If it can only become false by someone shipping different software, it is a
description — and 027 established Google demands exactly those.

Concretely (full lists in asset §3):

- **Banned about programmes or contributors:** verified, checked, reviewed, approved,
  validated, certified, vetted, trusted, curated, quality-assured, screened, moderated, "safe
  to use". These are already out of the whole effort under the map's badge entry.
- **Banned about the service:** secure, safe, protected, guaranteed, reliable, robust,
  always, uptime, any availability percentage, "your data is safe".
- **Banned in the first person:** "we ensure", "we make sure", "we guarantee", "you can be
  confident", "rest assured".
- **Banned as future tense:** "free forever", "we will never", "we'll always". The site may
  state what it does; it may not state what it will do.
- **Banned as traction:** best, leading, definitive, largest, "the only", "trusted by",
  testimonials, logos. Counts may be reported and may not be celebrated — 009 already renders
  *"142 programmes · page 1 of 6"* and that is the correct register, which is why `/about`
  carries no count at all.

Three specific rewrites the closed set forces, because an About page will reach for all
three: the pre-publish panel *"lists what it finds"* and never *"checks your file for
personal data"* (013 refused screening precisely so that sentence is unavailable); `noindex`
*"asks search engines not to index"* and never *"prevents"* (013: mitigation, not
protection); and DCMA is *"computed and reported, not endorsed"*, with 009's inversion
finding stated in the open — a real live contract can fail several checks and a template
built to pass will pass all of them.

**The safeguard against the flattery is structural rather than editorial.** `/about`'s
longest section is *"What this site does not do"*, and it is where the no-warranty posture
becomes readable prose instead of a clause in a document nobody opens. An About page whose
biggest block is a list of refusals cannot drift into a landing page without someone
noticing. *Its existence and its bluntness are overturnable taste; its content is not.*

Two sentences that read like assurance and are **required**, both surviving 013 under the
test above: *"Your Google name, email and profile picture are never shown on this site"* —
003 wrote that sentence itself, and 010's schema plus 027's `picture` finding make it a
statement about the code — and *"Signing in with Google is used only to sign you in"*, which
is the purpose statement Google's requirement is literally about.

### One decision the privacy policy could not be written without

**No analytics in v1**, of any kind: no Google Analytics, no Vercel Web Analytics, no
Plausible, no pixel, no beacon. No advertising, no trackers, no third-party embeds, no
remotely-loaded fonts. Cookies are **the Clerk session cookie only**, strictly necessary, set
at sign-in; a signed-out visitor receives no cookie from this site at all. The two remaining
third parties in a browser are named honestly: Cloudflare Turnstile on `/report` (017's spam
control) and Cloudflare serving the blob host.

003 required analytics to be *"named rather than glossed"*, and this is the cheapest honest
name. The consequence is a page nobody has to build: **there is no cookie banner and no
consent management**, because nothing is set that needs consent. It is also the standing
preference paying out — free, and one fewer vendor in a browser. Adding any analytics later
reopens the question and costs a new version of both documents, which is the right friction.

### Provisioning: not a blocker. Launch: a blocker, and not because of Google

The plainest possible answer, in three parts, because the ticket's framing has the dependency
backwards.

**Provisioning is not blocked at all.** Nothing in 026's sixteen steps, and nothing in 027's
launch path (steps 14.1–14.9), needs a page to exist. Domain, zone, bucket, custom domain,
Cache Rule, tokens, Vercel domains, `ops bucket apply`, Search Console TXT, the OAuth client,
Publish, Clerk production — all of it runs against a site that serves nothing.

**Launch is blocked, by 003 rather than by Google.** 003's upload checkbox snapshots
`terms_version` against a text the uploader is shown, and 013 hardened that text into the
same claim as the pre-publish panel. **Without `/terms` there is no lawful first upload**, and
upload is the product. So `/terms` and `/privacy` are v1 build work on the critical path, and
`/about` joins them because Google's homepage requirement is only satisfiable by a live page
and the cold visitor 009 named exists on day one. The pages are cheap — static, no data, no
JavaScript — but they are not optional.

**Brand verification stays exactly what 027 called it: a post-launch tail that costs a wrong
name until it is done.** Sign-in works unverified with no interstitial and no user cap; what
is wrong until step 14.10 runs is that the consent screen shows a hostname, plausibly
`clerk.xerhero.com`. Nothing here changes that, and this ticket removes the last reason it
could not run.

**One of 027's UNVERIFIED flags is defused by ordering rather than answered.** It flagged
that the *Publish* click itself might demand the privacy and terms URLs, in which case step
14.8 moves after the deploy. Both URLs are now fixed strings on a known apex —
`https://xerhero.com/terms` and `https://xerhero.com/privacy` — so if the form asks, the
operator types them without a decision, and if the pages ship in the first production deploy
(they are static, so they cost nothing to include) the question never arises in either
direction. The behaviour stays unverified; the *decision* half of the flag is closed.

### The three lawyer questions stay flagged, and now have paragraphs

003 flagged two and 013 added a third. **None is answered here and none blocks anything**,
which is 003's own posture. What changes is that each now points at a specific section rather
than at an intention: hosting-provider liability and whether a published notice-and-takedown
procedure is a condition of it lands on terms §9.7 and §9.13; whether the CC-BY grant
survives a UK GDPR erasure request lands on privacy §8.5 and §8.8; and whether an uploader
warranty plus an advisory panel is a lawful basis for publishing third-party personal data —
and whether the site is controller or joint controller — lands on privacy §8.6. They are
marked inline in the asset as `LAWYER` blocks so a drafter cannot lose them, and v1 ships
unreviewed and says so, exactly as 003 decided.

### What this hands to other tickets

- **[Licensing, attribution and takedown](003-licensing-attribution-takedown.md)** — its
  texts get routes, a version scheme and an immutability rule; its closing line that drafting
  is *"build work, not a decision"* had two decisions inside it.
- **[Browse, search, filter and ranking](009-browse-search-ranking.md)** — `/` gains a
  URL-keyed lede and a site-wide footer; the strap, the frozen order, the left-rail rejection
  and the canonicalisation rules are all untouched.
- **[Personal data in published .xer files](013-personal-data-in-published-files.md)** — its
  standing decision becomes a banned-phrase list and a test; its privacy section gets a
  heading, a route and a reader.
- **[Credit, upvotes and the contributor leaderboard](016-credit-upvotes-leaderboard.md)** —
  the footer it invented exists, with an enumerated set, and the board gets `/contributors`.
- **[What tooling does the operator need to run a takedown?](017-operator-takedown-tooling.md)** —
  the form gets `/report`, the mailbox gets a home that is not every page, and the 90-day
  contact purge gets a named section.
- **[The signed-in user's own space](023-signed-in-users-own-space.md)** — its closed URL set
  reopens by five public routes plus two fixings; its header is untouched.
- **[Google OAuth in production](027-google-oauth-in-production.md)** — its flag is resolved,
  `https://xerhero.com/` is confirmed as the App home page URL, and step 14.10 becomes
  runnable.

### Schema, backfill, and the derived contracts

- **Schema demand: zero.** No table, no column, no index, no migration. `terms_version`
  already exists (003); what this ticket fixes is the *convention* for its value (`'v{n}'`,
  naming a pair of files, concatenable into two URLs), which is a constant in the repo and a
  CI assertion, not DDL.
- **Backfill demand: none.** Nothing is recomputed and nothing existing is invalidated. A
  future version bump writes a new value on new uploads only, and every historical
  `terms_version` keeps resolving, which is the whole point of the immutability rule.
- **`derived.json`, `activities.json`, `card`: nothing enters any of them.** These pages read
  no programme data whatsoever — `/about`, `/terms*` and `/privacy*` touch neither Postgres
  nor a blob, and the footer and the lede are static text. The contracts stay at
  `derived.json` v2 and `activities.json` v2, unmoved.

### Flagged

- **The site's own crawl surface has no owner.** 013 and 024 wrote and asserted a
  `robots.txt` for the *blob* host; nothing has ever written one for `xerhero.com`, there is
  no sitemap, and `<link rel="canonical">` is now required by this ticket's own version URLs
  and by 025's apex-canonical decision. The URL set is closed again and therefore
  enumerable. Filed as its own ticket.
- **No analytics means no traffic data at all.** The operator will not know whether anyone
  reads `/about`, which pages are entered from search, or whether a programme page is ever
  opened. That is the chosen trade, recorded here so it is a decision rather than a
  discovery.
- **`docs/legal/` still does not exist.** This resolution's asset is the drafting brief;
  writing the two v1 files is build work and it is on the launch critical path, unlike most
  build work this map has produced.
- **The three lawyer questions ship unreviewed in v1** (§ above), which is 003's decision
  re-stated rather than a new one, but it is now a decision about text that exists.
