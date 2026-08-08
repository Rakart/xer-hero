# The static pages — routes, versions, wording rules and the actual copy

Working detail for [ticket 030](../030-static-pages.md). The decisions and their reasoning
are in the ticket; this file is the mechanical half plus the words themselves.

Everything here is drafted against the closed set as of **2026-08-08**. Where a sentence
restates a closed decision, the ticket number is in a trailing comment in the source
markdown, not in the rendered page.

---

## 1. Route map

| Route | Renders | Build | Auth | Crawl |
| --- | --- | --- | --- | --- |
| `/` | 009's shelf, plus §5's lede **only at the canonical bare `/`** | server-rendered, viewer-independent | public | indexed |
| `/about` | §6 | static at build | public | indexed |
| `/terms` | the current terms | static at build | public | indexed, canonical |
| `/terms/v{n}` | terms version `n` | static at build, one path per file present | public | current → `<link rel="canonical" href="/terms">`; superseded → `noindex` |
| `/privacy` | the current privacy policy | static at build | public | indexed, canonical |
| `/privacy/v{n}` | privacy version `n` | static at build | public | same rule as `/terms/v{n}` |
| `/contributors` | 016's leaderboard | server-rendered | public | indexed |
| `/report` | 017's takedown intake form and the published mailbox | server-rendered shell, POST handler | public, no account (003) | indexed |

`/contributors` and `/report` are **URL fixings, not new surfaces**. 016 specified a
footer-linked board and never gave it a path; 017 specified a form and a published mailbox
and never gave them one. Their contents are unchanged from those tickets.

The four static routes (`/about`, `/terms*`, `/privacy*`) are **prerendered at build time
and revalidate never**. They read no database and no blob, so they cost zero Function
invocations and zero Active CPU on 010's Hobby meter after the build. A change to any of
them is a commit and a deploy, which is the same act that changes the repo history
`terms_version` points at.

### Footer and header placement

- The **footer is site-wide**, in the root layout, on every route including `/me/*` and
  `/p/{slug}`. It is a static, viewer-independent block, so it does not touch 023's
  argument that the signed-out render of a public page is cacheable.
- The **header is untouched.** 009 fixed it as wordmark + one-line strap; 023 added the
  signed-in cluster. Nothing in this ticket goes in the header.

---

## 2. The version scheme

### 2.1 Where the files live

```
docs/legal/
  terms-v1.md
  privacy-v1.md
  terms-v2.md          # when there is a v2
  privacy-v2.md        # …and there is always a matching pair
```

003 named `docs/legal/terms-v1.md` and `docs/legal/privacy-v1.md` and the map cites that
path. It does not move. The app imports them at build time; nothing reads them at runtime.

### 2.2 One number covers both documents

`terms_version` is one column (003), so it resolves to one coordinate. **A version number
names a *pair*.** Bumping either document ships both files, even when one is byte-identical
to its predecessor.

The alternative — independent numbering — needs a second column and a rule about which
number the upload checkbox pins, and 013 already made that impossible to answer cleanly:
it hardened the checkbox's wording *and* added a privacy-policy section as **one** change,
on the argument that "the warranty and the pre-publish panel become the same claim under
one `terms_version`". The privacy policy's third-party-personal-data section is part of
what the uploader is warranting about. One number.

Cost: a duplicated file at every bump. It is a few kilobytes and it makes
`terms_version = 'v3'` resolve to exactly two URLs that both exist.

### 2.3 Files are immutable once deployed

**A shipped legal file is never edited — not for substance, not for typos, not for a broken
link.** Any change is a new file at a new number.

This is what makes the snapshot mean anything. `terms_version` is evidence about what a
person was shown; if the file it names can be edited afterwards, it is evidence about
nothing. Repo history is the audit trail (003), and an in-place edit is exactly the case
git history cannot distinguish from the original at a glance.

The practical consequence: a typo in v1 costs a v2. That is the correct price.

### 2.4 What the version number is

`terms_version` stores the string `v{n}` — `'v1'`, `'v2'`. Not a git SHA, not a date. The
value is the URL suffix, so rendering "the version you agreed to" on any operator or owner
surface is string concatenation and never a lookup:

```
https://xerhero.com/terms/{revision.terms_version}
https://xerhero.com/privacy/{revision.terms_version}
```

