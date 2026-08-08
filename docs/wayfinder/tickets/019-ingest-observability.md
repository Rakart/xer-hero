---
id: 019
title: Operating and observing ingest
type: grilling
status: closed
assignee: carlo
blocked_by: [011]
---

## Question

When an ingest fails at 2am, how does anyone find out — and what does the operator do
about it?

Graduated from the map's fog by
[Upload and ingest pipeline](011-upload-ingest-pipeline.md), which was the dependency:
the observability question is downstream of knowing what can actually fail, and now
the failure taxonomy exists.

**What 011 fixed, as given:**

- Failures split **deterministic** (tokenizer, multi-project, over-limit, hash
  violation — row → `failed` with a `failure_reason`) and **transient** (row stays
  `pending`, retried by the sweep, max 3 attempts, then `failed`).
- The sweep runs from a **GitHub Actions schedule every 15 minutes**, POSTing
  `/api/sweep` with a bearer secret, with a Vercel daily cron as backstop.
- `failed` and stale `pending` rows, their R2 prefixes and their `upload_intent` rows
  are **reaped after 24 h**.
- A deterministic failure at ingest should be **near-extinct** — the client pre-parse
  catches all of them before a byte moves — so one occurring is evidence of a bug or a
  bypassed client, and is worth seeing rather than merely counting.

**What 010 fixed, as a constraint:** Hobby retains **one hour of runtime logs** and
offers **no log drains**. A 2am failure is untraceable by 3am. This is one of 010's
named Hobby → Pro triggers, so part of the answer may be "pay $20", and that should be
compared honestly against building anything.

Settle:

- **What the operator sees, and where.** A dashboard page in the app, an email
  (impossible — 010 stores no address and the app cannot send mail), a webhook to
  somewhere, or reading `failed` rows by hand. Whatever it is has to survive the
  1-hour log window.
- **Does the sweep report?** It already runs every 15 minutes from GitHub Actions with
  a database connection — it is the natural place to notice "3 failures since the last
  run" and to push that somewhere durable. Decide whether it does, and where it pushes.
- **What a partial ingest leaves behind.** 011 defined the states but not every
  interleaving: blob written and row absent, `activities.json` written and
  `derived.json` not, R2 prefix half-populated when a retry starts. Decide whether
  ingest is idempotent per-object (safe to re-run over a partial prefix) or whether a
  retry deletes the prefix first.
- **Does the uploader see their own failure?** 011 keeps a `failed` row for 24 h
  precisely so an explanation exists, but nothing decides which surface renders it —
  the programme URL in a pre-publish state, a "my uploads" list, or a one-shot message
  in the upload flow. Note 016 may be defining a profile page anyway.
- **Retry by hand.** After 3 automatic attempts a row is `failed` and reaped at 24 h.
  Decide whether the operator can force a retry inside that window, and whether the
  uploader can.
- **Alert thresholds worth having at this scale.** A single failure is noise; a 100%
  failure rate for an hour is an outage. With no paging infrastructure and one
  operator, decide what is worth being told about and what is worth only counting.
- **Whether this triggers Pro.** Log drains plus >1 h retention is the thing Hobby
  cannot do at any amount of effort. If the answer needs them, say so plainly and
  record it as the trigger firing rather than working around it.

### Extended by [What tooling does the operator need to run a takedown?](017-operator-takedown-tooling.md)

017 declined to invent a second notification path and **handed this ticket a second row type
to surface**. Whatever channel is chosen here for `failed` ingests must also carry new
`takedown_report` rows: same operator, same absence of paging infrastructure, same 1-hour
log window, and — unlike a failed ingest — **nobody else is watching**. A report sitting
unseen is a rights holder or a named individual waiting on a site that promised best effort.

Three constraints 017 fixed that this ticket should treat as given:

- **The app cannot mail anyone.** 010 removed email; 017 confirmed it rather than working
  around it, and built no operator correspondence into the Class B flow at all.
