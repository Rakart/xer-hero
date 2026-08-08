---
id: 020
title: The client-side parse budget
type: grilling
status: closed
assignee: carlo
blocked_by: []
---

## Question

[Upload and ingest pipeline](011-upload-ingest-pipeline.md) puts a **full parse in the
browser tab before a byte is uploaded** — that ordering is what makes validation,
limits, dedup and metadata prefill cost a file-picker click instead of a 6.8 MB
upload. It was decided with no file larger than 3,344 activities to measure.

[Get a large synthetic fixture for perf work](012-large-synthetic-fixture.md) measured
it. Peak memory during a parse runs **12–13× the raw file size**, and the multiplier
is the same on the real fixtures as on the synthetic ones
([measurements](assets/synthetic-fixtures.md)):

| File | Raw | Peak, net of runtime floor |
|---|---|---|
| Fixture B | 6.8 MB | ~91 MB |
| `perf-20k` | 30.7 MB | ~358 MB |
| `perf-20k-dense` | 35.0 MB | ~442 MB |
| at the 50 MB cap | 50 MB | **~600 MB projected** |

Desktop Chrome usually survives 600 MB. Mobile Safari does not, and it does not throw
a catchable error — the tab is killed, so the failure mode is "the page vanished",
which is the single worst thing that can happen in an upload flow. Parse *time* is not
the problem: 287 ms wall, 560 ms CPU for the 20,000-activity file.

Settle:

- **Confirm the multiplier in a real browser.** The figures above are Node's RSS, and a
  browser's string representation and GC differ. Before choosing a remedy, measure a
  parse of `perf-20k.xer` in Chrome, Firefox and mobile Safari. This is the one
  prototype the ticket needs and it is cheap.
- **What the client parse actually has to compute.** 011 needs the content hash,
  activity/row counts, the multi-project check and the metadata prefill — not the full
  derived statistics. A streaming pass that counts rows and hashes bytes without
  retaining them is a fraction of the cost of building every table in memory. Decide
  whether the pre-upload parse is a *scan* rather than a parse.
- **Where the budget cuts.** If a tab can hold 300 MB, that is a ~25 MB file at the
  measured multiplier — below 011's own 50 MB cap. Either the caps drop to what a
  browser can survive, or some files skip the client parse, or the client parse gets
  cheaper. Pick one and say what the other two cost.
- **What happens when the client cannot parse.** A file over the client budget, a
  browser that OOMs, a user on a phone. Options: refuse the upload with an explanation,
  upload blind and let the server decide (011's rejection would then cost a 30 MB
  upload), or offer a degraded path. Note 011 made the server a *recomputation* of what
  the client showed, so the server path already exists — the question is whether it can
  run without the client having gone first.
- **Whether the caps move.** 012 also found that 20,000 activities and 50 MB do not
  line up: at Fixture A's progressed byte density a 20,000-activity file is ~57 MB, so
  the byte cap bites first at roughly 17,500 activities. Whatever this ticket decides
  about the client budget, the two caps need to be restated as one coherent rule with a
  rejection message that names which limit fired.

## Resolution

**The pre-upload pass is a scan, not a parse, and that collapses the memory question
rather than trading against it.** Measured in a real browser: the whole client step —
content hash, every check 011 needs, every value 013's panel enumerates, and 010's
gzip for the PUT — completes on a **50.5 MB** file inside a **16 MB** V8 old space,
retaining **3 MB**, in under 1.4 seconds. The full parse of a file two thirds that
size **dies** at four times that budget. So the answer to "where does the budget cut"
is *the client parse gets cheaper*, and it gets cheaper by about 20× rather than by
the 2× a tuning exercise would have bought.

All figures below, and the harness description, are in
[the measurements](assets/client-parse-budget.md). Measured on **Chrome for Testing
149.0.7827.55**, headless, 2026-08-08.

### What was not measured, first, because the ticket asked for three browsers

**Firefox and Safari were not measured and could not be.** There is no Firefox on
this machine or on the Windows host, and WebKit is not available at all — the only
engine in reach is Chromium, and Edge would be the same engine wearing a different
name. **No number in this ticket is a Safari number**, and the ticket's central worry
— mobile Safari killing the tab with nothing catchable — is neither confirmed nor
refuted by measurement.

That gap is survivable because the decision does not rest on the missing numbers. It
rests on two things that do transfer: the **retained** set, which no engine can beat
by much and which the scan drops from *the whole file structure* to 3 MB; and a
**capped V8 old space** used as a device proxy, which reproduces the exact failure
shape — renderer killed, nothing catchable — on demand. The remedy is chosen so that
it wins on every engine by never producing the condition, rather than by surviving
it. Confirming mobile Safari is worth doing when hardware exists, but nothing waits
on it: a design that fits in 16 MB does not have a Safari question.

