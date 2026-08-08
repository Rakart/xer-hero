---
id: 017
title: What tooling does the operator need to run a takedown?
type: grilling
status: closed
assignee: carlo
blocked_by: [010]
---

## Question

One person adjudicates every takedown, best effort, no SLA
([Licensing, attribution and takedown](003-licensing-attribution-takedown.md)). What
do they actually operate?

Raised by [Domain model and schema](005-domain-model-and-schema.md), which made the
cost concrete: a Class B takedown is not one `update`. It is a subtree walk over fork
edges, a tombstone write per affected Revision, a `current_revision_id` repoint and a
possible Programme-level tombstone per affected Programme, and N blob prefix deletes —
with the blob deletes **irreversible** and the row writes not. Done by hand at 2am
against a complaint email, that is a correctness hazard, and the failure mode is either
leaked content that should be gone or destroyed content that should not be.

Settle:

- **The surface.** An admin route in the app, a CLI against the production database, a
  set of SQL scripts, or nothing beyond `psql` in v1. Depends on where the app runs —
  [Stack, hosting and auth provider](010-stack-hosting-auth.md).
- **Preview before commit.** Class B cascade defaults broad and may be narrowed to
  named Revisions. Does the operator see the affected set — how many Programmes, whose,
  how many blobs — before anything is written?
- **Order of operations, and what happens on a partial failure.** Rows are recoverable,
  bytes are not. Does the blob delete run last, and is a half-applied cascade detectable
  and resumable?
- **The report intake.** 003 fixed "public email address plus a form" and no account
  required. Does the form write anything, or is it a mailbox? Is there a record of the
  adjudication, and does the tombstone page reference it?
- **Class A self-service.** Withdrawal is the uploader's own act on their own
  programme. Is it a button on their page — no operator involved — or does it queue for
  the same manual path?
- **Reversal.** Class B decided wrongly. Rows survive, so status is reversible, but the
  bytes are gone and 006's recompute path needs the raw `.xer`. Is a mistaken takedown
  recoverable at all, and if not, does that change the order of operations above?

Not a moderation-policy ticket — 003 settled the policy. This is the operating
mechanism for it.

### Extended by [Personal data in published .xer files](013-personal-data-in-published-files.md)

013 sends **third-party personal-data requests down Class B unchanged** — no new class,
no new field — so this ticket now owns their operating mechanism too. Two consequences
sharpen the questions above rather than adding new ones:

- **The requester is not a user.** A person named in `rsrc_name` of someone else's
  upload has no account, no programme and no relationship to the site. The intake
  question ("public email plus a form") must work for someone who cannot be
  authenticated and may not know which file names them — plausibly the operator has to
  *find* the revisions from a name.
- **Scope is almost never one revision.** A resource dictionary is stable across a
  series (013 measured median 15 rows per file, near-identical across Fixture A's
  two-year monthly run), so a single request typically means **the whole series and
  every fork of it**. The tooling's default selection should assume series-wide, and the
  order-of-operations and resumability questions above should be sized against that
  rather than against a single tombstone.
- **A softener exists and needs a mechanism**: the owner may upload a cleaned revision
  and the operator tombstones only the tainted ones. Whether that is an operator flow, a
  message to the owner, or nothing at all is this ticket's call.

## Resolution

**A repo CLI with a plan/apply split — and takedown has four steps, not three.**

The ticket's premise held: a Class B cascade by hand is a correctness hazard. What it did
not anticipate is that the hazard is not only in the *rows*. Two closed decisions, both
correct in isolation, combine into a defect: 004 serves every blob under
`Cache-Control: public, max-age=31536000, immutable`, and 003 promises **bytes
hard-delete**. Against a year-long immutable edge cache, deleting the R2 object does not
make that promise true — the file stays downloadable from a public, unsigned URL for up to
twelve months, and 013 established `original.xer.gz` is the sole carrier of personal data.
**Purge is a step, and nobody had counted it.**

### The surface

**A CLI in the repo, run from the operator's machine against production.** Not an admin
route, not `psql`, not SQL scripts.

The deciding argument is a capability, not a preference. 010 chose `drizzle-orm/neon-http`,
which is **batched and non-interactive only** — so an in-app admin route *structurally
cannot* wrap a cascade in one transaction, and would execute N independent batches with no
rollback. A laptop has no Function runtime constraint, so the CLI connects over an
interactive session and the entire row half commits or rolls back whole. The tool that
needs a transaction most is the one place in this system that can have one.

Three consequences fall out rather than being chosen:

