---
id: 024
title: Verifying the production-only edges
type: grilling
status: closed
assignee: carlo
blocked_by: [019]
---

## Question

What verifies the behaviours that exist only in production, given the local stack
reproduces none of them?

Surfaced by [Local development and contributor onboarding](018-local-dev-and-onboarding.md),
which built a development environment out of endpoint swaps — MinIO for R2, a local
Neon HTTP proxy for Neon — and so reproduces the S3 API and the Neon wire protocol
faithfully. **It reproduces no part of Cloudflare's CDN.** Four decisions from closed
tickets live entirely in that gap:

- **`X-Robots-Tag: noindex, noarchive` on `original.xer.gz`.** 013 made this the whole
  of its mitigation for personal data in published files — public and cacheable but not
  indexable. It is one PUT-time header, set once, invisible everywhere, and wrong
  silently. MinIO will happily accept the header and nothing checks it is served.
- **The 1-hour TTL on `original.xer.gz`.** 017 dropped it from 004's year-long
  immutable cache specifically to make 003's "bytes hard-delete" true. If the object
  ships with the wrong `Cache-Control`, takedown is broken in a way that only becomes
  visible during a takedown.
- **The verified CDN purge.** 017 made purge step 3 of 4 and deliberately softened
  *purge must never fail* to *purge should not fail*, which is the right posture for one
  operator — but it assumes somebody verifies. Nothing does.
- **R2 bucket CORS.** 011's upload path is a presigned PUT from the browser. CORS is a
  bucket rule in both MinIO and R2, so it is exercised locally, but the rules are
  configured per-bucket and per-origin and the production rule is set by hand.

The shape of the answer is genuinely open. Candidates, none of them obviously right:

- **A post-deploy smoke check** that fetches a known object and asserts the headers it
  came back with. Cheap, but needs a stable object that is safe to keep public forever.
- **A maintainer checklist** run at provisioning time and after any bucket change.
  Zero infrastructure, and exactly the kind of thing that is done once and never again.
- **Extending 017's CLI** with a `verify` verb, since it already runs from a laptop
  against production R2 and already has to confirm a purge landed.
- **Folding it into whatever [Operating and observing ingest](019-ingest-observability.md)
  decides**, which is why this is blocked on it — the mechanism that tells the operator
  ingest broke is plausibly the mechanism that tells them a header is wrong.

Settle:

- **Is a wrong header a deploy-blocking failure or an alert?** 013's exposure is real
  but slow; 017's TTL is dormant until a takedown, at which point it is urgent.
- **What is the check's subject?** A dedicated canary object, the most recent real
  upload, or a sample. A canary is stable and lies about nothing except the objects it
  is not.
- **Where does bucket configuration live?** These are dashboard-set rules today. Whether
  CORS, TTL and lifecycle become code (a provisioning script) or stay documented manual
  steps decides whether verification is a test or an audit.
- **Does the same mechanism cover Clerk and Vercel production config**, or is this
  strictly about R2 and the CDN? 010 named five Pro triggers that nothing currently
  watches for either.

### What [Operating and observing ingest](019-ingest-observability.md) hands this ticket

019 closed and **gave this ticket a mechanism while deliberately keeping its questions open.**

What now exists, at zero marginal cost to a fifth rule:

- **A rule engine in `/api/sweep`** — each rule is a typed function returning a breach or not;
  the endpoint writes the verdict to `sweep_run` and returns `{ok, breaches[]}`.
- **A push channel** — the GitHub Actions run exits non-zero on breach, and GitHub mails the
  repo owner free. This is the estate's only outbound mail path.
- **Suppression** — `alarm_state` gives every rule "red on transition, then daily", so a rule
  watching a config value that is wrong for a week does not send seven hundred mails.
- **A read-only operator dashboard** at `/ops` to render the state, and 017's CLI as the place
  any *action* lives.
- **Rule 4 as a worked precedent** — `reconciler_stuck` watches for a tombstone whose bytes
  were never destroyed, which is the same species of problem as a wrong `Cache-Control`: a
  destructive operation silently incomplete.

What 019 explicitly declined to decide, and why, so this ticket does not treat it as settled:
the **subject** (canary vs real object vs sample), whether a wrong header is **deploy-blocking
or an alert**, and whether **bucket config becomes code**. 019's stated reason is that a
15-minute poll is the wrong instrument for a value that changes twice a year — so *inheriting
the mechanism is not the same as being the mechanism*, and the post-deploy smoke check and the
CLI `verify` verb this ticket already lists remain live options. The honest comparison is now
between three concrete things rather than between a vague idea and nothing.

