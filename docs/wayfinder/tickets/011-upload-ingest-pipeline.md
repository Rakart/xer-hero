---
id: 011
title: Upload and ingest pipeline
type: grilling
status: closed
assignee: carlo
blocked_by: [002, 004, 010]
---

## Question

What happens between "user picks a file" and "programme appears on the shelf"?

This is where the hybrid-ingest decision either works or produces a slow, flaky
upload nobody completes. Blocked on the format research and the cost model — the
first says how expensive parsing is, the second says how expensive storing the
output is.

Settle:

- **Synchronous or queued.** Parse in the request and show the result immediately,
  or accept the file and process in the background with a status page? Decide
  against the real numbers: how long does parsing the largest fixture take, and
  does that fit inside a function invocation with headroom?
- **Where the file lands first.** Direct-to-blob upload from the browser with a
  presigned URL, or through the app server? Direct-to-blob avoids request body
  limits and server bandwidth but complicates validation.
- **Limits.** Maximum file size, maximum activity count. What the user is told
  when they exceed one — and whether a programme too big to ingest should be
  rejected or stored with reduced derived data.
- **Validation and rejection.** What makes a file unacceptable: not a `.xer`,
  corrupt, unsupported P6 version, zero activities, multi-project (see
  [How is a .xer file structured?](002-xer-file-structure.md)). Every rejection
  needs an error message a planner can act on.
- **Deduplication.** Someone uploads a file already on the site. Detect it — by
  content hash, or not at all? Interacts with the blob-key decision in
  [Domain model and schema](005-domain-model-and-schema.md).
- **The metadata step.** Sector, tags, description, licence. Before the parse,
  after it, or alongside? Anything the parser can pre-fill should be pre-filled —
  and the parse result may be the best prompt for the rest.
- **New revision versus new programme.** Uploading a later `.xer` of the same job
  should be a revision. Does the user say so, or does the app detect it from the
  P6 project id in the file?
- **Failure and retry.** A parse that dies halfway leaves a blob and no row.
  Decide the cleanup path, and whether a failed ingest is visible to the user or
  silently reaped.
- **Idempotency.** A double-submitted upload must not create two programmes.

### Already fixed by Licensing, attribution and takedown

[That ticket](003-licensing-attribution-takedown.md) settled part of the upload
flow — take these as given:

- **Deduplication is decided in principle:** hash the raw bytes at ingest, and a
  matched hash **cannot become a new root**. The upload is offered as a fork of the
  match instead. A match against the same user's own programme is a no-op or a new
  revision, their choice. What remains here is the mechanism, not the policy.
- The metadata step carries **one checkbox** with three claims (rights, no
  confidential data, irrevocable CC-BY), snapshotting `terms_version` and
  `asserted_at` onto the row. Licence itself is not a metadata field the user picks
  — every programme is CC-BY 4.0.
- **Downloads serve original bytes**; nothing is written into the `.xer`. Whether
  anything is stripped is [Personal data in published .xer files](013-personal-data-in-published-files.md)'s
  call, and it shares the pre-publish screen with this checkbox.

## Resolution

**The client parses the file before a byte is uploaded, and every server decision is
a recomputation of something the browser already showed the user.** That single
ordering choice answers most of the ticket: validation, dedup, limits and metadata
prefill all happen with the file open in the tab and nothing sent, so a rejection
costs the uploader a file-picker click rather than a 6.8 MB upload and a wait.

010 had already fixed the transport — presigned PUT browser → R2, gzipped
client-side, authoritative parse in a Function, `pending` status, cron sweep. What
follows is the pipeline built on top of it.

### The flow

