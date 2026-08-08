---
id: 015
title: Where does a programme's sector come from?
type: grilling
status: closed
assignee: carlo
blocked_by: [006]
---

## Question

[The derived.json contract](006-derived-json-contract.md) put `sector` on the
Postgres row as a typed facet column, because a browsing planner filtering to "rail"
or "building fitout" is the most obvious filter the storefront can offer. But nothing
decides where the value comes from, and the `.xer` does not carry one.

This is the only card field in the schema with no derivation. Every other column is
computed from the file.

Settle:

- **Who supplies it?** Uploader picks from a fixed list, uploader free-tags, or we
  infer it. A fixed list is filterable and comparable but needs designing up front
  and will be wrong at the edges. Free tags are honest and useless as a facet.
- **Can it be inferred?** Activity codes and WBS names carry sector vocabulary in
  practice — and the fixtures suggest codes are how planners structure work. But
  Fixture B has `PROJWBS = 1` and no WBS text to mine at all, so inference must degrade
  to *unknown* rather than guess.
- **What is the list?** Rail, highways, tunnelling, building, fitout, water, power,
  marine, shutdown/turnaround, oil and gas. Depth matters: too coarse and the facet
  does not narrow anything, too fine and every bucket has one programme in it.
  Launch stock is authored sector templates, so this list also decides what gets
  authored.
- **One sector or several?** A depot extension is rail *and* building *and* civils.
  A single value is cleanly facetable; multiple values need a join table and change
  the column decided in the derived contract.
- **Is it mutable?** If an uploader mislabels, can they or anyone fix it later, and
  does that count as a new revision or an edit in place?
- **What renders when it is absent?** Every pre-existing programme and every
  inference failure needs a defined display, and "Uncategorised" as a browse facet
  is a shelf nobody visits.

Cross-check against [Browse, search, filter and ranking](009-browse-search-ranking.md)
before fixing the list — if sector is not actually how planners want to narrow the
shelf, this column is decoration and the honest answer is to drop it.

### Already fixed by [Upload and ingest pipeline](011-upload-ingest-pipeline.md)

The upload flow reserved a slot for this without pre-empting it:

- **The control is a dropdown over the `sector` lookup table**, on the metadata screen.
  If this ticket lands on inference, inference **prefills the dropdown** rather than
  replacing it — so "derived", "declared" and "derived but overridable" are all still
  open, and all three ship the same control.
- **Sector is optional at upload.** An upload is never blocked on it, per 005's
  nullable column. So "what renders when it is absent" is not an edge case to design
  around — it is the guaranteed state of every upload by someone who did not care.
- **On a fork, sector prefills from the parent** along with title and description
  (005), which means an inference model inherits its parent's answer for free on the
  fork path and has to be right only on roots.
- Since 011's rejections all fire in the browser before upload, **a sector control that
  needed a server round trip would be the only thing on the screen that did**. Worth
  weighing if inference is server-side.

## Resolution

**Declared, single-valued, asset class, eight codes. Nothing is inferred and nothing
new is added to the schema.**

The ticket asked six questions and offered a seventh — drop the column entirely. The
cross-check it demanded answers that one first, and against dropping:
[Browse, search, filter and ranking](009-browse-search-ranking.md) found that **at launch
sector is the only facet doing real work** — size will cluster, `p6_version` holds one
value, `progressed` reads 0% across authored stock. Sector is not decoration; it is the
shelf's organising idea, and it is the only one of the four facets that discriminates on
day one.

### 1. Declared, not inferred

The uploader picks from the fixed list. **No inference in v1**, not even as a prefill.

The ticket suspected inference was viable because activity codes and WBS names carry
sector vocabulary in practice. Two facts kill it as v1 work, and neither is about
difficulty:

- **There is no evaluation corpus and there never will be one.** This effort has two real
  programmes ([Fixture A and Fixture B](001-get-real-xer-files.md)), both from the same
  sector, and [Stack, hosting and auth provider](010-stack-hosting-auth.md) made real
  fixtures gitignored *forever* — so an inference lexicon could be tuned against exactly
  two files and regression-tested against none. A classifier that cannot be tested is not
  a feature, it is a liability with a confidence score attached.