- **The sweep gained two more queries** — incomplete tombstones (`bytes_deleted_at is null`)
  and expired Class B quarantine. It is now the reconciler for destructive work as well as
  for stranded uploads, which strengthens the case for it being the reporting point too.
- **`takedown_report.status` is `open | awaiting_owner | actioned | rejected`**, so "how
  many open cases" is a trivial count and a natural thing for a 15-minute sweep to push.

This does not change the questions above; it widens two of them. *What the operator sees,
and where* now has two row types. *Alert thresholds worth having* now has an asymmetry worth
naming: a single failed ingest is noise, but a single unread takedown report probably is not.

## Resolution

**The sweep becomes the reporter, an in-app dashboard is the record, and the alarm is a
red GitHub Actions run — so the observability answer costs one env var, two tables and one
column, and 010's log-drain Pro trigger does not fire.**

The ticket inherited a hard constraint and treated it as the whole problem: 010 removed
email, 017 confirmed it rather than working around it, and so *the app cannot tell anyone
anything*. That is true and stays true. It is also not the constraint that matters, because
**the app is not the only thing running**. 011 put a scheduled GitHub Actions workflow
against the production database every 15 minutes, and a scheduled workflow that exits
non-zero **mails the repo owner by default, free, forever**. The notification path this
ticket went looking for was provisioned three tickets ago for an unrelated reason. Nothing
had to be built to get a push channel; the sweep merely had to be allowed to fail.

That reframes the whole ticket. The question stops being *how do we notify* and becomes
*what is worth going red about*, which is a question about thresholds rather than
infrastructure.

### The 1-hour log window is dodged rather than paid for

010's Hobby limit — one hour of runtime logs, no drains — was named here as a possible
forced $20. It is not, and the reason is a design choice rather than a discovery: **every
durable fact in this design is a Postgres row, never a log line.** Counts, verdicts,
failures, heartbeats and the reasons behind them are written by the sweep and by ingest into
tables that outlive any retention policy. Logs become a debugging convenience, and
convenience is what a one-hour window is adequate for.

**The Pro trigger does not fire.** Stated plainly as the ticket demanded: this ticket needs
no log drain, no retention beyond one hour, and no paid plan. 010's five triggers stand
untouched — nothing here is a sixth, and nothing here fires one of the five.

### The dashboard: read-only, one env var, `/ops`

The operator sees an in-app page. It is a **pull** surface deliberately, with the red run as
its **push** counterpart — the mail says a threshold tripped, the page says what.

**Authorisation is an env-var allowlist of Clerk user ids**, checked as one equality against
the session. Zero schema, no grant UI, no role stored anywhere, and the entire authz rule is
one greppable line a contributor can audit. Changing it is a redeploy, which is correct
friction for the only privileged surface in the system. This deliberately declines the two
alternatives that looked tidier: a Clerk `publicMetadata` role puts an authz decision in a
vendor UI where no code review ever sees it, and an `app_user.is_operator` column adds
schema plus an interaction with 003's hard-delete of the user row, to grant a flag to
exactly one person.

**The dashboard is strictly read-only.** This is the first authenticated non-public surface
on a site that is otherwise public plus owner-edit, and a page that only reads needs no
write-authz reasoning, no CSRF surface and no misclick story. Every operator *write* stays
in 017's CLI, which already holds production credentials and already has a plan/apply
discipline. It renders:

- **`last sweep: N minutes ago`** as its top line, red past an hour.
- **The four rule states**, read from the latest `sweep_run` verdict rather than recomputed,
  so the page and the alarm can never disagree.
- **Failed and stale-pending revisions** — reason, attempt count, age, and the operator-only
  detail described below.
- **Takedown cases** — id, status, age, target, complaint body. Never the reporter's contact.

### Four asymmetric rules, because two singletons carry more information than any rate

A uniform rate rule would have been simpler and would have discarded both asymmetries this
ticket was handed.

