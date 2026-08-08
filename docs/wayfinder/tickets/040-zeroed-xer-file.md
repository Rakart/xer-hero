---
id: 040
title: A zeroed .xer is a real shape — what does the scan do with it?
type: task
status: closed
assignee: carlo
blocked_by: [021]
---

## Question

[021](021-verify-fixtures-in-p6.md) found that **one real file in 139 is 397,781 bytes of
pure `NUL`** ([evidence](assets/p6-substitute-validation.md) §5) — a `.xer` sitting in a
tender folder, wholly zeroed, plausible sync corruption. It has the right extension, an
entirely ordinary size, and would sail past a size check.

MPXJ reads it as **`null` — no exception, no message.** A reader that returns "no error and
no project" is a worse failure mode than one that throws, and it is the failure mode our
own scan could easily inherit: [020](020-client-parse-budget.md)'s scan counts what it
recognises, and a file with nothing recognisable in it counts zero of everything without
anything going wrong.

Nothing in the corpus carries this shape and no ingest rule names it. Under 011's ordering
the scan runs in the browser before a byte is uploaded, so this is a rejection the user
should get from the file picker, not from a failed ingest 30 seconds later.

**Do:**

1. Add a **`enc-zeroed-file`** corpus fixture — a `.xer` of plausible size that is entirely
   `NUL`. It has no `%T`, no `%F`, no `ERMHDR`.
2. Pin the **ingest verdict** in its golden: rejected, and rejected for a stated reason
   rather than by falling through to a zero count. The neighbouring question — a file that
   is *partly* zeroed, i.e. a truncated export with a valid `ERMHDR` — should be settled at
   the same time, because the natural rule for one ("no `ERMHDR`") does not catch the
   other.
3. Decide the discriminator and record it. The cheap candidates are a missing/invalid
   `ERMHDR` on the first line and a zero recognised-table count; the honest requirement is
   that **a file which parses to nothing is rejected as unreadable rather than accepted as
   empty**. Under the standing preference, the agent decides this.
4. Check the same rule against the other real-world degenerate cases the corpus already
   has (`missing-taskpred`, `missing-calendar`) so a legitimately sparse file is **not**
   caught by it — those files parse to something and must stay acceptable.

The user-facing message matters here: this file is not "invalid P6 data", it is a corrupt
copy, and the useful thing to tell someone is to re-export or re-download it.

## Resolution

**A `.xer` is readable only if its last record is the format's own `%E` end marker and it
carries no `NUL` byte anywhere. Failing either is one guard — `unreadable` — and a file
that fails it is rejected as an incomplete or corrupt copy, not as an empty or invalid
programme.** Both halves are byte facts the scan already has in hand, both were measured
against all 139 real exports before being chosen, and together they catch the wholly
zeroed file *and* the truncated export while leaving every legitimately sparse file in the
corpus untouched.

Two fixtures, a pair on purpose:

- **`enc-zeroed-file`** — 397,781 bytes of pure `NUL`, the observed artefact at its
  observed size. No `ERMHDR`, no `%T`, no `%F`, no `%E`.
- **`enc-truncated-export`** — a perfectly ordinary 20-activity export with its `%E`
  removed and the tail zero-padded to a filesystem block. Header perfect, every table
  whole, every row at its `%F` arity.

### 1. What happens today, stated exactly

The ticket asks whether the scan accepts the zeroed file as empty. Measured rather than
assumed, on both files:

| | zeroed | truncated |
|---|---|---|
| `ERMHDR` on line 1 | absent | **present and correct** |
| Tables recognised | 0 | **18** |
| Activities | 0 | **20** |
| Tokenizer problems | 1 | **0** |
| Distinct `TASK.proj_id` | 0 | **1** |
| Inside 020's caps | yes | yes |
| **011's verdict as written** | reject #3 | **accept** |

So the answer is worse than the ticket feared in one place and better in another, and both
corrections matter.

**The zeroed file is not accepted today — and it is rejected for the wrong reason.**
011's reject #3 fires and tells the planner *"This export contains no activities."* That
is a statement about their programme, and it is false: their programme is fine, their copy
of the file is not. The scan itself reports success with every count at zero — 020's worry,
verbatim — and it is only a rule aimed at something else entirely that stops the file
downstream, with a message that sends the planner back to P6 to look for activities that
were never missing.