- **It degrades to unknown on real files.** Fixture B is `PROJWBS = 1` — one WBS row, no
  tree, no text to mine. The ticket already anticipated this and required degradation to
  *unknown* rather than a guess; what it did not anticipate is that the degraded case is
  **half the available evidence**, not an edge.

The ticket's own worry about inference — that a server-side model would be the only thing
on the upload screen needing a round trip — turns out to be **false**, and it is worth
recording why, because it is the argument that would have made inference cheap: 010 made
the parser **isomorphic** and [Upload and ingest pipeline](011-upload-ingest-pipeline.md)
parses the file **in the browser before a byte is uploaded**, so a keyword pass over WBS
and code names would run client-side for free. Inference was rejected on **being
untestable and wrong at the edges**, not on cost. That distinction matters if anyone
revisits this once a real corpus exists: the plumbing is already there, and the only
missing input is programmes to validate against.

The consequence is deliberate and follows the map's **no warranty** standing decision:
where the site cannot know something, it says nothing rather than guessing plausibly.

### 2. One axis: asset class

The ticket's draft list mixed two axes — **asset class** (rail, highways, water, power,
marine, oil and gas) and **work type** (fitout, shutdown/turnaround). A single-valued
column over a mixed axis has no right answer for a rail depot fitout, so the uploader's
coin-flip becomes the facet's noise, and 009's conjunctive counts blur two questions into
one number.

**The axis is asset class: what is being built or maintained.** Work-type words —
tunnelling, fitout, shutdown, turnaround, design phase, framework, look-ahead — are
**not sectors** and go in the title and description, where 009's Postgres FTS over
title + description finds them. This is the same disposal 009 chose for the
cross-cutting attributes it cut with tags, so nothing new is being asked of search.

Note this rules out **tunnelling as a sector**, which reads oddly to a planner: a tunnel
is rail, or highway, or water. Tunnelling is a method, and a method on the asset-class
axis is the mixed-axis bug in miniature.

### 3. The list: eight codes, grown by insert

| `code` | `label` | `sort_order` |
|---|---|---|
| `rail` | Rail | 10 |
| `highways` | Highways & roads | 20 |
| `aviation` | Aviation | 30 |
| `marine` | Marine & ports | 40 |
| `building` | Buildings | 50 |
| `water` | Water & wastewater | 60 |
| `power` | Power & energy | 70 |
| `process` | Oil, gas & process | 80 |

Ordered transport → vertical → utilities → process, not alphabetically; `sort_order`
exists in 005's DDL precisely so the chip row reads as related things sitting together.

**Lean, because growing is cheap and merging is not.** Adding a code is an insert
([Domain model and schema](005-domain-model-and-schema.md) chose a lookup table over a
Postgres `enum` for exactly this), and 009 **disables zero-count facet chips**, so an
unoccupied code renders greyed rather than as a dead shelf. Renaming or merging codes
after programmes are filed under them is the expensive move — it rewrites rows and breaks
any `?sector=` URL already shared. So the list starts narrower than the eventual corpus
and grows on evidence.

Codes deliberately **not** shipped, and reachable by insert the day a real upload needs
one: `industrial`, `telecoms`/`data-centre`, `nuclear`, `mining`, `defence`.

### 4. Single-valued — 005's provisional column, now confirmed

005 chose single-valued because 009 had not yet picked a facet model; that reason has
expired, so here is the durable one: **the asset-class axis dissolves the ticket's own
counter-example.** A depot extension is `rail` — its building work is a description
sentence, not a second sector. Multi-value would make facet counts sum past the row count,
reopen 009's OR-within/AND-across model, and add a join table to a facet that discriminates
fine without one.

**Rejected: a secondary non-facetable sector.** A value nobody can browse by is
decoration, which is the failure mode this ticket was explicitly told to test for.

### 5. Mutable: the owner edits it in place, like the title