1. **`takedown_open`** — a `takedown_report` in `open` for more than **12 h**. One is enough:
   017 established that nobody else is watching, and the person on the other end is a rights
   holder or a named individual. *Refined while writing up:* `awaiting_owner` gets a separate
   **7-day** clock rather than sharing the 12-hour one, because the ball is deliberately with
   the owner in that state and a 12-hour rule would nag about a case that is behaving
   correctly — but a case parked forever is still a case.
2. **`deterministic_failure`** — **any** deterministic failure in the last 24 h. 011 says
   these are near-extinct because the client pre-parse catches all of them before a byte
   moves, so one occurring is evidence of a bug or a bypassed client. A rate threshold on an
   event that should never happen is a threshold that guarantees the first occurrence is
   invisible.
3. **`transient_burst`** — **≥5 transient failures in an hour, or >50 % of at least 4
   attempts in an hour**. These are R2 and DB blips the sweep already retries, so a singleton
   is genuinely noise; the minimum-attempts floor exists so that one failure out of one
   attempt is not a 100 % failure rate.
4. **`reconciler_stuck`** — a tombstoned revision with `bytes_deleted_at` null for more than
   an hour, or a Class B quarantine more than 24 h past its 30 days. **This is the rule
   nobody asked for and the one that matters most**: it is 003's "bytes hard-delete" quietly
   not being true, and 017 made the sweep the reconciler for exactly this without giving it a
   way to complain. A stranded tombstone is a public unsigned URL that a takedown believes it
   destroyed.

### The endpoint decides; the workflow asserts one boolean

`/api/sweep` evaluates all four rules, writes the verdict, and returns `{ok, breaches[]}`.
The workflow step is one line that fails when `ok` is false.

Three reasons this split rather than thresholds in YAML. The rules are time-windowed and
joined, which is miserable in `jq`; **018 made CI stand the whole stack up on every PR**, so
rules in app code are testable with seeded rows that drive each one red on purpose, and YAML
is not; and the dashboard and the alarm read the same evaluated verdict instead of holding
two implementations that drift.

One consequence of the public repo that is easy to miss: **Actions logs on a public
repository are world-readable.** The workflow prints the boolean and nothing else. Breach
detail — counts, revision ids, case ids — stays in the response body and on the gated
dashboard. Nothing sensitive was ever going to be in there, but the discipline costs nothing
and removes the question permanently.

### Cadence: red on transition, then daily

The sweep runs 96 times a day. A rule that goes red on every run while a condition persists
produces 96 mails a day for one unactioned report, and **a channel that cries every 15
minutes is one you filter to a folder within a week** — at which point the alarm is
decorative and the system is back to pull without anyone deciding that.

So a rule alarms when it breaches for the first time since it last cleared, and **once per
24 h** while it stays breached. Otherwise the run is green and the dashboard carries the
truth. A mail deleted half-asleep at 2 a.m. therefore returns tomorrow, which is the
behaviour the takedown case needs and the reason "transition only, once ever" was rejected.

### Who watches the watchman

The sweep is now reconciler *and* alarm, so its silence reads exactly like health. Every run
writes a **`sweep_run` heartbeat** — start, finish, what it did, the verdict — and the
dashboard's staleness line is the detector.

Two causes of silence are worth naming. **GitHub disables scheduled workflows in a public
repo after 60 days without repo activity**, and mails the owner when it does — so the most
likely cause announces itself, though only that one does. A rotated bearer secret or a 500
from `/api/sweep` makes runs red, which is the alarm working. A dead deployment or a Neon
outage makes runs red too. What remains genuinely undetected-until-you-look is a *disabled
schedule whose disable notice was missed*, and that is accepted rather than solved: the
external dead-man's switch that would close it costs a fifth hosted account against 018's
four, and a monthly keep-alive commit puts permanent junk in the history of the public
artefact contributors read. The sweep's jobs are all reconciliation, so a dead sweep degrades
slowly — retries stall, reaps stall, tombstones strand — and rule 4 catches the last of those
the moment it resumes.

### A partial ingest is overwritten, not cleaned up