One extra input: 019 established that **Actions logs on a public repo are world-readable**, so
whatever this ticket builds prints assertions and not object URLs or response bodies.

## Resolution

**Three of the four gaps are smaller than 018 thought, the fourth was already closed by a
rule nobody connected to it, and the canary is not an object — it is a run of the production
upload path.** What actually gets built is one sweep rule, one bucket document, two CLI
verbs, one seeded row and a sentence defining the word "verified". $0/month, no new account,
no Pro trigger.

Full working — the assertion list, the bucket document, the provisioning checklist and the
implementation hazards — is
[in the asset](assets/production-edge-verification.md).

### The premise inverted: these are not four production-only behaviours

018 filed this as *the local stack reproduces the S3 API and the Neon wire and none of the
CDN*, and listed four things living in that gap. Taken one at a time against what 018 itself
built, the gap is a different shape:

- **CORS is not in the gap at all.** 018's own §2 says it: *"the upload path is exercised in
  full locally, including CORS, because CORS is a bucket rule in both."* MinIO answers
  preflight the way R2 does. What was production-only was never the behaviour, it was the
  **document** — the live R2 rule is hand-set and the local one is hand-set and nothing has
  ever compared them, because there was nothing to compare them *to*.
- **Half of `X-Robots-Tag` and half of the TTL are not in the gap either.** Both are set at
  PUT, and MinIO stores and returns object metadata exactly as S3 does. A PUT through the
  product presign into MinIO followed by a HEAD proves our code signed the headers and the
  object carries them. What MinIO cannot vouch for is whether *R2* stores a signed
  `x-robots-tag`, and whether *the edge* serves it back.
- **The verified purge was already covered, twice, and nobody joined it up.** 017 wrote
  "Purge, verified. Not fire-and-forget", and defined `bytes_deleted_at` as *public bytes
  destroyed and purge confirmed*. 019 then wrote rule 4, which goes red when a tombstoned
  revision has `bytes_deleted_at` null for an hour. So an unverified purge already alarms.
  The ticket's complaint — *it assumes somebody verifies; nothing does* — was true about a
  **definition**, not about a mechanism.

So the real production-only surface is three questions, not four: does R2 store the header,
does the edge serve it, and is the live bucket document the one we meant. And there is a
**fifth artefact 018's list missed**: 013 asked for `Disallow: /` in the blob host's
`robots.txt`, the blob host is the bucket, therefore `robots.txt` is *an object in the
bucket* — and no code path in this design has ever written it. It is the only one of the
five where the current state is not "possibly wrong" but "certainly absent".

### The shape: three instruments, because there are two causes and one credential

There are exactly two ways any of this goes wrong. **A commit** changes what the presign
signs. **A hand-edit in a vendor dashboard** changes what the bucket or the edge does, with
no commit anywhere and nothing to hang a check off. No single instrument catches both at the
right moment, so the honest answer is more than one — and each earns its place by catching
something the others structurally cannot.

**1. CI, on every PR including forks, no secrets** — 018's existing stack-up job grows an
`edge-contract` suite. It asserts what the presign signs, executes the presigned PUT into
MinIO, HEADs the object back, applies the bucket document to MinIO, and issues a real
`OPTIONS` preflight whose `Access-Control-Request-Headers` list is **derived from the
presign's own output rather than from a constant**. That last detail is what makes "the
presign changed" and "CORS is now wrong" a single test failure instead of two unrelated
incidents six weeks apart. This is the instrument that catches the only cause that has ever
been likely, and it catches it before merge, for nothing, on a fork PR with no env vars.

**2. A fifth sweep rule, `edge_drift`** — 019's engine, unchanged, plus a function. It mints
a canary through the production presign against real R2, HEADs the public blob-host URL,
asserts the headers the edge actually served, issues the preflight against the production
origin, and HEADs `robots.txt`. It catches the dashboard edit, the vendor behaviour change
and the missing object — everything with no commit behind it.

**3. Two verbs on 017's CLI — `ops bucket apply` and `ops bucket check`** — for the two
things that structurally require an R2 **admin** token, which must not live in the app or in
Actions. Applying the CORS document, and diffing the live one against the repo's.

### What the alternatives cost, since each was live

- **A post-deploy smoke check, alone.** Its one advantage is proximity to the deploy, and
  that advantage is bought more cheaply one step earlier by a PR check that runs *before*
  merge. Standing alone it also runs after production is live, and it answers nothing about
  a Cloudflare rule someone changed on a Tuesday. Rejected as a separate instrument;
  absorbed into the PR check.