- **The most destructive operation in the system never has a URL.** No admin route to
  protect, no Clerk role to get wrong, nothing that leaks when a check regresses.
- **Hobby is one seat** (010). An in-app admin UI would be built for a user base of
  exactly one, who already has a terminal.
- Bare `psql` plus a runbook was rejected outright: the cascade is a recursive CTE plus
  correlated writes plus N R2 prefix deletes plus a purge API, and `psql` can do the first
  third. The operator would be hand-copying uuids into an object-store command at 2am,
  which is precisely the hazard 005 raised this ticket for.

Accepted cost, stated rather than solved: **no takedown from a phone.** The operator must
be at a machine holding production credentials. Under 003's best-effort, no-SLA posture
that is the honest trade, not a gap.

Credentials live in a local `.env`, never in the repo and never in Vercel: a Neon
connection string, an R2 token with delete on the bucket, and a **purge-scoped** Cloudflare
API token.

### Order of operations

**Rows → bytes → purge.** In that order, and the order is load-bearing.

1. **Rows, in one interactive transaction.** Tombstone every affected Revision, repoint
   every `current_revision_id`, tombstone every Programme left with no live Revision, void
   the Class B programme's votes. Commits whole or rolls back whole.
2. **Bytes.** Copy `original.xer.gz` to quarantine (see *Reversal*), then delete the public
   objects, prefix by prefix, idempotently — a delete of a missing key is a success.
3. **Purge, verified.** Cloudflare single-file purge by URL, batched. Not fire-and-forget.

Rows first because rows are the reversible half, and bytes are never destroyed until the
recoverable work is known-committed. It also closes every path a user actually takes — the
page, the shelf, the download button — in one atomic commit; the residual exposure is
someone who already holds the direct blob URL, which is strictly smaller than the page
staying up.

Purge strictly *after* delete: purging a live origin only makes the edge refetch and
re-cache.

**The purge list is computable exactly**, which is 005's id-addressed blob keys paying an
unforeseen dividend — three deterministic URLs per Revision, no bucket listing. Content
addressing would have made this a search. It matters because purge-by-prefix and
purge-by-tag are Enterprise-only on Cloudflare; **purge by explicit URL is available on
every plan**, and explicit URLs are exactly what this schema can produce.

**Crash between steps is detectable and resumable**, on a consequence of 003's own rule.
Rows never delete, so a half-applied cascade leaves the fork tree structurally intact and
a tombstoned Revision with undeleted bytes is a plain SQL predicate.

### The TTL split

**`original.xer.gz` drops to `max-age=3600`, no `immutable`. Everything else keeps 004's
year.**

`activities.json.gz` and `derived.v{N}.json` are version-stamped, hot, and 013 proved them
PI-free by construction — nothing in them a takedown urgently unreaches. `original.xer.gz`
is the object 013 already singled out for different header treatment
(`X-Robots-Tag: noindex, noarchive`). Giving it a short TTL is not a second ad-hoc
exception; it makes **one coherent rule — the PI-bearing object is served under different
terms** — with two headers expressing it.

It costs nothing. 004 measured R2 egress as structurally free and found the CDN "cuts ops,
not bytes", so this buys extra Class B reads at $0.36/million on a file fetched only when
someone deliberately clicks Download. The shelf is Postgres; the detail page pulls
`activities.json`.

What it buys is a **failure mode downgrade**. Step 3 failing silently is the failure that
matters, because it looks like success. At a year, purge is the only thing between a rights
holder and their file. At an hour, purge is the fast path and the TTL is the backstop, and
*should not fail* replaces *must never fail* — the right risk posture for one operator with
no SLA.

Not one day: a confidential programme still downloadable a day after the operator confirmed
removal is what generates the second, angrier email. Not sixty seconds: purge already covers
that window.

### Plan and apply

`takedown plan` writes a JSON plan; `takedown apply` consumes it. The plan file is the
preview, the ledger and the resume point — one artifact answering three of this ticket's
bullets.

**Apply re-derives the affected set, diffs it against the plan, and aborts on any
difference**, printing the diff. Pinning alone leaks — a fork taken in the plan→apply window
survives, and under 005 a fork's first Revision *is* a copy of the tainted bytes.
Re-deriving alone means the operator authorised set X and the tool destroyed set Y, which
for an irreversible delete defeats the point of a preview. Diff-and-refuse gives both: the
executed set is always the reviewed set, and a moved graph is surfaced rather than absorbed.

It is cheap because it almost never fires — one operator, and creating a fork means
uploading a multi-megabyte file into a minutes-long window.