### 1. The multiplier: confirmed, and wrong in two places, both the same way

**Measured in Chrome, the full parse costs 5.1× the raw file in JS heap and 6.8–7.7×
in renderer RSS — not 12–13×.** At the cap that is ~256 MB of heap and ~344 MB of
renderer RSS, against the ticket's projected ~600 MB.

Two separate corrections, and the first is the one worth remembering.

**012 was not measuring the parse.** `measure.mjs` reports the *process* peak RSS, and
by the time it is read the process has also derived every statistic, built both
`activities.json` cuts, run `JSON.stringify` three times and `gzipSync` four. The
browser does none of that — 010 fixed that nothing a client computes is persisted, so
the client's job stops at the tokenizer. Split by stage, tokenize alone is **10.4×**
and the remaining 1.9× is server work that was never in the tab.

**Then Chrome is cheaper than Node at the same work**: 10.4× becomes **5.1×** on the
heap, for the identical tokenizer over the identical bytes. The ticket was right to
demand a browser measurement before choosing a remedy, and right for the reason it
gave — Node is an imperfect proxy — but the error ran the opposite way from the one
the worry implied.

None of that rescues 011's ordering as written. 344 MB of renderer RSS to look at a
file the user has not yet decided to upload is still the wrong shape, it is still
linear in a quantity the caps deliberately allow to be large, and 5.1× of an
uncatchable failure is no better than 12×. The number moved; the verdict did not.

### 2. It is a scan, and 013's panel is what nearly stopped it — then proved it

The pre-upload screen 011 specified is: activity count, P6 version, date range, WBS
shape, the multi-project check, the dedup hash, the metadata prefill, the
same-project advisory hint, and 013's PI panel. **Not one of those needs a table held
whole.** 011 specified a parse because a parse was the thing that existed, not because
the screen asked for one.

The scan reads the file as a byte stream and, for each record, either increments a
counter and moves on **without splitting the row at all**, or walks it once slicing
only the columns the `%F` header says it wants. On a 20,000-activity export **92.9% of
records have no field extracted**, and only 7.1% have more than one. The tables that
make a `.xer` big — `TASKACTV`, `UDFVALUE`, `TASKRSRC`, `TASKPRED` — are exactly the
tables the screen has no use for. `clndr_data`, the largest single string in the
format, is never materialised on the client at all.

**The scan also decides whether the bytes were readable at all, and that is not a count.**
[040](040-zeroed-xer-file.md) found the hole this section's own framing implies: a scan
that counts what it recognises counts zero of everything on a wholly zeroed file without
anything going wrong, and reports success. `ScanResult` therefore carries
`reaches_end_marker` and `nul_byte_count` alongside the counters — a four-byte comparison
at a known offset and one byte compare inside the loop this pass already runs for the hash
and the gzip. Both are O(1), both are recomputed at ingest from the full parse, and the
rule over them is the first content guard 011 applies.

**013's panel is the real constraint and had to be reconciled rather than waved
through**, because 013 is explicit that it enumerates *values, not counts* — "nobody
acts on '15 resources'; they act on recognising a colleague's name". A counting scan
cannot feed that.

It reconciles, and **013's own corpus audit is what does it.** Every value the panel
prints lives in a table that is small by nature: `RSRC` (median 15 rows, worst real
file 37), `TASKMEMO` (worst 27), `rsrc_notes` (at most one per file),
`PROJECT.add_by_name` (one), the `ERMHDR` export login (one), and
`create_user`/`update_user`, which 013 measured at **one distinct value per file
across all 143** and therefore renders as a line rather than a list — a `Set` that
never exceeds cardinality 1. The one enormous PI-suspect surface, `UDFVALUE` at
12.5 MB corpus-wide, 013 had already decided is reported as **a count plus its
labels**, which is a counter keyed on column 0 of the row. The measured-empty probes
013 insisted on keeping (`email_addr`, both phones, `employee_code`, `user_id`,
`TASKUSER`, `DOCUMENT.author_name`) are counters over the same small tables and stay
free.

So the panel that looked like the argument against a scan turns out to be the argument
for it: **013 had already cut it down to the bounded tables, for readability, three
tickets before anyone needed it to be cheap.** Every enumerated list is capped at 500
values in the scan — 13× the worst real file — purely so a pathological export cannot
make the panel unbounded.