- **A maintainer checklist, alone.** The ticket's own scepticism is correct — it is done
  once and never again. It does not die, though: it becomes the carrier for the Cloudflare
  steps that no API can reach (custom domain, Cache Rules, Transform Rules, token scopes),
  and **every line on it is mapped to a runtime assertion that fails if the step was skipped
  or later undone**. A checklist backed that way is not the failure mode the ticket feared.
- **A `verify` verb on 017's CLI, alone.** The checklist's flaw with more code: it runs when
  the operator remembers. It survives in exactly the shape that genuinely needs a laptop —
  the admin-token config diff — and nowhere else.
- **A fifth sweep rule, alone.** 019's objection was cadence: a 15-minute poll is the wrong
  instrument for a value that changes twice a year. That objection does not survive costing
  (below), but the objection that *does* stand is **lateness** — a poll always finds out
  after the thing shipped. Which is why it is not alone.

### Deploy-blocking or an alert: both, and "deploy-blocking" has a concrete address

The ticket names the asymmetry: 013's exposure is real but slow, 017's TTL is dormant until
a takedown and then urgent. That asymmetry is real and it is **not** resolved by making one
alarm louder than another. One operator, one channel, no severity levels — 019 already
settled that a mail says a threshold tripped and the page says what.

It is resolved by *where each half is caught*. The code half is caught before merge; the
production-state half is an alert; and **017's urgency is honoured at the moment it becomes
urgent** rather than by an alarm tier, because a `takedown apply` that cannot confirm its own
purge does not write `bytes_deleted_at` and therefore does not report success. The TTL being
wrong stops being a dormant fact the instant a takedown runs, which is exactly when it stops
being dormant anyway.

**Where a deploy-blocking check would run, concretely, since Vercel does not make it free.**
The build step runs before the deployment exists and cannot fetch its own URL, so it can
assert nothing about production headers. And on Hobby, production deploys on push to `main`
with nothing between "build succeeded" and "this is public" — there is no promotion gate to
hang a check on. Getting a real gate would need either Vercel's paid promotion controls, or
abandoning Git-integration deploys for a CI-driven `vercel deploy --prebuilt --prod` behind
a check. Both are a new deployment model bought to defend a header.

So **"deploy-blocking" here means a required GitHub status check on `main`** — branch
protection, free on a public repo, on a CI job 018 already built half of. The residue is
stated rather than hidden: **the operator is the repo admin and can push past their own
branch protection.** This blocks a contributor and reminds the maintainer, which is the
truth about a one-person repo, and is a second reason the alert exists.

### The subject: a canary, and the canary is a verb

This is the ticket's sharpest question and its framing needs correcting before it can be
answered. The ticket says *a canary is stable and lies about nothing except the objects it is
not*. The dangerous lie is not spatial, it is **temporal**. 013's header and 017's TTL are
set per-PUT by our own upload code, so a canary uploaded once by hand is a monument to a
header that was correct on the day it was created — and it stays green through precisely the
failure it was built to catch. **A static canary is green in exactly the case that matters.**

The other two subjects fail differently:

- **The most recent real upload** proves today's code did the right thing on a real object,
  and has three problems. It is `original.xer.gz` — the one object 013 confined all PI to —
  so the checker must never GET it, and a design where the obvious implementation is `curl`
  into a world-readable Actions log is a design with a trap in it. It does not exist at
  launch, so the check has no subject on day one, which is precisely when provisioning is
  most likely to be wrong. And it detects *after* a real user's file was published wrong.
- **A sample** carries no more information than the most recent, because the headers come
  from one call site, so drift is total rather than per-object. Sampling defends against a
  randomness this design cannot produce.

**So: a canary, re-minted through the production presign on every sweep run.** The rule
calls the same presign module `/api/presign` calls, for a reserved uuid, PUTs a ~1 KB
committed synthetic fixture the way the browser would, then HEADs the public blob-host URL.
It is never a monument, because it is remade by the code under test every fifteen minutes.

The argument that makes the PUT necessary rather than tidy is the three-layer split: **MinIO
can prove our code signs the header; only R2 can prove R2 stores it; only the CDN can prove
the edge serves it.** CI reaches the first layer. The canary PUT is the only thing that
reaches all three in one motion.

Details that keep it from costing anything: a **reserved uuid, not a reserved prefix**, so it
goes through the same key-construction code as every real revision and needs no branch in the
presign — a branch in the presign being the thing the canary exists to watch. **No Postgres
row**, so it is invisible to the shelf, to `/ops` counts, to 017's purge list (computed from
Revision rows) and to all four of 019's rules; nothing has to learn to ignore it. **Synthetic
bytes**, because the repo is public and names the uuid, so the URL is guessable by
construction. And it goes through the presign *module*, not the route, so there is no Clerk
session, no `upload_intent` row and no interaction with 011's presign rate limits.