**It resumes for free.** The diff compares *membership*, not status, and rows never delete,
so a partially-applied cascade re-derives to the same set with some of it already
tombstoned. `apply --resume` skips the committed row work and finishes bytes and purges from
the recorded keys.

Rejected: a `pending_takedown` flag freezing the subtree against new forks — a column plus
an upload-path predicate to defend a window diff-and-refuse already covers.

**What the plan carries.** Case reference, class, selection, and a headline led by the
number the operator should hesitate over: **N Revisions across M Programmes, of which K
belong to other people.** 013 established scope is rarely one revision — a resource
dictionary is stable across a two-year series — so the default selection is series-wide and
the summary must show what that costs. Then the per-Programme breakdown, every blob key,
every purge URL.

**Plan files stay local and are never committed.** They name programmes, owners and,
for a PI case, the searched name — a durable store of who complained about what beyond the
report row is exactly what *Finding a name* below refuses to build.

### Class A is self-service

**A button on the owner's own programme. No operator involved.**

003 made withdrawal the uploader's own act and the CC-BY grant irrevocable, so there is
**nothing to adjudicate** — the outcome is identical whoever presses it. Queueing it behind
one operator with no SLA makes the one class with zero legal ambiguity also the slowest.

It is also where the constraint that forced the CLI does not bite: Class A touches one
Programme and does not cascade (003: forks untouched), so there is no recursive CTE and no
correlated multi-Programme write. The row work is a **bounded single-Programme batch**,
which `neon-http` handles.

**Both granularities.** Whole Programme, or a single Revision — 003 fixed the revision as
the unit, and an owner who posted the wrong file as rev 7 should not destroy a two-year
series to fix it. Withdrawing the current Revision repoints `current_revision_id` to the
newest survivor; withdrawing the last tombstones the Programme, which is 005's existing
invariant rather than new machinery.

Guard rails, since this is a non-expert firing an irreversible action with no plan/apply in
front of them: typed confirmation naming the programme, and the two facts nobody expects
stated plainly — **the bytes are destroyed permanently**, and **existing forks stay
published**.

Accepted risk: a compromised account can mass-withdraw. Same exposure as any
owner-destructive action; Clerk holds auth and there is no undo by design.

### The sweep becomes the reconciler

011's sweep already runs every 15 minutes from a GitHub Actions schedule with a database
connection, and already reaps abandoned uploads. It takes two more queries and pays for
itself three times:

- **Incomplete tombstones** — `status = 'tombstoned' and bytes_deleted_at is null` → finish
  the delete and purge. This makes both the Class A button and a crashed CLI `apply`
  self-healing, and demotes `--resume` from a requirement to a convenience.
- **Expired quarantine** — `removal_class = 'B' and removed_at < now() - interval '30 days'
  and quarantine_purged_at is null` → destroy the quarantined bytes.

### Reversal, quarantine, and a defect in 011

The ticket asked whether a wrongly-decided Class B is recoverable. As designed it was not,
and that is dangerous for a reason no closed ticket names:

**Nothing authenticates a complainant.** 003 fixed *anyone can report, no account required*
— correctly, since a rights holder will not sign in with Google to complain. But it means an
unauthenticated stranger can trigger the permanent destruction of someone else's published
programme **and every fork of it**, adjudicated by one tired person. That is a griefing
vector, and for a solo operator the only affordable defence is an undo window.

**Class B bytes go to quarantine for 30 days, then are destroyed.** A private prefix, no
public access, not served, not CDN-fronted. Step 2 copies before it deletes.

**Only `original.xer.gz` is quarantined.** 006 recomputes `derived.json` and
`activities.json` lazily from the raw file, so the other two objects are destroyed
immediately and rebuilt on reversal. That is a **third special property landing on the same
single object** — `noindex`, 1-hour TTL, quarantined — which keeps it one rule rather than
three exceptions.

Cost is nothing against 004's sub-$1/month blob bill. **After 30 days the honest answer is
no: a mistaken Class B is not recoverable**, stated plainly rather than implied.

**The defect this exposed.** 011 hard-rejects an upload whose hash matches a *tombstoned*
Revision — right for Class B, where it makes takedown self-enforcing against the exact bytes.
But it applies to both classes, so **an owner who withdraws their own programme by mistake
can never re-upload that file.** Class A is voluntary, the owner holds their own copy, and a
permanent ban on those bytes is not what 011 was defending against.