**The scan gives the same answers as the parse**, checked rather than asserted: run
over the whole committed correctness corpus in the browser and diffed against 012's
goldens, **23/23 pass**. Including the pair 011 turns on — `multiproj-two-proj-id`
reports two distinct `TASK.proj_id` and rejects, `multiproj-baseline-rows` reports
**three `PROJECT` rows and one `proj_id`** and accepts — so 011's discriminator
survives the move intact. 012's version-drift test survives too: `ver-60-fieldset` and
`ver-83-fieldset` produce identical scan output except for `p6_version` itself.

**The hash is `crypto.subtle.digest` over the file's bytes, not a hand-written
streaming SHA-256.** WebCrypto has no streaming digest, so this was a real fork: a
pure-JS streaming implementation was written and measured, and it peaks at 49 MiB
against WebCrypto's 74 MiB but is **2.2× slower** and is ~120 lines of hand-rolled
crypto to own forever. WebCrypto's extra cost is one file-sized `ArrayBuffer` —
external memory, one allocation, **1.0×** the file, where the parse's cost was 5× the
file in short strings. Both survive a 64 MB cap. Cheaper in code, cheaper in time, and
the memory it spends is the friendliest kind there is. Three implementations
(hand-written, WebCrypto, Node's `crypto`) were cross-checked to agree on every
fixture.

**One pass produces everything.** Hash, scan and 010's gzip run over the same read of
the file, and the gzipped blob — 7.1 MB at the cap — is the only thing retained at any
size, because the PUT needs it and S3 signing needs its exact length. That has a side
benefit 011 will want: the client knows the exact compressed length *before* asking
for a presigned URL.

### 3. Where the budget cuts, and what the other two would have cost

**The client parse gets cheaper.** The other two, priced:

- **Caps drop.** To survive the *parse* on a constrained device the byte cap would
  have to fall to roughly 25–30 MB, which at real byte density is 9,000–15,000
  activities — below 011's own activity cap, cutting genuine large programmes. Worse,
  it caps on *the browser's* budget rather than on anything true about programmes, so
  it has to drop again for every worse device and can never be explained to the
  planner it rejects. After this measurement it cannot be justified at all, because
  the constraint it answers no longer exists.
- **Some files skip the client parse.** A size-gated fork: a second code path behind a
  threshold nobody can defend, and it is **regressive** — the biggest files are the
  likeliest to hit a cap, and they are exactly the ones that would pay a multi-MB
  upload before hearing "no". It also carries a cost nobody would have found until it
  fired; see the next section.

### 4. When the client cannot scan: it does not, and the fallback is deliberately not built

The memory failure this ticket was written about **does not occur**, and that is now
measured rather than argued: 16 MB of old space, 50.5 MB file. What is left is not
memory at all, it is platform APIs. The scan needs `Blob.stream()`,
`crypto.subtle.digest` and — 010's requirement, not a new one — `CompressionStream`.
`CompressionStream` is the newest of the three and reached every current engine during
2023; the other two are older. Anyone whose browser lacks them cannot complete 010's
upload transport either, so this is not a new gate.

**The upload page requires all three and says so; there is no blind-upload fallback.**
Worth being explicit that this is not a shrug — the fallback is buildable, because 011
already made every server check a recomputation, so **the server path is complete on
its own and would run correctly with no client having gone first.** The reason not to
ship it is [Operating and observing ingest](019-ingest-observability.md): 019's
sharpest rule is *any deterministic ingest failure at all*, on 011's grounds that the
client pre-check makes them near-extinct, so one means a bug or a bypassed client — and
019 explicitly rejected a rate rule because "a rate rule would hide the first". **An
official blind-upload path makes deterministic failures routine and forces exactly that
rate rule.** The fallback would cost the estate its best alarm in order to serve
browsers that cannot upload anyway.

Everything else on the site — browse, search, the detail page, download — needs none of
the three and is unaffected. A tab killed for reasons of our own is no longer a case; a
tab killed by the OS for other reasons leaves bytes with no row, which is what 011's
`upload_intent` and the sweep already reap.

**011's ordering is therefore preserved, and strengthened**: the scan is cheap enough
to always run, so the pre-upload rejection is not a best-effort optimisation that
quietly stops applying to large files. It applies to every file at every size the caps
admit.

> **Amended 2026-08-08** by
> [Confirm the pre-upload scan on mobile Safari](029-confirm-scan-on-safari.md). The three platform
> APIs are **measured** rather than documented, and by use rather than by `typeof`: `Blob.stream()`,
> `CompressionStream` (output checked for gzip magic, not bare deflate) and `crypto.subtle.digest`
> (checked against a published vector) are all present and correct in **WebKit 26.5** and **Gecko
> 153** as well as Blink. This section's gate is real in every current engine, the scan completes a
> 50.5 MB file in **535 ms in WebKit** and 678 ms in Gecko, and the `ScanResult` is byte-identical to
> Chromium's on all 27 corpus fixtures. Nothing here reopens.
>
> **What is corrected is the method, not the verdict.** §3's device proxy — a capped JS heap standing
> in for a constrained device — **does not port**. Setting a 16 MiB ceiling and allocating 512 MiB in
> the page kills Chromium uncatchably and is simply ignored by Gecko's
> `javascript.options.mem.max` and WebKit's `JSC_gcMaxHeapSize`. So *"the remedy wins on every engine
> by never producing the condition, rather than by surviving it"* is evidenced **in Chromium alone**;
> in the other two engines the condition cannot be manufactured at all. §3's own rows are re-measured
> on the cap-sized file: the scan survives **16 MiB** and dies at 8, the retaining full parse
> survives 512 and **dies at 256**, both drivers on one tokenizer — a ≥16× gap, which is this
> section's claim, in the one engine that can state it.
>
> **The presign hardening note is upgraded from prudent to required.**
> `CompressionStream('gzip')` over the identical 50.5 MB file yields **7,383,836 bytes in WebKit,
> 7,192,108 in Gecko and 7,155,680 in Blink** — a 228 KB spread, Blink's matching Node's default
> `gzipSync` exactly — and Gecko is not deterministic across runs of itself, one of five coming out
> 235 bytes longer. So the exact content-length is required not only because R2 rejects a range, but
> because **the compressed length is not a function of the file**: it cannot be predicted
> server-side, from another engine, or from the same engine's last answer. One condition follows that
> was never stated — **a retry must PUT the same blob or fetch a new presigned URL** — so §2's
> retention of the gzipped blob is load-bearing rather than an optimisation.
>
> **Still not measured: mobile Safari.** Playwright's WebKit is a real WebKit built for Linux, not
> Apple's binary, and iOS's per-tab process ceiling exists in no desktop engine. This ticket's central
> worry is one engine-family closer to settled and still not settled; it is
> [046](046-ios-safari-scan.md).

### 5. The caps, as one rule

> A `.xer` is accepted when it contains **at least 1 and at most 20,000 activities**
> and the **raw file is at most 60 MB**. Both are evaluated from the one client-side
> scan and both are re-evaluated at ingest. A rejection names the guard that fired,
> with the measured value beside the limit.

**The byte cap moves from 50 MB to 60 MB, and that is what makes the rule coherent
rather than merely documented.** 012 found the two caps contradict: at Fixture A's
progressed density — 2,848 bytes per activity, the worst of 143 real files — a
20,000-activity programme is **56.96 MB**, so the byte cap bit first at ~17,500
activities and a planner who trimmed activities to clear one limit would be rejected by
the other. 60 MB is the smallest round number above that, so **any file inside the
activity cap at any density ever observed is inside the byte cap.** The two guards stop
contradicting each other, and the byte guard now fires only on a file that is *not
mostly activities* — which is a true and different thing to tell the uploader.

Raising it costs nothing that was measured: the server's full parse of a 50.5 MB file
peaks at **562 MiB** against a Function's 2 GB, ~3.6× headroom; the upload is 7.8–9.4
MB gzipped; the client is O(1). 004's storage model does not notice.

| Guard | Message |
|---|---|
| Activity count | *"This export has 24,310 activities. xer-hero accepts up to 20,000."* |
| Raw size | *"This file is 71.4 MB. xer-hero accepts `.xer` exports up to 60 MB. It has 12,400 activities, which is inside the limit — the size is in the other tables (activity codes, resource assignments, user-defined text)."* |
| Unreadable ([040](040-zeroed-xer-file.md)) | *"This file is not a complete P6 export. It reads correctly for its first 33,422 bytes and then stops — no end-of-file marker, and 3,442 zero bytes on the end. There is no way to tell how much of the programme is missing, so the 20 activities it does show cannot be taken as the whole of it. Download or re-export the file, then try again."* |
| Zero activities, multi-project, not a `.xer` | unchanged from 011 |

Ordering, so "which fired" is never ambiguous: `File.size` is checked first because it
is free, but **a file between the cap and twice the cap is still scanned**, so the byte
rejection can name the activity count too — which is the whole reason 012 said the
message has to name a guard. Above **twice the cap (120 MB)** the file is rejected on
size alone with no read, because nothing that large is a single-project P6 export and
scanning it is unbounded work.

Two hardening notes fall out of the byte cap living on the far side of a gzip:

- Presign issues an **exact** content-length rather than a range, because the client
  has already produced the compressed blob (section 2). R2 rejects anything else, so
  the cap does not rest on client honesty.
- Ingest **decompresses with a hard byte limit** of the raw cap and aborts past it. A
  12 MB gzip member can expand to gigabytes; without the limit the byte cap is being
  enforced on the wrong number.

### 6. One tokenizer, two drivers — 011's write-once-run-twice survives

011 was careful about this and it would be easy to break: *"validation is written once
and run twice… only affordable because the parser is one isomorphic module — the same
code path, not a duplicated ruleset."* A scan in the browser and a parse on the server
looks exactly like the duplication that sentence forbids.

It is not, provided the seam goes in the right place. **The tokenizer is one module** —
the `%T`/`%F`/`%R` grammar, the per-file per-table name→index mapping, the CP1252
decode, the continuation-line rule — and it is the part where being subtly wrong is
expensive. It emits records to a visitor. There are two visitors: a **retaining** one
that builds tables (server) and a **discarding** one that updates counters and bounded
value lists (client). The validation rules — the five rejects, the
distinct-`TASK.proj_id` discriminator, both caps — are functions over one `ScanResult`
shape, and the server computes that same shape as a by-product of its full parse. So
the *rules* are still written once and run twice; only the collection strategy differs,
and the collection strategy is the part with no rules in it.

This is testable cheaply, and it should be a CI assertion 018's job already has a home
for: **the scan and the full parse must agree on every corpus fixture.** That is a
stronger test than either alone, it is what stops the two drivers drifting, and it is
what produced the 23/23 above.

010's "same module, both environments" therefore narrows to "same tokenizer and same
rules, two drivers" — a real amendment, but the property 010 actually needed (no Node
built-ins, runs in a tab) is untouched.