The current version is a single constant in the repo (`CURRENT_TERMS_VERSION`). Bumping it
is part of the same commit that adds the new pair, and CI asserts that both files named by
the constant exist and that no previously-shipped file changed in the diff.

### 2.5 Rendering

Markdown → HTML **at build time**, one dependency, no MDX, no CMS, no client hydration, no
runtime file read. The pages carry no interactivity of any kind.

Headings get anchor ids so a paragraph can be linked to — which the three lawyer questions
(§9) and 017's operator correspondence both need.

---

## 3. Wording rules

013's standing decision — *nothing on the site is ever worded as a guarantee* — is a rule
about prose, and these are the pages most likely to break it. Stated as rules a drafter can
apply, rather than as a principle.

### 3.1 The line

**Describe mechanism and behaviour in the present tense. Never characterise outcome, quality
or safety.**

| Banned | Allowed |
| --- | --- |
| "your file is published safely" | "the file is published exactly as you uploaded it" |
| "we check uploads for personal data" | "before you publish, the upload screen lists the names and free text it finds in your file" |
| "downloads are excluded from search engines" | "the download URL asks search engines not to index it. That is a request to well-behaved crawlers, not a barrier" |
| "programmes here are high quality" | "DCMA checks are computed and reported for every programme" |
| "your data is secure" | "your Google email is never written to this site's database" |
| "always available" | *(say nothing about availability except the terms' no-warranty clause)* |

### 3.2 Banned words and phrases, on every page

- **Assurance about programmes or contributors:** verified, checked, reviewed, approved,
  validated, certified, vetted, trusted, curated, quality-assured, screened, moderated,
  "safe to use", "ready to use". These are ruled out of the whole effort by the map's
  Out-of-scope entry on badges, not merely discouraged here.
- **Assurance about the service:** secure, safe, protected, guaranteed, reliable, robust,
  always, uptime, any percentage attached to availability, "your data is safe".
- **Assurance in the first person:** "we ensure", "we make sure", "we guarantee", "you can
  be confident", "rest assured", "don't worry".
- **Promises about the future:** "free forever", "we will never", "we'll always", "coming
  soon" with a date. The site may state what it *does*; it may not state what it will do.
- **Superlatives and traction:** best, leading, definitive, largest, fastest, "the only",
  "trusted by", "join thousands", testimonials, logos.

### 3.3 Two things that read like assurance and are not

Both are required by Google's brand verification (027) and both survive 013, because they
describe the software rather than warrant an outcome:

1. **"Your Google name, email and profile picture are never shown on this site."** This is
   010's schema and 003's pseudonym stated as fact. 003 wrote the same sentence itself.
2. **"Signing in with Google is used only to sign you in."** This is a statement of purpose,
   which is the thing Google explicitly demands and 013 explicitly does not ban.

The distinguishing test: could the sentence become false without anyone changing the code?
If yes, it is a promise and it is banned. If it can only become false by someone shipping
different software, it is a description and it is required.

### 3.4 Numbers

Counts may be reported and may not be celebrated. 009 already renders "142 programmes ·
page 1 of 6" on the shelf and that is the correct register. `/about` carries no count at
all, because a count on an About page is traction dressed as a fact and it is wrong the day
after it is written.

### 3.5 Voice

Second person for the reader. "This site" and "the operator" rather than "we" — there is one
person and "we" invents an organisation. The legal pages may say "the site" and "the
operator"; they never say "the Company". *Overturnable taste.*

---

## 4. What each page must contain to satisfy Google

From 027's asset, fact 17. `https://xerhero.com/` is what goes in the branding form's **App
home page** field.

| Google requires | Where it lands |
| --- | --- |
| Hosted on a verified domain you own | 025's apex, 027's step 14.2 TXT record |
| Visible to users without requiring log-in | `/` is the shelf; no route in §1 is behind auth |
| Accurately represent and identify your app | header wordmark `xer-hero` + lede line 1 |
| **Fully describe your app's functionality** | lede ¶2, in full sentences, on `/` itself |
| **Explain the purpose for which your app requests user data** | lede ¶3 |
| A link to your privacy policy | footer, on every page, plus the lede's link row |
| Privacy policy hosted within the same domain | `/privacy` on the apex |
| Privacy policy discloses how the app accesses, uses, stores or shares Google user data | privacy §2, written for that requirement |
| Terms of service | `/terms` |

The description burden is deliberately carried by `/` and not by `/about`. Google's field is
named *home page* and its automated check is a fetch; if verification falls through to the
manual review 027 priced at 2–3 business days, a reviewer reading `xerhero.com` must find the
description there rather than one click away. `/about` is then free, and no reading of the
requirement can fail.

---

## 5. Copy — the home lede

Renders **only when the URL is bare `/`**: no `q`, no `sector`, no `size`, no `p6`, no
`progressed`, no `sort`, no `page`. Identical for every viewer, signed in or out.

Sits between the header and 009's filter bar. Body type, left-aligned, no background, no
image, no button, no dismiss control. Three paragraphs and a link row.

> ### Public Primavera P6 programmes, shared as `.xer` files.
>
> Planners upload programmes here and they are published in full, under CC-BY 4.0. Browse
> the shelf below, open one to read its structure, logic and DCMA checks, download the
> original `.xer`, or fork it and upload your own version. Nothing here is reviewed —
> every programme is another planner's work, published exactly as they uploaded it.
>
> Browsing and downloading need no account. Signing in with Google is used only to sign
> you in, so that you can upload, upvote and bookmark. Your Google name, email and profile
> picture stay with the sign-in provider; this site stores a sign-in id and the Handle you
> choose, and shows neither your name nor your email anywhere.
>
> [About this site](/about) · [Terms](/terms) · [Privacy](/privacy)

Roughly 95 words. On a 1080-tall viewport it costs about two shelf rows above the fold, on
one URL, and buys the statement 009 §1 recorded as unpaid: *"a cold visitor sees twelve
columns of planner jargon and no statement of what the site is."*

**The strap does not change.** 009's *"Public Primavera P6 programmes. Browse, download,
fork."* stays in the header on every page. The lede's H2 deliberately restates its first
clause, because a reader who scrolls past the header still needs the sentence, and the strap
cannot carry ¶3 — the header renders on `/p/{slug}` too, where a sign-in disclosure has no
business.

---

## 6. Copy — `/about`

Title: **About xer-hero**

> ## What this is
>
> xer-hero is a public library of Primavera P6 programmes. Planners upload `.xer` files,
> the site parses them and publishes them: a page per programme with its structure,
> logic, float, window and DCMA checks, and the original file to download.
>
> It exists because programmes are how construction and infrastructure work is actually
> planned, and almost none of them are public. A planner starting a rail depot, a
> pumping station or a tender programme has nothing to look at except their own last job.
>
> Everything published here is under [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/):
> you may use it, change it and build on it commercially, as long as you credit whoever
> uploaded it. Every programme page carries a ready-made citation line.
>
> ## What you can do without an account
>
> Browse the shelf, filter it by sector, size, P6 version and whether the job has started,
> search titles and descriptions, open any programme, read its charts and tables, and
> download the original `.xer`. None of that asks you to sign in.
>
> ## What you can do signed in
>
> Upload a programme. Upload a new revision of one you already own. Fork someone else's
> and upload your version of it. Upvote a programme or a contributor. Bookmark programmes
> privately for yourself.
>
> ## What happens when you upload
>
> Your browser reads the file before anything is sent. It tells you the activity count,
> the P6 version, the date range and whether the file is one this site can take, and it
> shows you a panel listing the people and free text it found inside — resource names,
> activity notes, the user the file was exported by. `.xer` files carry more than a
> schedule, and most planners have never opened one in a text editor.
>
> Nothing is removed from your file. It is published exactly as you uploaded it, and the
> download is the same bytes you sent. There is no way to publish part of a file, and no
> way to edit one after it is published: a correction is a new revision, and a programme
> that should not have been published is removed rather than edited.
>
> Publishing is immediate and it is public. There is no private tier, no drafts and no
> unlisted programmes.
>
> ## Signing in with Google
>
> Google sign-in is the only way in, and it is used only to sign you in. Your Google name,
> email address and profile picture are held by Clerk, the sign-in provider, and this site
> never stores or displays any of them.
>
> What this site stores about you is a sign-in id and a **Handle** — a name you choose,
> which is the only name anyone else sees. The Handle is snapshotted onto each programme
> when you publish it, so renaming yourself later never rewrites credit on work you have
> already published.
>
> You can delete your account from your account page. Programmes you have already published
> stay published, because the CC-BY licence was granted irrevocably and other people may
> have forked them. If you want a programme gone as well, withdraw it first, then delete
> the account. [The privacy policy](/privacy) says exactly what is stored and what happens
> to each of it.
>
> ## What this site does not do
>
> - **It does not review anything.** No programme is checked, approved, rated or endorsed
>   by anyone before or after it is published.
> - **It does not screen files for personal data.** The upload screen lists what it finds;
>   it does not remove anything and it does not block a publication. The fields that can be
>   detected reliably are empty in every real file this was measured against, and the fields
>   that are populated cannot be told apart from ordinary scheduling data by any rule.
> - **DCMA checks are computed, not endorsed.** They are a compliance audit of how a
>   programme is built, not a measure of whether it is any good. A real, live, well-managed
>   contract can fail several of them; a template built to pass will pass all of them. Sort
>   by them if that is what you want; do not read them as a score.
> - **It does not schedule.** Dates, float and progress are read from what P6 wrote into the
>   file. The site does not run its own forward or backward pass, and it does not recalculate
>   anything.
> - **It makes no promise about any file here.** Programmes are other people's work,
>   published as uploaded. Whether one is correct, current, complete or safe to rely on is
>   not something this site knows or claims. [The terms](/terms) put that in the formal
>   words.
>
> ## Who runs it
>
> One person, in their own time, best effort. There is no company, no support desk and no
> service level. Reports and questions go to [the report page](/report), which is read.
>
> The site is free to use. There is no paid tier and nothing on it is for sale.
>
> ## Licences and source
>
> The **programmes** are licensed by their uploaders under CC-BY 4.0. The **code** is
> Apache-2.0 and the repository is public: [github.com/…](https://github.com/) — issues and
> pull requests welcome.

Sections in that order because it is the order a stranger asks the questions in: what is
this, what can I do, what happens if I contribute, what happens to me, what does it not do,
who is behind it.

**"What this site does not do" is the load-bearing section**, and it is deliberately the
longest. It is where 013's no-warranty posture becomes readable prose instead of a clause,
and it is doing the job an About page normally does with a features list. *Its existence and
its bluntness are overturnable taste; its content is not.*

---

## 7. Copy — the footer

Site-wide, in the root layout. One rule of six links and one paragraph. No columns, no
newsletter, no social icons, no copyright line.

> ---
> [About](/about) · [Terms](/terms) · [Privacy](/privacy) · [Contributors](/contributors) · [Report a problem](/report) · [Source](https://github.com/)
>
> Programmes are published by their uploaders under [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/).
> This site's code is Apache-2.0. Run by one person, best effort, with no warranty — see
> [the terms](/terms).

### Exactly six links, and what was refused

| Link | Target | Why it is here |
| --- | --- | --- |
| About | `/about` | the long description; Google's homepage requirement's overflow |
| Terms | `/terms` | 003; required by Google; linked from the upload checkbox too |
| Privacy | `/privacy` | 003, 010, 013, 017, 027; **required on every page** so it is reachable from any entry point without login |
| Contributors | `/contributors` | 016's leaderboard, footer-linked by that ticket's own anti-gaming argument |
| Report a problem | `/report` | 017's intake form; the published mailbox is printed **on that page**, not in the footer, so it is not harvested off every page on the site |
| Source | the GitHub repo | Apache-2.0 and a public repo; also where 003's `docs/legal/*.md` history lives, which is the audit trail behind `terms_version` |

Refused:

- **A raw `mailto:` in the footer.** 017's mailbox is a second channel behind a form, not a
  primary contact; putting it on every page publishes it to every scraper.
- **`/me`, `/upload`, `/`.** The header already carries all three (009, 023). A footer that
  repeats the nav is a sitemap nobody reads.
- **A cookie/consent link.** §8.9 explains why there is nothing to consent to.
- **A licence badge image.** An image asset for a sentence that fits in a sentence.
- **The catalogue count.** §3.4.

---

## 8. `/privacy` — structure and prose

Twelve sections. This is the file with four amendments against it (010, 013, 017, 027) and
none of them has ever been rendered; each is marked below where it lands.

Header block on the page, above section 1:

> **Privacy policy — version 1.** Last changed: *(date of the commit that shipped it)*.
> Earlier versions stay published at `/privacy/v1`, `/privacy/v2`, …

### 8.1 Who runs this site

One person, named, operating `xerhero.com`. No company. Contact is the report page and the
published mailbox. Best effort, no service level (003).

### 8.2 Signing in with Google

**Written to 027's requirement**, which is the one section with an external reader.

Content, in this order:

- Sign-in is Google only, through **Clerk**, the site's authentication provider.
- Google returns to Clerk: a stable account identifier, your email address and whether it is
  verified, your name, your profile picture URL and your locale. The site asks for the
  `openid`, `email` and `profile` scopes and nothing else; the last two are required by
  Clerk and cannot be narrowed.
- **This site stores none of it.** Its own database holds a Clerk user id and your Handle,
  and nothing else about you as a person. *(010 — this is the amendment that made 003's
  original disclosure obsolete and replaced it with a stronger claim.)*
- Your Google name, email and profile picture are **never displayed anywhere on this site**,
  to anyone, including you. *(027 — `picture` arrives with a scope that cannot be dropped,
  so the only thing keeping it off the site is that nothing renders it.)*
- What the identity is used for: signing you in, attaching your uploads, votes and bookmarks
  to an account, and letting the operator contact you about a takedown affecting your own
  programme. Nothing else. No profiling, no advertising, no sale, no sharing.
- Google's own handling of the sign-in is Google's, and their privacy policy is linked.

### 8.3 What this site stores about you

A table, because a list of columns is the honest form:

| Stored | Where | Kept until |
| --- | --- | --- |
| A sign-in id issued by Clerk | this site's database | you delete your account |
| Your Handle | this site's database | retired permanently when you delete your account or rename; never reassigned |
| Programmes and revisions you upload, and their metadata | this site's database and file storage | published permanently unless withdrawn or removed |
| The Handle as it stood at each upload | on the programme row | permanently — it is the credit |
| Your upvotes | this site's database | kept if you delete your account, unlinked from you |
| Your bookmarks | this site's database | deleted with your account |
| Unfinished uploads | this site's database | deleted with your account; swept after 24 hours regardless |

*(023 — bookmarks and votes were added to the policy by that ticket and had nowhere to go.)*

No IP address log, no analytics profile, no device fingerprint, no email address.

### 8.4 Your Handle, and what other people see

003's pseudonymity, stated as what a reader sees:

- Your Handle is the only name anyone else sees, and you choose it.
- It appears on programmes you publish, on your contributor page and on the leaderboard.
- Vote totals are public; **who voted is not**, and is visible only to the operator.
  Bookmarks are private throughout — no count, never shown to anyone. *(016.)*
- Renaming retires the old Handle permanently and nobody can claim it, including you.
  Programmes keep the Handle they were published under.

### 8.5 Programmes you upload are public and permanent

Upload is publish. CC-BY 4.0, irrevocably granted, so forks and copies survive anything you
do afterwards. Files are served publicly and are cached by a CDN. Deleting your account does
not unpublish them; withdrawing them does — and even then, forks taken while they were
published stay.

### 8.6 If you are named in a programme someone else uploaded

**The whole of 013's amendment, and the section it added.**

- `.xer` files carry resource names, activity notes, free-text fields and the name of the
  user who exported them. Files are published exactly as uploaded and **nothing is removed
  from them**.
- If you are named in a file someone else uploaded, you can ask for it to be removed:
  [report it](/report).
- **The remedy is removal of the revision, not editing of the file.** There is no way to
  take one name out and keep the programme. If the name appears across a series of
  revisions, which is usual, the whole series and everything forked from it is removed.
- Download URLs carry a header asking search engines not to index or archive them, and the
  file host tells crawlers to stay out. That is a request to well-behaved crawlers; it is
  not a barrier, and anyone can fetch a published file.

### 8.7 Reporting a programme

Anyone can report, with no account (003). What the form stores: what you reported, the name
as it appears if that is what you are reporting, and your contact details.

**Your contact details are deleted 90 days after the case is closed.** *(017 — the section
that ticket said "goes in the privacy policy explicitly".)* The rest of the report, minus
your contact details, is kept as the record of a decision that was made.

### 8.8 Deleting your account

The order, and the consequences, stated before anyone gets there (003 required this):

1. This site's rows go first: the account record is deleted, bookmarks are deleted, votes
   are kept but unlinked from you, and your Handle is retired.
2. Then Clerk deletes the Google identity.

Uploaded programmes **stay published**, credited to the Handle, which by then belongs to
nobody. To remove them, withdraw them first and then delete the account — two acts, both
available, in that order.

### 8.9 Cookies, analytics and third parties

**Decided here, because the section cannot be written without deciding it:**

- **No analytics of any kind in v1.** No Google Analytics, no Vercel Web Analytics, no
  Plausible, no pixel, no beacon.
- **No advertising, no trackers, no third-party embeds, no fonts loaded from anyone else.**
- Cookies: the **Clerk session cookie only**, set when you sign in, and strictly necessary
  for staying signed in. Signed-out visitors get no cookie from this site at all.
- The report form (`/report`) uses **Cloudflare Turnstile** to block automated submissions.
  It runs in your browser when you submit that one form.
- Files are served through **Cloudflare**, which processes the request in order to deliver
  it.

The consequence, worth stating because it is a page nobody has to build: **there is no
cookie banner and no consent management**, because there is nothing set that needs consent.
Adding analytics later reopens this and costs a new policy version.

### 8.10 Where your data is held, and who else touches it

Named rather than glossed (003). One list, one sentence each: **Clerk** (identity),
**Neon** (database), **Cloudflare R2 and CDN** (files and delivery), **Vercel** (hosting),
**Google** (sign-in), **GitHub** (source code, and the scheduled job that mails the operator
when something breaks). No data is sold or shared with anyone else.

### 8.11 Your rights

> **LAWYER — flagged by 003, unchanged.** Whether the CC-BY grant survives a UK GDPR erasure
> request in the form described in §8.5 and §8.8. The position taken is that the account data
> is erased and the pseudonymous credit that remains is not personal data; it is defensible
> and has not been reviewed.

> **LAWYER — flagged by 013, unchanged.** Whether an uploader warranty plus an advisory
> pre-publish panel is a lawful basis for publishing third-party personal data, and whether
> this site is controller or joint controller at publication. §8.6 is written to the position
> taken, not to a reviewed answer.

The section itself states, in plain words: how to ask what is held about you, how to ask for
it to be deleted, and that both go to the report page because there is no other channel.

### 8.12 Changes to this policy

Every version stays published at its own URL. Changes ship as a new numbered version
alongside a new version of the terms, and the version you accepted at each upload is
recorded on that upload. Nothing is edited in place.

---

## 9. `/terms` — structure and prose

Thirteen sections. Everything operative was settled by 003 as amended; nothing new is
decided here. Where legal phrasing matters rather than substance, the substance is stated
and the phrasing is left to the drafter.

Header block:

> **Terms of use — version 1.** Last changed: *(commit date)*. Earlier versions stay
> published at `/terms/v1`, `/terms/v2`, …
> If you have published a programme here, the version you accepted is recorded against that
> upload and linked from it.

### 9.1 What this site is, and who runs it

A public library of Primavera P6 programmes, run by one person, free to use, best effort, no
service level (003). Using it means accepting these terms.

### 9.2 Your account

Google sign-in only. One account per person. You are responsible for what is published from
your account. The operator may suspend an account, and may remove any programme, at their
discretion.

### 9.3 What you promise when you upload

The long form of 003's single checkbox, **as hardened by 013**. Three claims, and the
checkbox label is the short form of the same three:

1. You own the programme, or you have permission from whoever does to publish it.
2. It contains no confidential or commercially sensitive third-party information — and you
   understand that **the file may name people, that it is published exactly as uploaded, and
   that nothing is stripped from it.**
3. You licence it to everyone under CC-BY 4.0, **irrevocably**.

Stated here too, because it is the sentence that matters when someone changes their mind:
the licence cannot be withdrawn. You may withdraw the programme; you cannot withdraw the
licence from copies and forks already taken.

Every upload re-asserts all three. The version of these terms you accepted is recorded
against that upload.

### 9.4 The licence you grant

CC-BY 4.0, site-wide, with no per-upload choice. It covers the file itself and everything
the site computes from it. The site takes no separate licence of its own beyond what CC-BY
already permits (003 — deliberately, so there is no "you grant us a worldwide royalty-free
licence" clause to argue about).

### 9.5 Attribution, forks and revisions

- The site renders attribution from the lineage it holds; the `.xer` file is never modified,
  because the format has no comment mechanism and modifying it would break round-tripping.
- Forking on the site satisfies CC-BY automatically: the fork page renders the full ancestry
  chain, the licence, and the change note the uploader is required to write.
- Reusing a programme off-site is your obligation, as with any CC-BY work. Every programme
  page carries the citation line to copy.
- Revisions of a programme may be uploaded by its owner only. Anyone else forks.

### 9.6 Withdrawing your own programme

Self-service, at the programme, at either granularity (one revision or the series). The page
stays at its URL showing that it was withdrawn by its uploader; the file is deleted; the
title and Handle stay visible; **forks are untouched**, because the licence was validly
granted when they were taken.

### 9.7 Reports and removals

- Anyone may report a programme, with no account.
- Removals for rights, confidentiality or personal-data reasons **cascade to everything
  forked from the removed content**, because the licence was never validly granted. Owners
  of those forks are not accused of anything, and their pages say so.
- Files removed on this basis are held for 30 days before destruction, so a mistake can be
  undone.
- One person adjudicates, best effort, **no service level is promised**. Appeal is to the
  same person.
- Bytes are deleted; rows are not — a removed programme keeps its page and its place in the
  ancestry chain.

### 9.8 Acceptable use

Do not upload what you have no right to publish. Do not upload confidential or personal
information that is not yours to publish. Do not create accounts to inflate votes. Do not
attempt to overload the site. The operator may remove anything and may void votes, by hand,
without notice.

### 9.9 No warranty

**The map's standing decision, in its formal home**, and the one clause that must not be
softened in drafting:

- The site and everything on it is provided **as is** and **as available**, with no warranty
  of any kind.
- No warranty that any programme is accurate, complete, current, lawfully published, or fit
  for any purpose — including yours.
- No warranty that the site works, stays up, or keeps anything.
- Computed values, including DCMA checks, float, the longest path and every chart, are
  **computed and reported, not endorsed**. Some are documented approximations.
- Nothing on this site is professional advice and nothing here is checked by anyone.

> **Drafting note.** This is a **service-level** disclaimer and it is *separate from* the
> Apache-2.0 disclaimer in the repository. Apache §7 and §8 disclaim the source code;
> this clause disclaims the hosted service and the content on it. Both exist; neither
> substitutes for the other (013).

### 9.10 Limits on liability

> **LAWYER.** The substance intended: liability limited to the maximum extent the law allows,
> nothing excluded that cannot lawfully be excluded, and no attempt to disclaim statutory
> duties — an erasure request still gets a removal (013). Phrasing, and what a UK/EU consumer
> context permits, is not settled here.

### 9.11 The site's code

Apache-2.0. The repository is public and contributions come in under the same licence, so
there is no contributor agreement to sign. Link to the repo and to the licence.

### 9.12 Changes to these terms

New numbered versions; old versions stay published; **an upload stays pinned to the version
that was accepted when it was made.** Continuing to use the site means accepting the current
version.

### 9.13 Governing law

> **LAWYER — flagged by 003, unchanged.** Whether this site qualifies for hosting-provider
> liability protection in the UK/EU, and whether publishing a formal notice-and-takedown
> procedure is a condition of keeping it. §9.7 is written as a procedure partly in case the
> answer is yes; whether it is *the* procedure a statute requires is not established.

Jurisdiction and governing law are stated in the final text and are part of the same
question.

---

## 10. Deliberately absent

- **No `/faq`, `/pricing`, `/contact`, `/docs`, `/blog`, `/changelog`, `/roadmap`.** Six
  pages that would each need maintaining and that `/about` and `/report` cover between them.
- **No cookie banner, no consent manager.** §8.9.
- **No newsletter, no social accounts, no OG image beyond whatever the discoverability work
  decides.** A social presence is a channel that has to be answered.
- **No logo or wordmark image.** 027 declined to upload a logo to Google for the same reason:
  none exists, and the field is optional.
- **No `/status` page.** Nothing measures uptime and a status page that is hand-edited is a
  guarantee wearing a different word.
- **No version picker widget on `/terms`.** The header block links back to the index of
  versions; a dropdown is a client component on a page that has no JavaScript at all.
- **No acceptance checkbox for the privacy policy.** It is a disclosure, not an agreement.
  003's one checkbox stays the only one.