The residual lie, stated: the canary proves the presign is correct *for the canary's key*,
and real objects differ from it only in the uuid. It also cannot exercise the browser — but a
browser that fails to send a signed header gets a SigV4 mismatch and a 403, which is loud, at
the uploader, immediately. **The uncovered case is the one that cannot be silent.**

### Bucket configuration becomes code — and the reason is 018's, not this ticket's

**CORS and `robots.txt` become a document in the repo, applied by `ops bucket apply` against
whatever `S3_ENDPOINT` it is pointed at. Everything Cloudflare-shaped stays a dashboard step
with a runtime assertion behind it.**

The deciding argument is that this is **not a cost paid for verification**. MinIO needs its
CORS set too, and 018 left that as an unwritten compose-time step. So the choice was never
"document versus code"; it was "one hand-written dashboard click-path for R2 *plus* one
hand-written `mc` incantation for MinIO" against "one JSON file applied twice by stock
`@aws-sdk/client-s3`". 018's finding that **the production clients are already
vendor-neutral** pays a second time here: `PutBucketCors` is the same client, the same
credentials shape, the same endpoint swap. Config-as-code is the cheaper option even before
anyone verifies anything.

That answers the ticket's *test or audit* question with a split rather than a side. **CORS
becomes a test**, because the document CI applies to MinIO is the document the operator
applies to R2, so the thing being verified in CI is the actual production artefact rather
than a resemblance. **The CDN settings stay an audit** — and the audit is automated as
*behaviour* assertions, never as config reads. We never ask Cloudflare what its rules are; we
observe what it serves. That is deliberate: reading Cloudflare's configuration would put a
Cloudflare API token in the app to watch a value, where observing output costs nothing and
needs no credential at all. The `OPTIONS` preflight in particular is unauthenticated — it is
literally what a browser sends.

Two things deliberately **not** in the document. The R2 token the app holds stays
object-read/write; bucket configuration needs admin, and that token lives only in the
operator's local `.env` (017's existing rule). And **there are no lifecycle rules, on
purpose** — every clock in this system is a Postgres predicate the sweep evaluates (011's
24 h reap, 017's 30-day quarantine, 019's windows), and a bucket lifecycle rule would be a
second scheduler with its own state, drifting silently against the rows. The bucket carries
no policy beyond CORS.

### Not Clerk, not Vercel, and 010's five triggers stay unwatched on purpose

**Strictly R2 and the CDN, plus the blob host's `robots.txt`.** The generalisation is
refused, and not for scope reasons:

- **A Pro trigger is a budget decision, not a correctness event.** Three of 010's five — log
  drains, a second seat, Actions schedule drift — are things the operator *chooses*; a
  decision does not need an alarm. Active CPU is the only one that arrives unbidden, and
  Vercel already mails the account owner on usage thresholds, so the estate's one outbound
  mail path is not the only mail path that exists for Vercel's own limits.
- **Watching them would cost a credential to learn something the vendor already tells us.** A
  Vercel API token in the app, to read a number Vercel emails about, is a strictly worse
  version of an existing channel.
- **Clerk's failure mode is loud.** Broken production Clerk config — dev keys in prod, a
  missing OAuth credential — means *nobody can sign in*, which surfaces in minutes without a
  rule. The one silent, dangerous Clerk-adjacent value is the `/ops` allowlist, and 019
  already made that one greppable line changed only by redeploy.
- **The failure modes are different in kind.** Everything in this ticket fails as *a file
  that should not be indexable being indexable* or *bytes that should be gone being
  downloadable*. A missed Pro trigger fails as a slower site or a full log. Only the first
  kind justifies standing machinery.

### The schema demand

**One row, in one migration.**

```sql
insert into alarm_state (rule) values ('edge_drift');
```

`sweep_run.breaches` is jsonb, so a fifth rule key needs nothing there. No new table, no new
column, nowhere else touched.

It is worth naming what this reveals about 019's design: **`alarm_state` is seeded by
migration, so every future rule is a migration.** That coupling was examined and kept.
Self-seeding on first evaluation would remove it, and was rejected because the seeded set is
an **inventory the dashboard renders**, not a log — under upsert-on-first-run, `/ops` shows a
rule only after it has successfully run once, which is the wrong behaviour in exactly the
case where you want to see it. A rule is a code change anyway; the insert rides the same PR.
Priced at one line every time a rule is added, which is roughly never.