### Amendments to closed tickets

- **[011](011-upload-ingest-pipeline.md)** — step 1 of the flow becomes a **scan**; the
  client hash is WebCrypto over the file's bytes; hash, scan and gzip are one pass; the
  presigned content-length is exact rather than a range; the caps become 20,000
  activities / **60 MB**; ingest gains a decompression byte limit. The ordering, the
  advisory-only rule, the dedup mechanism, the multi-project discriminator and the
  metadata prefill are all unchanged.
- **[012](012-large-synthetic-fixture.md)** — finding 4's "12–13×" is the whole
  measurement harness, not the client's work: tokenize alone is 10.4× in Node and
  **5.1× in Chrome**, and the ~600 MB projection at the cap measures **~256 MB heap /
  ~344 MB renderer RSS**. `measure.mjs` is not wrong; it is a *pipeline* harness that
  was read as a parser one.
- **[013](013-personal-data-in-published-files.md)** — the panel's data source is the
  scan rather than the parse. Its content is unchanged and its cost is lower, and the
  reason it survives is 013's own audit, which had already confined every enumerated
  value to a bounded table.
- **[010](010-stack-hosting-auth.md)** — "same module, both environments" becomes "same
  tokenizer and same rules, two drivers". `CompressionStream`, `Blob.stream()` and
  `crypto.subtle` become stated browser requirements of the upload page.