```
1. pick file        browser parses (advisory) — reject here costs zero bytes
                    SHA-256 raw bytes → GET /api/hash-check
                    screen shows: activity count, P6 version, date range, WBS shape,
                    013's PI panel, and any dedup match
2. presign          POST /api/presign → mints revision_id (+ programme_id if new),
                    writes upload_intent, returns PUT URL with a content-length range
3. PUT              browser gzips (CompressionStream) → R2, in the background
4. metadata         user fills the form while step 3 runs
5. submit           batch insert: programme (current_revision_id null)
                                + revision (status pending, content_hash null)
                    on conflict (id) do nothing        ← idempotency
                    respond, then after() runs ingest
6. ingest           read object from R2, gunzip, hash, parse, compute derived,
                    write activities.json.gz + derived.v1.json, then
                    update revision → published, set programme.current_revision_id
7. client polls the status endpoint for ~15 s → redirect to /p/{slug}
```

Steps 5–7 make the normal case *feel* synchronous — parse is 1–2 s. Async exists for
the closed tab and because a retry needs somewhere to retry from.

### 1. Client-side pre-parse at the front of the funnel

010 made the parser isomorphic so 013 could preview a file in the browser. This
ticket makes that the **front of the upload funnel** rather than an add-on:

- Every rejection in section 4 fires in the tab, with nothing uploaded.
- The metadata form prefills from real parsed content (section 7).
- The activity-count cap is enforced before the upload, not after it.
- The dedup match is shown *before* the user writes a description, not after.
- 013's PI panel gets its data for free — one render, zero server work.

**The client parse and the client hash are UX only and are never persisted.** 010
fixed that rule for stats, on the grounds that client-supplied numbers would poison
the shelf and the leaderboard. This extends it to the content hash: the hash the
browser sends drives a lookup and nothing else; the stored `content_hash` is computed
by the server from decompressed bytes. A client lying about either gains nothing.

The cost, recorded honestly: **validation is written once and run twice.** That is
the price of the funnel, and it is only affordable because the parser is one
isomorphic module — the same code path, not a duplicated ruleset.

### 2. New programme, new revision or fork is declared by route

**The file never decides.** Three entry points, each minting a different shape:

| Route | Mints | Notes |
| --- | --- | --- |
| **New programme** — shelf upload button | `programme_id` + `revision_id`, `rev_no 1`, `root_programme_id` = self | the default |
| **New revision** — only from your own programme page | `revision_id`, `rev_no = max + 1` | owner-only (005); parent comes from the URL |
| **Fork** — from another programme's page, or forced by a hash match | both ids, `parent_revision_id` set | `change_note` required (005) |

**The evidence against auto-detection is Fixture B.** 001 recorded its four tender
variants as **fork siblings, not revisions** — one job, four competing takes,
differing by under 0.4% of rows. Any detector keyed on the P6 project id collapses
all four into one revision series, which is wrong on the only real multi-file set
that exists. Fixture A points the other way, a genuine two-year monthly series, and
**no property of the file distinguishes the two cases** — the difference is the
uploader's intent.

The file gets one advisory job: if the client parse sees a P6 project id matching a
programme the signed-in user already owns, the screen offers *"this looks like the
same P6 project as **X** — add it there as rev N instead?"* with a link. A hint,
never a reroute.

**Accepted cost:** someone uploading a monthly series may create eight programmes
instead of one series of eight revisions, and 005 fixed a strict tree with no merge,
so that is unfixable without deleting and re-uploading. Taken deliberately — a wrong
auto-file writes fork lineage that 003's Class B cascade depends on.

### 3. Dedup enforcement: a partial unique index, not a lock

010 handed over a live race: the hash check is read-then-write across two round
trips, `content_hash` is deliberately non-unique (005), so two simultaneous uploads
of identical bytes both become roots and 003's rule is defeated.

**The advisory lock is ruled out by 010's own driver choice.**
`pg_advisory_xact_lock` needs read → branch in app code → write inside one session.
That is an interactive transaction; `neon-http` is **batched non-interactive only**.
Taking the lock means adding the WebSocket pool 010 explicitly avoided, for this one
path.

```sql
alter table revision add column is_root_rev boolean not null default false;
create unique index revision_root_content_hash_uq
  on revision (content_hash) where is_root_rev;
```