**The reject is scoped to `removal_class = 'B'`.** Class A tombstones stop blocking
re-upload — which is also why Class A needs no quarantine. Class B's block stays permanent:
`content_hash` sits on a row, rows never delete, so it outlives the 30-day window and
takedown-evasion stays shut.

### The report intake

003 promised "public email address plus a form". 010 then removed email from the system
entirely — the app stores no address and **cannot send mail** — so a form that emails the
operator is not buildable without adding a vendor, and a mailbox alone leaves the
adjudication in an inbox linked to nothing.

**The form writes a `takedown_report` row, and that row is the system of record. The mailbox
stays published as a second channel; anything arriving by mail is transcribed into a row by
the operator before adjudication.** No mail is sent by the app, so nothing depends on
infrastructure the stack does not have.

Three jobs only the row can do:

1. **The plan file needs a case reference to point at.** Without a row there is no
   adjudication record at all, which 003 explicitly asked about.
2. **It is where the search problem gets structured input.** `name_as_it_appears` is a
   field, and that field is what `takedown find` consumes. A free-text email gives the
   operator a paragraph to interpret at 2am.
3. It carries the disposition — including the softener's hold state — with no flow attached.

Spam control on an unauthenticated public write: **Cloudflare Turnstile** — free, and
Cloudflare is already in the estate for the CDN and purge — plus a per-IP rate limit. No
account, per 003.

**Notification is handed to [Operating and observing ingest](019-ingest-observability.md),
not invented here.** A new report row is the same problem as a `failed` ingest row:
something durable a single operator must be told about, with no paging infrastructure and a
one-hour log window. A second notification path would be the mistake.

**Reporter contact is stored, and purged 90 days after the case closes.** This reintroduces
an email address into Postgres, which was 010's cleanest win, so it needs answering rather
than ignoring: 010's argument was about *user* email persisting after account deletion,
where the user has an erasure right the site promised to honour. A complainant's contact is
correspondence deliberately retained as evidence of an adjudication — a different thing with
a different justification, and a different retention. The rest of the row is kept forever;
the contact field is not. It goes in the privacy policy explicitly.

### Tombstone copy

**Three lines, and the third exists so a blameless owner is never rendered as accused.**

- **Class A** — 003's *withdrawn by uploader*, unchanged. The uploader's own act, safe to
  attribute.
- **Class B, complained-about** — *removed following a rights or personal-data complaint*,
  and **no case reference and no complainant**. Publishing the case id invites correlation
  across takedowns; naming the complainant in a personal-data complaint would republish the
  exact data the takedown was for. The case id lives operator-side, in the row and the plan.
- **Class B, cascaded fork** — *removed because a programme it was forked from was removed
  following a complaint*, ancestry link intact. 005 made the cascade **unconditional** below
  a tainted Fork, deliberately, so the design knowingly destroys innocent people's published
  work; giving those owners the complained-about line would read as an accusation against
  someone who is not accused. The chain already renders (003) and points at the actual
  reason.

### The blameless fork owner is not notified in v1

They learn by visiting. **There is no operator correspondence anywhere in the Class B
flow** — a deliberate call, because a one-operator site that owes manual emails on every
cascade will not send them.

That leaves a real gap, named rather than papered over. The precedent is 011: when 010
removed email, it solved the same problem with an **in-app row** — a `failed` upload lives 24
hours so the uploader can learn why. A cascaded tombstone with its reason wants exactly that
surface, and that surface is still fog. It is recorded as a **demand on the map's
"signed-in user's own space" patch**, which 016 already opened for the owner-only bookmarks
tab and voting record and which 011's `failed` rows also want. Three tenants now, so the
patch graduates with a concrete requirement instead of a vague one.

### The softener

**Operator correspondence, not a product flow. One status value.**

013 allows the owner to upload a cleaned revision so only the tainted ones are tombstoned.
Everything needed already exists: 005 lets the operator narrow the cascade to named
Revisions, so `takedown plan --revisions` *is* the tooling, and `takedown find` scoped to one
programme is how the operator verifies the new revision is actually clean. Owner contact is
the path 003 and 010 already fixed — a **Clerk lookup**, mailed by hand from the intake
mailbox, at the operator's discretion in the rare case they choose to offer it.

Deliberately **not** built: an in-app "your programme has a complaint" notice. That
automatically discloses an *unadjudicated* complaint to the person complained about. Whether
to tip off an owner — who might be the problem — is a per-case judgement, and keeping it
manual is what keeps it a judgement. This is the one place operator email survives, and it
is optional rather than owed.

Cost: `takedown_report.status` runs `open | awaiting_owner | actioned | rejected`.