Sector sits on **Programme** — identity — and Revisions are **immutable content**. So a
sector correction cannot be a revision: a revision is a new *file*. It is an in-place edit
of Programme metadata, alongside title and description (005: *"titles are editable and
owners rename"*), with the slug staying frozen as 005 fixed it.

- **No audit table.** The only plausible consumer is an operator investigating gaming, and
  no ticket has raised that; adding a history table now is speculative schema.
- **Operator override** — correcting somebody else's mislabel — is real but belongs to
  [What tooling does the operator need to run a takedown?](017-operator-takedown-tooling.md),
  which owns operator surfaces. This ticket demands no admin UI.
- **A fork may carry a different sector from its parent.** This was already true under
  011's prefill-as-*default* rule; it is hereby intentional rather than accidental. A
  tender variant re-scoped from `building` to `process` is a legitimate fork, not a
  data error.

### 6. Absent: `unsectored` on the row, no chip in the facet

Sector is nullable and **optional at upload** (011), which the ticket read as an edge case
to design around. It is the opposite. **Blank is the guaranteed state of every upload by
someone who did not care**, so at launch the blank bucket is plausibly the *largest* one —
inverting the ticket's fear that "Uncategorised" would be a shelf nobody visits.

That inversion is the argument against exposing it. A chip that tops the counts advertises
the catalogue's own untidiness at the moment it is worst, and nobody browses for *unknown
kind of job*.

- **Facet lists the eight codes only.** No `sector=none`, no ninth chip.
- **Blank programmes are fully reachable** — they appear in the default unfiltered shelf
  (newest-first, which 009 froze) and in search. They are absent only when a sector filter
  is applied, which is the correct reading of that filter.
- **The row keeps 007's `unsectored` badge**, in the fixed slot the prototype already
  seeded as a degenerate case — [The storefront card and browse grid](007-storefront-card-and-grid.md)
  forbids anything in a row from flowing, so the slot renders the word rather than
  collapsing.
- **The detail page breadcrumb collapses.** [The project detail page](008-project-detail-page.md)
  specifies `shelf / {sector} / {title}`; with no sector it is `shelf / {title}`, and the
  byline drops the sector segment rather than printing a placeholder.
- **Rejected: hiding blank programmes from the shelf.** It silently buries valid uploads
  and makes *"my upload vanished"* the first support question.

### 7. The list lives in the repo

`sector` rows are **seeded from a versioned file in the repo and applied by migration** —
adding a code is a PR and a deploy, not a hand-written `INSERT` on production.

This does not contradict 005's *"an insert, not a migration"*: that phrase was about
avoiding a **Postgres `enum` type change**, and it still holds — the DDL never changes.
What changes is a seeded row. The reason to version it is
[Local development and contributor onboarding](018-local-dev-and-onboarding.md): a public
repo whose local shelf has different sectors from the live one makes every contributor's
screenshot subtly wrong, and there is no admin UI in v1 to reconcile them.

### 8. No launch-stock quota

The ticket noted that this list *"also decides what gets authored"*. It does **not** — the
dependency is refused in that direction.

Launch stock is authored sector templates, and requiring one per code would force eight
hand-built P6 programmes, in sectors the operator may have no domain judgement in, to buy
shelf symmetry with fabricated content. 009's zero-disabled chips make an uncovered code
read as *nothing here yet*, which is true. So the map's fog patch on **how authored sector
templates get made** inherits a free choice from this ticket rather than a quota of eight.

### Schema demand: none

Everything above is already in 005's DDL:

```sql
sector text references sector(code)              -- on programme, nullable
create table sector ( code text primary key, label text not null, sort_order int not null );
```

The eight rows are seed data. `derived.json` is untouched — sector is a Postgres column
that the grid reads directly, so this decision costs **zero blob bytes and no backfill**.

### Consequences for closed tickets

- **005** — the nullable-and-single decision is confirmed on durable reasons; the "015 may
  land on derived" hedge in its Sector section is now settled as *declared*. The lookup
  table gains eight seed rows and no DDL change.
- **009** — the Sector facet's *"fixed list, already FK'd"* now names its eight members;
  the facet ships with no blank chip, which is a specification of the zero-count rule
  rather than an exception to it.
- **007** — the `unsectored` badge the prototype seeded is confirmed as the permanent
  rendering, not a placeholder.
- **008** — breadcrumb and byline need a defined null path: both drop the sector segment.
- **011** — the reserved dropdown ships as declared-only over the eight seeded codes, with
  no inference prefill and no server round trip. Fork prefill stays a default that may
  diverge.

### What this deliberately leaves open

Inference is **not** ruled out of the effort — it is ruled out of v1 for want of a corpus.
The machinery it would need (an isomorphic parser running over the whole file in the
browser) already exists, so revisiting it is a lexicon plus an evaluation set, not
plumbing. That is a post-launch question and not fog on the way to `docs/spec.md`.