`is_root_rev` is set at insert — true when the programme is a root and `rev_no = 1`.
The flag exists because the predicate spans two tables and a partial index cannot
reach across.

**Enforcement lands on the write that carries trusted bytes.** `content_hash` is null
on the `pending` row and written once, by ingest, from decompressed bytes — so the
index fires on the authoritative update, not on client-supplied data.

Three outcomes of a hash match:

| Match against | Outcome |
| --- | --- |
| A published root, seen at the **pre-upload check** | offered as a fork of the match (003's rule), or as a new revision if it is the user's own programme |
| A published root, seen only at **ingest** (the true race) | **reject with the offer** — "identical file was just published as *X*, fork it there" |
| A **tombstoned** revision | **hard reject** — "this file has been removed from xer-hero" |

The race loser is rejected rather than silently converted, because auto-forking
attaches a stranger's programme to their upload as a parent they never chose, and
003's fork carries an attribution obligation plus a required `change_note`.

**The tombstone case is new here and is cheap takedown enforcement.** 003 fixed that
rows never delete, so a tombstoned revision's `content_hash` survives after its bytes
are gone — which means the exact file that was taken down cannot be re-uploaded by
anyone, including under a fresh account. It does **not** catch the same job
re-exported from P6 (different bytes), and must not pretend to; that is the map's
near-duplicate fog.

### 4. Validation: five rejects, two things that must never reject

006 fixed the posture — **only tokenizer failure rejects; a stat that fails to
compute never fails the upload.** The list is therefore short, and the same module
runs it in both environments.

| # | Reject | Message the planner gets |
| --- | --- | --- |
| 1 | **Unreadable** — the file's last record is not `%E`, or it carries any `NUL` byte ([040](040-zeroed-xer-file.md)) | names where the readable content stopped and how many zero bytes follow, and asks for a re-download or re-export. Two forms, in 040 section 4 |
| 2 | No `ERMHDR` on line 1 | "This is not a Primavera XER export." |
| 3 | Tokenizer failure — missing `%T`/`%F`, irreconcilable field count | "This file is corrupt or truncated — re-export it from P6." |
| 4 | Zero activities (`TASK` absent or empty) | "This export contains no activities." |
| 5 | Multi-project | "This export contains N projects — export a single project and upload again." |
| 6 | Over the limits (section 5) | see section 5 |

**Amended 2026-08-08 by [040](040-zeroed-xer-file.md). Reject 1 runs first among the
content guards, and the order is the point.** A wholly zeroed `.xer` fails reject 4 as
well, so it was never *accepted* — it was rejected with *"This export contains no
activities"*, which blames the planner's programme for a fault in their copy of the file.
A truncated export that stops on a table boundary fails none of rejects 2–6 at all:
perfect header, zero tokenizer problems, correct arity, right activity count, one owning
project. Readability is decided on the bytes, before anything is derived from them,
because by the time a count exists the question has already been answered wrongly.

Reject 2 keeps its message and narrows to the case it was written for — a file of the
wrong kind, a renamed PDF — because the zero bytes are what separate that from a
sync-corrupted copy of the right file. Reject 3 keeps "corrupt or truncated" for genuine
tokenizer faults; truncation as such is reject 1's.

**Never reject on P6 version.** 002's rule is map `%F` names → indices per table per
file, so the parser is version-agnostic by construction. Rejecting a P6 25 file
because no fixture exists would reject files that parse perfectly. Record
`p6_version` — already a facet column — and reject only when a *required table or
field* is missing.

**Never reject on encoding.** CP1252 decoding is **lossy, not strict**. 002 measured
28,774 `0x81` bytes in one real fixture, and strict decoding throws on them. A file
that trips the decoder is a file we mis-decoded.

#### Multi-project: rejected, and the discriminator matters more than the verdict

002 left this open and flagged that it needed a fixture first. **Decided without
one, because the discriminator can be chosen so the unknown does not matter.**

**Count distinct `TASK.proj_id`, not `PROJECT` rows.** A P6 export carrying baselines
has several `PROJECT` rows and is *not* multi-project — rejecting on `PROJECT` row
count would forbid exactly the baseline-bearing file 006 left the door open for, since
DCMA 11, 13 and 14 skip today only "without a baseline". So:

- exactly one project owns activities → **ingest**; extra `PROJECT` rows stay in the
  raw bytes and are ignored by v1 stats;
- more than one → **reject**.

v1 is single-project throughout — one data date from `PROJECT.last_recalc_date`, one
WBS root, one activity count — and silently ingesting a two-project file produces
statistics that are wrong without being visibly wrong.

**This closes a fog item for free.** "Format areas with no fixture" listed
multi-project exports as needing a hand-authored file. A v1 that rejects them needs
no such fixture — only a synthetic two-project file to test the *rejection*, which
the 012 generator produces trivially.

### 5. Limits: 20,000 activities, 50 MB raw, reject rather than degrade

Measured ground: Fixture B is 3,344 activities in 6.8 MB raw / 872 KB gzipped, ~2.0 KB
per activity. That ratio puts a 20,000-activity file near **40 MB raw / ~5 MB
gzipped**; 004 independently extrapolates its `activities.json` to ~1.2 MB gzipped and
flags that as the number 012 must test.

Storage is not the constraint — 004 priced the whole corpus under $1/month. The
binding constraints are **browser heap** during the section-1 pre-parse (a 40 MB file
tokenized into JS objects is several hundred MB on a phone), Hobby's **4 CPU-hr/month**
Active CPU meter, and 006's **150 KB `derived.json` ceiling**, untested above 3,344
activities.

| Limit | Value | Enforced at |
| --- | --- | --- |
| Activity count | **20,000** | client pre-parse (before upload), then ingest |
| Raw file size | **50 MB** | client, then presign via a content-length range on the gzipped bytes (~8 MB), then ingest |

The content-length range matters: it makes R2 reject an oversized PUT, so the cap does
not rest on client honesty.

**Reject, never store a degraded programme.** 007 fixed the shelf row as twelve facts
in fixed slots with nothing allowed to flow; a row with half its stats missing is
precisely the noise that rule exists to prevent. 006's `{state, reason}` tagging is the
right granularity for an *individual* stat that fails — a whole programme with no
derived data is a different thing, and it would be permanently unfixable, since raising
the cap later computes nothing without a backfill nobody has specified.

**Both numbers are v1 floors set to be raised**, as configuration rather than as a
reversal, once 012 measures a real 20,000-activity file end to end.

### 6. Failure, retry, orphans and idempotency

**Idempotency is structural.** The `revision_id` uuid minted at presign is the PK, so
submit is `on conflict (id) do nothing` and returns the existing row. A double-submit
cannot create two programmes. No dedupe token, no request hashing.

**`upload_intent` makes abandoned bytes findable.** A user who PUTs and then closes
the form leaves an R2 object with no row, and hunting it by listing the bucket is
O(objects) forever.

```sql
create table upload_intent (
  revision_id   uuid primary key,
  programme_id  uuid not null,
  user_id       uuid not null references app_user(id),
  created_at    timestamptz not null
);
```

The sweep reads intents older than 24 h with no matching revision and deletes the
prefix. The table also gives presign rate limiting a natural home (section 8).

**`current_revision_id` stays null until publish.** 009's grid is
`programme join revision on current_revision_id`; an inner join drops nulls, so **a
pending programme is invisible to the shelf for free**, with no status predicate
anywhere. This reorders 005's circular insert slightly: programme with null, revision
`pending`, and the update deferred to the moment ingest succeeds.

**Failures split by kind:**

- **Deterministic** — tokenizer, multi-project, over-limit, the section-3 hash
  violation. Row → `failed` with a reason. These should be near-extinct: the client
  pre-parse catches all of them before a byte moves, so one reaching ingest means a
  bypassed client or a bug, and that is worth seeing.
- **Transient** — R2 read, DB blip, function timeout. Row stays `pending`; the sweep
  retries anything pending >2 min, **max 3 attempts**, then → `failed`.
- **Reap** — `failed` and stale `pending` rows, plus their R2 prefixes and their
  intents, after **24 h**.

The 24 h window is the whole argument for having a `failed` state at all. Deleting on
failure is tidier and destroys the only explanation the user will ever get — 010
closed the email door permanently, so if the tab was closed, an in-app row is the only
channel left. A live `failed` row lets the upload page say *"this file has two
projects in it"* when they come back.

**005's rule survives in the end state** — no failed row persists — but the enum
changes; see the amendments.

### 7. The metadata screen

One screen, five fields, two slots reserved for open tickets.

| Field | Prefill | Required |
| --- | --- | --- |
| Title | root `PROJWBS.wbs_name`, falling back to `PROJECT.proj_short_name` | **yes** |
| Description | empty; parent's on a fork | no |
| Sector | parent's on a fork; otherwise empty | **no** |
| `change_note` | empty | **yes on a fork's rev 1**, optional later (005) |
| Rights checkbox | always unticked | **yes** — snapshots `terms_version` + `asserted_at` (003) |

**The title prefill is a P6 quirk worth writing down.** `PROJECT.proj_short_name` is
the *Project ID* — a code like `C1042`, not a name. The human-readable name lives in
the **root `PROJWBS` node's `wbs_name`**. Fixture B has `PROJWBS = 1`, so even the
no-WBS shape has exactly one node to read it from: the degenerate case still works.

Title is **required despite prefilling** — the user must look at it, or the shelf
fills with rows named `C1042`. Sector is optional because 005 made the column nullable
precisely so an upload is never blocked on a dropdown the uploader cannot answer.

**Reserved slots:**

- **013's PI panel** sits directly above the checkbox, fed by the client parse. This
  ticket fixes the position and the data source; 013 decides what it says and whether
  anything is stripped.
- **015's sector control** is a dropdown over the `sector` lookup table. If 015 lands
  on inference, inference *prefills* the dropdown rather than replacing it, so 015
  stays free either way.

Everything except the checkbox is editable later on the programme page. The checkbox
is a per-revision assertion, so re-stating it means uploading again. `slug` is
immutable (005), so a title edit never moves the URL.

### 8. Invocation, the sweep, and presign abuse

**Ingest runs in-request via `after()`** — post-response work in the same invocation.
Parse is 1–2 s against a 300 s limit. A fire-and-forget `fetch` to a second Function
adds a hop and a shared secret and buys nothing at this duration.

**The sweep cannot be a Vercel cron on Hobby.** Verified 2026-08-07: **Hobby is limited
to one cron run per day, with ±59 minutes of scheduling slop**, and a more frequent
expression *fails at deployment*. A transient ingest failure would therefore wait up to
24 h for its retry, which makes the retry path decorative.

**The sweep runs from GitHub Actions instead** — a scheduled workflow POSTing
`/api/sweep` with a bearer secret every **15 minutes**. 010 already adopted GitHub
Actions for CI, it is free on a public repo, and its scheduler is best-effort, so 15
minutes is the honest cadence rather than 5. The secret lives in Actions secrets and
Vercel env; 010 already fixed that forked-PR builds get no env vars, so a fork cannot
call it. **A Vercel daily cron stays as a backstop**, which suits the 24 h reap exactly.

**New Hobby → Pro trigger for 010's list:** if Actions scheduling drifts badly, Pro's
once-per-minute cron is the fix, and it costs $20 rather than any code.

**Presign is the abuse surface.** Any signed-in user could otherwise mint unlimited
50 MB PUT URLs. Two caps, both counts against `upload_intent`: **3 unsubmitted intents
at a time** and **20 presigns per user per day**. Presign requires a Clerk session, so
this is per-account, and an abuser burns Google accounts to continue.

### Amendments to Domain model and schema

Five, all to [005](005-domain-model-and-schema.md):

1. **`is_root_rev boolean` added to `revision`**, plus
   `unique (content_hash) where is_root_rev`. 005's "`content_hash` is deliberately
   non-unique" stays true for the general column and now carries this one carve-out.
2. **`content_hash` becomes nullable** — null on `pending`, written by ingest from
   decompressed bytes.
3. **Revision status enum becomes `pending | failed | published | tombstoned`**, with
   `ingest_attempts smallint not null default 0` and `failure_reason text`.
4. **New table `upload_intent`** (DDL in section 6).
5. **The circular insert defers its update**: `current_revision_id` is set when ingest
   publishes, not at insert.

### What this hands to other tickets

- **[Personal data in published .xer files](013-personal-data-in-published-files.md)** —
  the pre-publish screen exists, its position is fixed (above the rights checkbox), and
  its data comes from the client parse at zero server cost. 013 decides content and
  stripping policy only.
- **[Where does a programme's sector come from?](015-sector-classification.md)** — the
  control is a dropdown over the `sector` table, optional, and inference prefills rather
  than replaces it.
- **[Get a large synthetic fixture for perf work](012-large-synthetic-fixture.md)** —
  add a **synthetic two-project file** to the CI corpus to test the multi-project
  rejection, and note the 20,000-activity file now has a second job: validating that
  the 20,000 / 50 MB caps are the right numbers.
- **[Stack, hosting and auth provider](010-stack-hosting-auth.md)** — Hobby's daily
  cron limit is a new named Pro trigger.
- **[What tooling does the operator need to run a takedown?](017-operator-takedown-tooling.md)** —
  a tombstoned `content_hash` now blocks re-upload of the exact bytes, so the operator's
  takedown is self-enforcing against the simplest re-upload; the sweep endpoint is
  another authenticated operator surface.
- **The map's "Operating and observing ingest" fog** — now specifiable, because the
  failure taxonomy exists. Graduated into
  [Operating and observing ingest](019-ingest-observability.md).

### Sources

- [Vercel cron jobs — usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
  — Hobby: once per day, ±59 min precision; more frequent expressions fail deployment
- [Vercel cron jobs — managing](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations) — 300 s,
  2 GB / 1 vCPU on Hobby

### Amendment 2026-08-08 — [What tooling does the operator need to run a takedown?](017-operator-takedown-tooling.md)

**A live defect, and two more jobs for the sweep.**

The defect: this ticket hard-rejects an upload whose `content_hash` matches a **tombstoned**
Revision — which is right for Class B, where it quietly makes takedown self-enforcing
against the exact bytes. But it applies to both classes, so **an owner who withdrew their
own programme by mistake could never re-upload that file.** Class A is voluntary, the owner
holds their own copy, and a permanent ban on those bytes was never what this rule defended
against.

**The reject is scoped to `removal_class = 'B'`.** Class A tombstones stop blocking
re-upload — which is also why 017 gives Class A no quarantine window, the owner simply
uploads the file again. Class B's block stays permanent: `content_hash` sits on a row, rows
never delete, so it outlives the 30-day quarantine and takedown-evasion stays shut. The
partial unique index on `(content_hash) where is_root_rev` is untouched.

**The sweep gains two queries.** It already runs every 15 minutes from a GitHub Actions
schedule with a database connection and already reaps abandoned uploads:

- `status = 'tombstoned' and bytes_deleted_at is null` — finish the R2 delete and CDN purge.
  This makes both the Class A self-service button and a crashed operator CLI run
  **self-healing**, and demotes the CLI's `--resume` from a requirement to a convenience.
- `removal_class = 'B' and removed_at < now() - interval '30 days' and quarantine_purged_at
  is null` — destroy quarantined bytes.

The parse-before-upload ordering is untouched, and so is the pre-publish panel. Worth
recording that this ticket's own reasoning was reused wholesale: **an in-app row is the only
channel left** once 010 removed email — which is why 017 declined to build operator
correspondence for cascaded fork owners and pushed the surface onto the map's *signed-in
user's own space* fog instead, where these `failed` rows are already a tenant.