**The truncated export is accepted today, and that is a live defect.** It passes every one
of 011's five rejects because there is nothing for them to catch: the header is right, the
tokenizer reports **zero** problems, the arity of every row matches its `%F`, the activity
count is right and there is one owning project. It publishes. And the zeros are not inert
— the continuation rule that [xer-format.md](assets/xer-format.md) requires for multi-line
free text swallows the padding into the last record, so `UDFVALUE.udf_code_id` on the final
row arrives as a **3,443-character value of which 3,442 are `NUL`**, at the correct arity,
with nothing anywhere reporting a problem. `measure.mjs --verify` passes this file today
without the amendment in section 6.

That is [021](021-verify-fixtures-in-p6.md)'s MPXJ failure mode one level up. MPXJ returns
"no error and no project"; a completeness-blind reader returns **no error and half a
project**, which is harder to notice and travels further.

### 2. The discriminator, and what each rejected candidate costs

The rule is two conditions because the two failures are two different physical events —
a write that stopped, and a write that never landed — and no single condition covers both
without over-reaching.

| Candidate | Catches zeroed | Catches truncated | Cost |
|---|---|---|---|
| **No `ERMHDR` on line 1** (011 #1) | yes | **no** — the header is perfect | Also gives the wrong verdict where it does fire: *"this is not a Primavera XER export"* is a claim about the file's **kind**, and the planner is holding the right kind of file in a broken copy. It is the cheapest rule and it answers a different question |
| **Zero recognised tables or records** | yes | **no** — 18 tables, 20 activities | And it is the rule most likely to catch a legitimately sparse file by accident, because sparseness and emptiness differ only by degree. It is also *derived*: it runs after the tokenizer has already concluded the file was fine, which is the wrong place to decide whether the bytes were readable |
| **Zero activities** (011 #3) | yes, today | **no** | Blames the programme for a fault in the copy. See section 1 |
| **`NUL` anywhere, alone** | yes | yes | Misses the commonest truncation there is — an interrupted HTTP transfer simply stops, with no padding behind it and not one zero byte in the file |
| **No `%E`, alone** | yes | yes | Misses a file zeroed in the **middle** whose tail survived, and — the reason it is not sufficient — it cannot tell a corrupt copy from a wrong file type, so it cannot choose the message |
| **Both, as one guard** | yes | yes | Two counters. Adopted |

**Neither arm is redundant.** `%E` is load-bearing for the clean truncation the `NUL` arm
cannot see; `NUL` is load-bearing for mid-file damage and, more importantly, for the
*message* — it is the fact that separates "your copy is damaged" from "this is not a P6
file", and it is the only fact in the file that can.

**Why `NUL` is a safe corruption signal, measured.** A `.xer` is CP1252 text throughout,
tab-delimited and CRLF-terminated; `NUL` is not a character the format can produce. Across
the 139 real exports, **the 138 readable files contain not one `NUL` byte between them**,
and the 139th is 100% `NUL`. The trade, stated as a trade: a real export that somehow
carried a stray `NUL` in a free-text field would be rejected with a message telling the
planner to fetch it again. Nothing has ever been observed to do this, and a text export
carrying a `NUL` is damaged on any reasonable reading of the word.

**Why `%E` is a safe completeness signal, measured.** **138 of 139 real files end with
`%E\r\n`** — the exception being the zeroed one. Oracle documents no grammar, so this is
observed rather than specified, but it is observed without a single exception across two
P6 versions and three years of exports.

**The trade the `%E` arm makes, and why it is taken.** `enc-truncated-export` loses nothing
but its marker: every table, every row and every value survive. Rejecting it looks
pedantic, and it is not — **a truncation landing on a table boundary is indistinguishable
from a complete export except by the end marker.** A file that stops after `TASK` reads as
a perfectly good activity-list export with no logic, no calendars and no resources, which
is exactly what `missing-taskpred` legitimately is. Without the marker there is no way to
tell the two apart, so accepting one means accepting the other, and 011 rejects rather than
degrades precisely so a programme never lands on the shelf with half its stats missing.

**The cost of the guard is two counters in a pass that already exists.** 020 established
that hash, scan and gzip run over one read of the file; a `NUL` counter is a byte compare
inside that loop and the marker test is a four-byte comparison at a known offset. It is
O(1) in memory and adds nothing to 020's 3 MB retained set.

### 3. Where it runs

**In the browser scan, first among the content guards**, so this is a file-picker rejection
and not a failed ingest thirty seconds later — 011's ordering, unchanged. 020's `File.size`
check stays ahead of it because it is free and because nothing above 120 MB is read at all.

**Ingest recomputes it**, per 011's rule that every server decision is a recomputation of
something the browser already showed. Under 020 §6 the seam is one tokenizer with two
drivers and the rules are functions over one `ScanResult`: `ScanResult` gains
`reaches_end_marker: boolean` and `nul_byte_count: number`, the discarding driver fills
them from the byte stream, and the retaining driver gets both as a by-product of the full
parse. The *rule* is still written once and run twice, and 020's CI assertion — scan and
full parse must agree on every corpus fixture — now has two more fields to agree on.

**019's alarm is unaffected and slightly better served.** A deterministic ingest failure
stays near-extinct because the guard fires in the tab; the zeroed file never reaches a
Function at all.

### 4. The messages

One guard, two messages, chosen by which arm fired and by whether an `ERMHDR` was ever
seen. Both name the measured numbers beside the claim, as 020 requires, and neither calls
the planner's data invalid.

**Nothing readable — no `ERMHDR`, and the file is zero-padded:**

> This file is not a complete P6 export. Every one of its 397,781 bytes is zero — there is
> no header, no data and no end-of-file marker in it at all. That is what an interrupted
> download or a file-sync error leaves behind, not anything P6 wrote. Download or re-export
> the file, then try again.

**Stops partway — a valid `ERMHDR`, then nothing:**

> This file is not a complete P6 export. It reads correctly for its first 33,422 bytes and
> then stops — no end-of-file marker, and 3,442 zero bytes on the end. There is no way to
> tell how much of the programme is missing, so the 20 activities it does show cannot be
> taken as the whole of it. Download or re-export the file, then try again.

Both end on the same instruction because both have the same fix, and it is a fix the
planner can carry out without understanding a word of the diagnosis. "There is no way to
tell how much of the programme is missing" is the honest sentence: on this fixture nothing
in fact is missing, and the reader cannot know that.

**011's reject #1 keeps its message and narrows to the case it was written for.** A file
with no `ERMHDR` and no zero padding is genuinely a file of the wrong kind — a renamed PDF,
a spreadsheet — and *"This is not a Primavera XER export"* is the right thing to say to
someone who picked the wrong file. The split is made by the zero bytes, and it is worth
making: told "this is not a Primavera XER export", the planner holding a sync-corrupted
copy will swear that it is, and they will be right.

### 5. Legitimately sparse files survive, verified rather than assumed

The guard was run over every committed synthetic fixture and its verdict compared against
the golden:

```
ok   missing-calendar.xer      readable  end_marker=true  nul=false  golden=readable
ok   missing-taskpred.xer      readable  end_marker=true  nul=false  golden=readable
ok   text-multiline.xer        readable  end_marker=true  nul=false  golden=readable
...
ok   enc-truncated-export.xer  unreadable end_marker=false nul=true  golden=unreadable
ok   enc-zeroed-file.xer       unreadable end_marker=false nul=true  golden=unreadable

27/27 corpus verdicts agree with their golden
```

The harness is fifteen lines and lived in the session scratchpad rather than the repo; the
amendment to `measure.mjs` below is the permanent form of the same check, run by CI over
the whole corpus.

**`missing-taskpred` and `missing-calendar` are both `readable`.** Neither is caught, and
neither can be: a file with no `TASKPRED` table still ends with `%E`, because P6 wrote it
to the end. The two files that carry the least data in the corpus are the two the guard has
the least to say about, which is the property the ticket asked for. `sparse-150` is
`readable` too, and so is `text-multiline` — the continuation fixture is not confused with
a truncation, because a continuation line sits inside a file that still finishes.

Every other corpus fixture is `readable`, including the deliberately hostile ones: the
logic cycle, the `0x81` mojibake, the undocumented table, the unknown enums, the external
relationships and the multi-project file. **Being unacceptable and being unreadable are
different verdicts**, and `multiproj-two-proj-id` is the file that proves the guard keeps
them apart — it is rejected, and it is rejected as readable.

### 6. What was built

| File | What it is |
|---|---|
| `fixtures/synthetic/corpus/enc-zeroed-file.xer` | 397,781 bytes of `NUL` — the observed artefact at its observed size |
| `fixtures/synthetic/corpus/enc-zeroed-file.expected.json` | every count zero, plus the `readability` block and the `ingest` verdict |
| `fixtures/synthetic/corpus/enc-truncated-export.xer` | 36,864 bytes: 33,422 of complete export, then 3,442 `NUL` |
| `fixtures/synthetic/corpus/enc-truncated-export.expected.json` | the full golden — the programme is untouched — plus `readability` |
| `tools/fixture-gen/generate.mjs` | `noProgramme` and `corrupt` entry hooks, `readability()`, `describeCorrupt()` |
| `tools/fixture-gen/catalogue.mjs` | the two entries, appended to the correctness block |

**The generator needed a path that is not `synthesise()`.** An all-`NUL` file is not
something a programme model can produce, and a golden written from intent standing in front
of bytes that carry none would assert the opposite of what the fixture exists to say. Two
hooks, both narrow:

- **`noProgramme: true`** skips the model entirely; `corrupt(null)` returns the bytes.
- **`corrupt(bytes)`** damages a normally-generated file *after* it is written. It is the
  one hook allowed to contradict the model, and it is safe for the reason `mutate` is not:
  it removes bytes from the **end**, so every record the damaged file still carries is
  byte-identical and the existing golden stays true of all of them. What the damage costs
  is recorded separately, in `readability`, measured off the bytes.

`readability` is written from the bytes rather than from intent — a prefix test, a marker
test and a counter. That is the one place this generator's standing rule has to bend, and
it bends the right way: there is nothing in a corrupt file to have intended, and these are
byte measurements rather than a read-back through our own tokenizer.

**The change to `generate.mjs` is provably inert for every other fixture.** Both hooks are
conditional and the `readability` block is only attached to entries that declare `corrupt`,
so a fixture that declares neither produces byte-identical output. Checked by regenerating
`ver-83-fieldset`, `missing-taskpred` and `text-multiline` from a copy of the tree: all
three `.xer` files and all three goldens came back **byte-identical** to the committed ones.

**Corpus round-trip: 26/27, and the one failure is the amendment below.**
`enc-truncated-export` passes `measure.mjs --verify` unchanged — which is itself the
finding, since the harness cannot tell it from a healthy file. `enc-zeroed-file` fails on
`verifyCorpus`'s hard-coded `allowProblems`, which names one fixture by string. That file is
outside this session's write scope; the exact change is in the amendments.

### README delta

For `fixtures/synthetic/README.md`, which this session did not touch.

**1. *What is here* — the corpus row.** Current:

```
| `corpus/*.xer` | correctness | 24 files, ~20 activities each, one known landmine per file |
```

New — but **count the directory rather than trusting this number**: this ticket adds two,
and at least one other session has added `cal-flat-no-0x7f` concurrently, so 24 → 26 is
this ticket's contribution alone and the total will be higher:

```
| `corpus/*.xer` | correctness | 26 files, ~20 activities each, one known landmine per file |
```

**2. *The golden files* — the contents sentence.** Current:

> Each one carries row counts per table, the assertions worth checking by name (status
> mix, float nulls versus zeros, WBS depth, distinct `TASK.proj_id`, external
> relationships), a **`driving_path` block** (below), an `ingest` verdict where a fixture
> pins an ingest rule, and — for files small enough — a full name-mapped dump of every
> activity.

New:

> Each one carries row counts per table, the assertions worth checking by name (status
> mix, float nulls versus zeros, WBS depth, distinct `TASK.proj_id`, external
> relationships), a **`driving_path` block** (below), an `ingest` verdict where a fixture
> pins an ingest rule, and — for files small enough — a full name-mapped dump of every
> activity. The two corrupt fixtures carry a **`readability` block** as well, measured off
> the bytes rather than written from intent, because there is nothing in a corrupt file to
> have intended: whether it starts with `ERMHDR`, whether its last record is `%E`, how many
> `NUL` bytes it holds, and the verdict those imply.

**3. *The landmines* — the opening paragraph.** Current first two sentences:

> Each file isolates one, so a failure points at one cause. High bytes appear only in the
> two encoding fixtures; a lone CR only in `text-multiline`.

New:

> Each file isolates one, so a failure points at one cause. High bytes appear only in the
> two encoding fixtures; a lone CR only in `text-multiline`; a `NUL` byte only in the two
> unreadable fixtures, which are the only two files here that are damage rather than
> programme.

**4. *The landmines* table — two new rows, inserted after the `external-relationship`
row.** Current:

```
| `external-relationship` | `pred_proj_id` pointing outside the file — legitimate, not corruption |
```

New — the existing row is unchanged, these follow it:

```
| `external-relationship` | `pred_proj_id` pointing outside the file — legitimate, not corruption |
| `enc-zeroed-file` | **Must reject as unreadable**: 397,781 bytes of pure `NUL`, the shape one real file in 139 actually has. Every count in its golden is zero, which is why no count can be the discriminator — a scan result of all zeros is indistinguishable from a very small programme |
| `enc-truncated-export` | **Must reject as unreadable**: a perfect header, whole tables, correct arity, and no `%E`. The file that says why "no `ERMHDR`" cannot be the rule. Pair it with `missing-taskpred`, which is the same shape and is legitimate — a sparse file ends with `%E` and a truncated one does not |
```

### Amendments for the integrating session

#### [011](011-upload-ingest-pipeline.md) — section 4, the reject table

The table gains a row at the top and reject 2 narrows. Current:

| # | Reject | Message the planner gets |
| --- | --- | --- |
| 1 | No `ERMHDR` on line 1 | "This is not a Primavera XER export." |
| 2 | Tokenizer failure — missing `%T`/`%F`, irreconcilable field count | "This file is corrupt or truncated — re-export it from P6." |
| 3 | Zero activities (`TASK` absent or empty) | "This export contains no activities." |
| 4 | Multi-project | "This export contains N projects — export a single project and upload again." |
| 5 | Over the limits (section 5) | see section 5 |

Replace with:

| # | Reject | Message the planner gets |
| --- | --- | --- |
| 1 | **Unreadable** — the file's last record is not `%E`, or it carries any `NUL` byte ([040](040-zeroed-xer-file.md)) | names where the readable content stopped and how many zero bytes follow, and asks for a re-download or re-export. Two forms, in 040 section 4 |
| 2 | No `ERMHDR` on line 1 | "This is not a Primavera XER export." |
| 3 | Tokenizer failure — missing `%T`/`%F`, irreconcilable field count | "This file is corrupt or truncated — re-export it from P6." |
| 4 | Zero activities (`TASK` absent or empty) | "This export contains no activities." |
| 5 | Multi-project | "This export contains N projects — export a single project and upload again." |
| 6 | Over the limits (section 5) | see section 5 |

And graft this in immediately after the table:

> **Reject 1 runs first among the content guards, and the order is the point.** A wholly
> zeroed `.xer` fails reject 4 as well, so it was never *accepted* — it was rejected with
> *"This export contains no activities"*, which blames the planner's programme for a fault
> in their copy of the file. A truncated export that stops on a table boundary fails none
> of rejects 2–6 at all: perfect header, zero tokenizer problems, correct arity, right
> activity count, one owning project. Readability is decided on the bytes, before anything
> is derived from them, because by the time a count exists the question has already been
> answered wrongly.
>
> Reject 2 keeps its message and narrows to the case it was written for — a file of the
> wrong kind, a renamed PDF — because the zero bytes are what separate that from a
> sync-corrupted copy of the right file. Reject 3 keeps "corrupt or truncated" for
> genuine tokenizer faults; truncation as such is reject 1's.

#### [020](020-client-parse-budget.md) — section 2 and section 5

Add to section 2, after the paragraph beginning *"The scan reads the file as a byte
stream"*:

> **The scan also decides whether the bytes were readable at all, and that is not a count.**
> [040](040-zeroed-xer-file.md) found the hole this section's own framing implies: a scan
> that counts what it recognises counts zero of everything on a wholly zeroed file without
> anything going wrong, and reports success. `ScanResult` therefore carries
> `reaches_end_marker` and `nul_byte_count` alongside the counters — a four-byte comparison
> at a known offset and one byte compare inside the loop this pass already runs for the
> hash and the gzip. Both are O(1), both are recomputed at ingest from the full parse, and
> the rule over them is the first content guard 011 applies.

Add a row to section 5's message table, above the "Zero activities, multi-project…" row:

| Guard | Message |
|---|---|
| Unreadable | *"This file is not a complete P6 export. It reads correctly for its first 33,422 bytes and then stops — no end-of-file marker, and 3,442 zero bytes on the end. There is no way to tell how much of the programme is missing, so the 20 activities it does show cannot be taken as the whole of it. Download or re-export the file, then try again."* |

And amend the sentence in section 5 reading *"Zero activities, multi-project, not a `.xer`,
corrupt | unchanged from 011"* to *"Zero activities, multi-project, not a `.xer` |
unchanged from 011"*, since "corrupt" is now the unreadable guard's own row.

#### `tools/fixture-gen/measure.mjs` — required, and outside this session's write scope

`verifyCorpus` tolerates tokenizer problems by naming one fixture in a string, so
`enc-zeroed-file` fails the round-trip until this lands. Current:

```js
    // Problems are expected in exactly one fixture: the multi-line one.
    const allowProblems = expected.fixture === 'text-multiline';
    if (!allowProblems && m.tokenizer_problems.length) errs.push(`tokenizer: ${m.tokenizer_problems[0]}`);
```

Replace with:

```js
    // Problems are expected where the golden says so: the multi-line continuation
    // fixture, and any fixture whose landmine is that the bytes are unreadable.
    const allowProblems = expected.fixture === 'text-multiline'
      || expected.readability?.verdict === 'unreadable';
    if (!allowProblems && m.tokenizer_problems.length) errs.push(`tokenizer: ${m.tokenizer_problems[0]}`);

    // The unreadable guard (040), checked off the bytes rather than off the tokenizer,
    // because the tokenizer is exactly what cannot see it: enc-truncated-export reports
    // zero problems and correct arity on every row.
    const bytes = fs.readFileSync(path.join(dir, f));
    const endMarker = bytes.subarray(Math.max(0, bytes.length - 16)).toString('latin1')
      .replace(/[\r\n\t ]+$/, '').endsWith('%E');
    const readable = endMarker && bytes.indexOf(0) === -1;
    const wantReadable = (expected.readability?.verdict ?? 'readable') === 'readable';
    if (readable !== wantReadable) {
      errs.push(`readability ${readable ? 'readable' : 'unreadable'} != golden`
        + ` ${wantReadable ? 'readable' : 'unreadable'}`);
    }
```

With both blocks in place the whole corpus round-trips, and the second block is the
assertion that stops a later change from quietly making a corrupt fixture look healthy.

#### [021](021-verify-fixtures-in-p6.md) — its asset, §5

The second bullet of *Two robustness facts the corpus does not carry* can lose its last
clause. Current ending: *"…and neither the corpus nor the ingest rules currently name this
case."* New: *"…and it is now named by both: `enc-zeroed-file` carries the shape and 011's
reject 1 carries the rule ([040](../040-zeroed-xer-file.md))."*

### Sources

- The 139 real exports, probed for this ticket: **138 end with `%E\r\n` and contain zero
  `NUL` bytes between them; the 139th is 397,781 bytes of pure `NUL`, has no `ERMHDR` and
  no `%E`.** Nothing identifying the contract is recorded here or anywhere in the repo.
- [`assets/p6-substitute-validation.md`](assets/p6-substitute-validation.md) §5 — MPXJ
  reads that file as `null` with no exception and no message.
- [`assets/xer-format.md`](assets/xer-format.md) — the grammar `<file> ::= <header>
  <table>+ "%E"`, observed rather than documented, and the continuation rule that swallows
  the zero padding into the last record.