011 defined the states and not the interleavings. The answer is **idempotent per-object
overwrite, with no delete step**, and it falls out of decisions already made rather than
needing a new mechanism.

005 made blobs **id-addressed**, so every object has a deterministic key —
`{revision_id}/original.xer.gz`, `/derived.v2.json`, `/activities.v2.json`. A retry PUTs over
whatever is there. R2 PUTs are atomic per object, so no reader sees half an object, and **no
reader exists at all until publish**, because 011 deferred `current_revision_id` to the
moment ingest succeeds. A half-written prefix is therefore unreachable by construction, and
the contract version lives in the key, so a contract bump writes a new object rather than
mutating a live one.

The alternative — delete the prefix before retrying — was rejected on a detail: it would
delete the `original.xer.gz` the browser uploaded and the server has not necessarily
re-fetched, so it would need a scope exception in precisely the place an exception is
dangerous. Attempt-scoped subprefixes were rejected on 017's constraint: **Cloudflare purge
by prefix or tag is Enterprise-only, so the purge list must be explicit URLs**, and
deterministic keys keep that list a constant **3 URLs per revision** rather than 3 × attempts.

### Manual retry is the operator's, and the uploader already has one

After three attempts a row is `failed` and reaped at 24 h. Only *transient* rows are
retryable at all — a deterministic failure will fail identically forever — and the case that
justifies a manual path is not one row, it is an R2 outage that burned three attempts across
forty of them.

So **017's CLI gains a bulk-filterable requeue** (`status → pending`, `ingest_attempts → 0`)
that **refuses deterministic rows** rather than merely discouraging them. It is not a
dashboard button, because that would cost the read-only property described above for a case
that happens during outages, when the operator is at a laptop anyway.

**The uploader gets no retry control, because they already have one.** A `failed` revision
has `content_hash` null — 011 made the column nullable until publish — so the dedup partial
unique index does not block re-uploading the same bytes. Only a *tombstoned* hash is a hard
reject. Re-upload is one file-picker click on a file the client has already validated, and it
rebuilds from bytes that the reap may have already deleted from R2, which a retry button
would not.

### The uploader learns at their own programme's URL

011 kept a `failed` row for 24 h so that a user with a closed tab could learn why, and left
the surface undecided. The surface **already exists and needs nothing built**: the Programme
and its immutable slug exist from the moment of intent, and 011 made a pending programme
invisible to the shelf *for free* via null `current_revision_id`. So `/p/{slug}` is already
an unlisted page. It renders `pending` or `failed` plus `failure_reason` **to the owner**, and
404s to everyone else. The upload flow polls that same row while the tab is open, so there is
one truth rendered in two places rather than two explanations of failure.