### What runs where, and what it costs

| Where | What | Cadence | Credentials |
|---|---|---|---|
| **GitHub Actions CI** (018's job) | presign header assertions, PUT→HEAD round-trip through MinIO, `ops bucket apply` to MinIO, preflight assertions, `robots.txt` object, `rel="nofollow"` | every PR, incl. forks | **none** |
| **`/api/sweep` on Vercel** (019's engine) | rule `edge_drift` — mint the canary through the product presign into R2, HEAD the blob host, preflight the production origin, HEAD `robots.txt` | every 15 min | the app's existing object-scoped R2 token |
| **GitHub Actions schedule** | unchanged — POSTs the sweep, asserts one boolean, prints no URLs | every 15 min | existing bearer secret |
| **`/ops`** | renders `edge_drift` state from the last `sweep_run` verdict | pull | unchanged, read-only |
| **017's CLI, on the laptop** | `ops bucket apply` / `ops bucket check`; and `takedown apply` step 3 now writes `bytes_deleted_at` only on a confirmed non-200 from the purged URL | on change / per takedown | admin R2 token, purge token — local `.env` only |

**Cost: $0/month.** Actions minutes are free on a public repo. The canary is ~1 KB and is
overwritten, so storage is unmeasurable. The rule's writes are ~96 Class A operations a day
against R2's free 1M/month, and its reads ~8,600 Class B a month against 10M. No new hosted
account, no fifth vendor, no external uptime service, and **010's CPU trigger does not
fire** — the added work is network wait, which Vercel's Active CPU meter does not bill.

Two accepted costs, both named rather than engineered away. The HEAD reads the **edge**, so
it reads a response up to one TTL old; a fixed header takes up to an hour plus one run to go
green and a broken one the same to go red. That is what a one-hour TTL means, and
cache-busting the fetch would test the wrong layer. And the sweep now writes to R2, so an R2
outage fails it in a new way — though it already deleted blobs and reaped prefixes, so this
adds no new *class* of failure.

### What this hands to other tickets

- **[Operating and observing ingest](019-ingest-observability.md)** — a fifth rule,
  `edge_drift`, and a fifth seeded `alarm_state` row. Its deferred cadence objection is
  overturned on cost rather than argued with; its rule 4 turns out to have been the purge
  alarm all along.
- **[What tooling does the operator need to run a takedown?](017-operator-takedown-tooling.md)** —
  "verified purge" gets its definition (a plain GET of the purged URL returning non-200 is
  what writes `bytes_deleted_at`), and the CLI gains a fourth noun-space, `bucket`.
- **[Personal data in published .xer files](013-personal-data-in-published-files.md)** — its
  one-header mitigation gains a verifier at three layers, and its `robots.txt` requirement
  gains a writer, having had none.
- **[Local development and contributor onboarding](018-local-dev-and-onboarding.md)** — the
  gap it flagged is narrower than it stated, and its compose stack stops needing a hand-set
  MinIO CORS step.
- **[Upload and ingest pipeline](011-upload-ingest-pipeline.md)** — the presign's signed
  header set and the bucket's `AllowedHeaders` are now formally one decision; changing either
  alone is a CI failure.
- **Build work, not a decision:** `docs/operating.md` gains the provisioning checklist, ten
  steps, eight of them backed by an assertion.

### Flagged

- **`r2.dev` cannot be purged, so 017's step 3 requires a custom domain on a Cloudflare zone
  the operator controls — which requires a registered domain, which is the first line item in
  this effort that is not free.** ~$10/year is not a platform floor, but 004's "$0 until the
  database may no longer sleep" now has an asterisk, and the choice was never actually made.
  Filed as [The blob host and the site's domain](025-blob-host-and-domain.md).
- **Two provisioning steps cannot be asserted by anything**: branch protection on `main`, and
  GitHub Actions failure notifications. Both are GitHub account settings outside the estate.
  They join 019's existing flag of the same shape rather than opening a new category.
- **The canary cannot exercise the browser.** Covered above — that failure is a 403 at the
  uploader — but it means the one path a real upload takes that nothing else does is
  monitored only by users complaining.
- **AWS SDK v3's default request checksums** add a signed `x-amz-checksum-*` header that CORS
  must allow, and have broken R2 and MinIO presigned PUTs widely since early 2025. The
  document allows `x-amz-*` and CI derives its preflight list from the presign's own output,
  which is the concrete reason the CI half is not paranoia: **the set of signed headers is a
  dependency's decision as much as ours.**