- **[015](015-sector-classification.md)** — its note that inference "would run
  client-side for free" **mostly survives**: `PROJWBS.wbs_name` is retained by the scan
  and `ACTVCODE` is tens of rows, so a WBS-and-code-name lexicon is still free. A
  lexicon over 20,000 *activity* names is no longer free, but 015 never proposed one,
  and the rejection stands on testability regardless.

### What this hands to other tickets

- **[018](018-local-dev-and-onboarding.md)** — one more CI assertion, in a job that
  already stands the whole stack up: scan output and parse output must agree on every
  corpus fixture.
- **[021](021-verify-fixtures-in-p6.md)** — unaffected. Nothing here depends on P6
  accepting a generated file.
- **A note for whoever next has an iPhone in front of them**: run the scan against a
  50 MB fixture in mobile Safari once. It is expected to pass with room to spare, and
  it is the one claim in this ticket that is reasoned rather than measured.

### Sources

- [The measurements](assets/client-parse-budget.md) — method, full tables, and the
  cap-sized fixture used.
- [`performance.measureUserAgentSpecificMemory()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory)
  — requires cross-origin isolation, which the harness provides.
- Browser support for `CompressionStream`, `Blob.stream()` and `crypto.subtle` is taken
  from documentation rather than measured here; only Chromium was available.