This is the channel decision [The signed-in user's own space](023-signed-in-users-own-space.md)
was blocked on. That ticket now designs a list that **indexes** these pages — findability,
which is the part a URL cannot solve when there is no email to put it in — rather than
designing a failure surface from scratch.

### Adjudicate on the web, correspond from the laptop

017 stores `reporter_contact`, purged 90 days after close, which makes it the second most
sensitive thing in the system after `original.xer.gz`. The dashboard renders the case id,
status, age, target and complaint body — everything needed to *decide* — and **never renders
the contact**. The CLI prints it when the operator goes to act, on the same machine they
reply from.

The division is clean and the property is strong: **the only page that could leak a
complainant's address does not have it to leak**, and 017's 90-day contact purge has exactly
one reader to audit rather than two.

### One operator-only column, and it must never quote bytes

`failure_reason` is the uploader's explanation and is a class, not a cause. The operator's
diagnostic question — why did a near-extinct deterministic failure fire at 2 a.m. — was the
one thing genuinely served by log retention, so a **`revision.failure_detail`** column takes
it: exception name, message, and the **parse position** (table, row index, field index).
Operator-only, never rendered to the uploader.

**It must never quote file bytes.** The natural instinct of a tokenizer error is to echo the
offending line, and under 013 that line can carry a resource name — a person. Position, not
content. This is the one place in the design where a careless implementation would rebuild,
inside an error string, exactly the PI surface 013 refused to build on purpose.

### What 024 gets, and what it still has to decide

[Verifying the production-only edges](024-verifying-production-only-edges.md) asked whether
this mechanism is its mechanism. **It inherits the mechanism and keeps its questions.** What
lands in its lap is a rule engine, a verdict row, a gated dashboard and a free push channel;
a fifth rule is a function and a threshold.

What this ticket deliberately does *not* decide, because it has no evidence and 024 lists
better options than a 15-minute poll: whether the subject is a canary object or a real
upload, whether a wrong header is deploy-blocking or an alert, and whether bucket config
becomes code or stays a documented manual step. A config value that changes twice a year is
poorly served by a 15-minute poll, and answering by implication here would have been guessing
on that ticket's behalf.

### Schema this fixes

```sql
create table sweep_run (
  id            uuid primary key,
  started_at    timestamptz not null,
  finished_at   timestamptz,
  ok            boolean,                 -- the verdict the workflow asserts on
  actions       jsonb not null default '{}',  -- retried, reaped, tombstones_completed, quarantines_destroyed
  breaches      jsonb not null default '[]',  -- rule key + count per breaching rule
  error         text
);

create table alarm_state (               -- exactly 4 rows, seeded by migration
  rule            text primary key,      -- takedown_open | deterministic_failure | transient_burst | reconciler_stuck
  breaching       boolean not null default false,
  breaching_since timestamptz,
  last_alarmed_at timestamptz
);

alter table revision add column failure_detail text;  -- operator-only; position, never file bytes
```

Two tables and one column. `alarm_state` is separate from `sweep_run` rather than being
columns on it because `sweep_run` is append-only history and suppression is mutable current
state; conflating them would mean reading the last row to write the next one.

**No reaper on `sweep_run`.** 96 rows a day is ~35,000 a year, against 004's finding that the
whole database is ~150 MB and a rounding error. The history is worth more than the bytes.

### What this hands to other tickets

- **[Upload and ingest pipeline](011-upload-ingest-pipeline.md)** — the sweep gains a
  heartbeat write, rule evaluation and a verdict; its response body becomes a contract
  (`{ok, breaches[]}`) rather than a status code; and `failure_reason` gains an
  operator-only sibling.
- **[What tooling does the operator need to run a takedown?](017-operator-takedown-tooling.md)** —
  the CLI gains `ingest requeue` (bulk, transient-only) and a `report show` that is the sole
  reader of `reporter_contact`. Its "no second notification path" instinct is vindicated: the
  channel it declined to invent turned out to be one already in the repo.
- **[The signed-in user's own space](023-signed-in-users-own-space.md)** — the channel is
  picked. `failed` renders at `/p/{slug}` for the owner; 023 builds the index, not the
  explanation.
- **[Verifying the production-only edges](024-verifying-production-only-edges.md)** — inherits
  the rule engine; keeps all four of its own questions.
- **[Domain model and schema](005-domain-model-and-schema.md)** — two tables, one column.
- **[Stack, hosting and auth provider](010-stack-hosting-auth.md)** — the log-drain trigger is
  examined and explicitly **not** fired.

Build work, not a decision: **`docs/operating.md`**, four rows, rule → what the operator does.

### Flagged

- **Every threshold here is a guess.** There is no traffic, no corpus and no incident history;
  12 h, 5-per-hour, 50 %, 1 h and 7 d are reasoned but unevidenced. They are constants in app
  code with tests, so retuning is a reviewed commit. Expect the first month of real uploads to
  move at least one of them.
- **The alarm depends on a GitHub account setting nothing in the repo can enforce** —
  notifications for failed Actions runs must be on for the repo owner. It is on by default and
  it is a one-time check, but it is the single point of failure in the push path and no code
  can assert it. It belongs in `docs/operating.md` as a provisioning step.
- **A disabled schedule whose disable notice was missed is the one silence nobody detects.**
  Accepted, with the two fixes priced and refused above.