### Finding a name

013 handed this ticket a search problem: the requester has no account, no programme, and may
not know which files name them.

There is nothing to search. 013's best finding was that PI is confined to
`original.xer.gz` **by construction**, because 006 and 008 had already cut every resource,
memo and UDF field from `derived.json` and `activities.json` for payload reasons. Postgres
holds no name and no derived object does either.

**The tempting fix is refused outright.** Indexing `rsrc_name` into Postgres so the operator
can query it would build **a searchable index of every person named across the entire
corpus** — a far larger personal-data liability than the files themselves, needing its own
lawful basis, and the standing PI apparatus 013 refused when it refused screening. The
absence of that index is a privacy property worth protecting.

**`takedown find "<name>"` is an on-demand corpus scan. No index, nothing persisted.**

It fetches each `original.xer.gz`, decompresses, and **greps the whole plain-text file
case-insensitively** — no parsing, no field list to drift out of sync with Oracle's schema,
and it catches a name wherever it lands including memos and the UDF free text 013 measured.
It parses only to *render* a hit: table, field, matched value, programme slug, rev_no.
Output feeds straight into `takedown plan`.

Scale is fine and improves under constraints already fixed. R2 egress is structurally free
(004), so a full scan costs only time — ~30k objects at the 10k-programme ceiling, minutes
on a parallel fetch, and the launch corpus is authored templates plus a handful of real
uploads. Optional filters (programme, uploader, sector, date range) narrow it when the
complainant knows something, which they usually do.

### The tool

```
takedown find "<name>" [--programme|--uploader|--sector|--since]
takedown plan --case <id> --class B --programme <slug> [--revisions 4,5,6] -o plan.json
takedown apply plan.json [--resume]
takedown reverse <case-id>          # within the 30-day quarantine window
```

`reverse` un-tombstones the rows, restores `original.xer.gz` from quarantine, repoints
`current_revision_id`, and leaves the derived objects absent — 006 rebuilds them on open.

### Schema this fixes

```sql
create table takedown_report (
  id                  uuid primary key,      -- the case reference
  created_at          timestamptz not null,
  reporter_contact    text,                  -- purged 90 days after close
  contact_purged_at   timestamptz,
  subject_ref         text,                  -- URL or slug, as given
  name_as_it_appears  text,                  -- PI cases; feeds `takedown find`
  reported_reason     text not null,
  class               char(1),               -- A | B, operator-assigned, not reporter-declared
  status              text not null,         -- open | awaiting_owner | actioned | rejected
  resolution_note     text,
  plan_ref            text,                  -- identifies the applied plan
  actioned_at         timestamptz
);

alter table revision add column bytes_deleted_at      timestamptz;  -- null = reconciler picks it up
alter table revision add column quarantine_purged_at  timestamptz;  -- null = quarantine still holds bytes
```

Two columns on `revision`, no more. **Quarantine expiry needs no column** — it is
`removed_at + interval '30 days'` where `removal_class = 'B'`, and `removed_at` already
exists from 003. `bytes_deleted_at` means *public bytes destroyed and purge confirmed*,
which is what makes the reconciler a pure SQL predicate rather than an R2 listing.

### What this hands to other tickets

- **[Operating and observing ingest](019-ingest-observability.md)** — inherits a second row
  type to surface. Whatever channel it picks for `failed` ingests must also carry new
  `takedown_report` rows; they have the same shape, the same operator and the same 1-hour
  log constraint.
- **[The derived.json contract](006-derived-json-contract.md)** — one small demand: the lazy
  recompute path must treat a **missing** `derived.v{N}.json` as stale rather than as an
  error, because reversal deliberately leaves it absent.
- **[Credit, upvotes and the contributor leaderboard](016-credit-upvotes-leaderboard.md)** —
  no change needed, but worth recording that 003's "Class B voids its votes" is now close to
  a no-op: 016 moved standing off Programmes entirely, and a tombstoned Programme is off the
  shelf anyway. It is executed in step 1 for consistency with 003, not because it defends
  anything. The eligibility gate is a live count and needs no write.
- Legal pages — the privacy policy gains the reporter-contact retention rule; the ToS gains
  the 30-day Class B quarantine. Both are build work under 003's rule that drafting is not a
  decision.

### Flagged

Holding erasure-requested content 30 days in a private store before destruction is ordinary
operational practice, and is **recorded as a note rather than a fourth lawyer question** —
distinct from 003's two and 013's third, which concern lawful basis rather than retention
mechanics.
