---
id: 003
title: Licensing, attribution and takedown
type: grilling
status: closed
assignee: carlo
blocked_by: []
---

## Question

Everything on this site is public the moment it is uploaded. Under what terms?

This is takeable now and independent of the technical work, but it is not
optional: it decides fields on the schema (licence, attribution, provenance),
copy on the upload flow, and what the fork button is actually permitted to do.

Settle:

- **What licence covers an uploaded programme?** A fixed site-wide licence, or a
  per-upload choice from a short list (CC0, CC-BY, CC-BY-SA)? A fixed licence is
  simpler and makes forking unambiguous; a choice is friendlier to contributors
  but means the fork button must reason about licence compatibility.
- **What does the uploader have to assert?** That they hold the rights, that the
  programme contains no confidential third-party data. Where does that assertion
  live — a checkbox, the ToS, both?
- **How does attribution work on a fork?** The parent link is in the schema
  already; does the licence require more (named credit, retained notices)?
- **What is the takedown path?** Someone will publish a programme they should not
  have. Who can request removal, how, and what happens to revisions and forks
  downstream of the removed content — cascade, orphan, or tombstone? The answer
  constrains whether deletes can ever be hard deletes.
- **Does the *code* licence differ from the *content* licence?** They are separate
  questions and the repo is public. Pick the code licence here too.
- **Is there a ToS and privacy policy at all in v1?** Google sign-in means storing
  personal data; decide what the minimum honest position is.

Not legal advice territory — the goal is a defensible, clearly stated position and
the schema fields it implies, with anything genuinely needing a lawyer flagged as
such.

## Resolution

Two licences, one fixed each: **code Apache-2.0, uploaded programmes CC-BY 4.0.**
Everything below follows from that pair plus one structural choice — the public
identity of an uploader is a **pseudonym, snapshotted at upload**.

### The content licence

**Fixed site-wide CC-BY 4.0.** No per-upload choice.

- A per-upload list (CC0 / CC-BY / CC-BY-SA) makes the fork button reason about
  licence compatibility — an SA parent forces an SA fork, a CC0 fork may be
  relicensed, and the UI has to explain it. That is a feature, not a dropdown.
- `.xer` is closer to a **database** than to prose. CC-BY 4.0 covers sui generis
  database rights explicitly; looser choices do not.
- CC0 drops credit, which fights the fork graph and the leaderboard. CC-BY-SA
  deters the commercial reuse that is most of this audience.
- Store `licence` per programme anyway (`CC-BY-4.0` for every v1 row). Costs
  nothing now; means a future licence change never retroactively rewrites what a
  past uploader agreed to.

**The site needs no separate licence grant from uploaders.** CC-BY 4.0 already
permits storing, serving and producing derivatives, so `derived.json` and every
computed stat are covered. No "you grant xer-hero a worldwide royalty-free
licence to…" clause in the ToS — one less thing to write and one less thing to
argue about.

### What the uploader asserts

**One checkbox per upload**, three claims in the label:

1. I own this programme or have permission from whoever does to publish it.
2. It contains no confidential or commercially sensitive third-party information.
3. I licence it to everyone under CC-BY 4.0, **irrevocably**.

- **Per upload, not per account.** Each upload is a distinct rights claim about a
  distinct file; an account-level acceptance from eight months ago is worthless
  evidence that anyone considered *this* file. Every revision and every fork
  upload re-asserts.
- **Snapshot `terms_version` and `asserted_at` on the row** — the version of the
  text agreed to, not a boolean. This is the only thing that matters if an upload
  is ever disputed.
- One checkbox, not three. Three reads as legalese theatre and gets clicked just
  as thoughtlessly; the honest work happens on the pre-publish screen, which
  belongs to [Personal data in published .xer files](013-personal-data-in-published-files.md).
- Claim 3's irrevocability is load-bearing — it is the sentence that makes
  Class A takedown (below) defensible when an uploader is annoyed about it.

### Attribution and forks

**The site generates attribution; the file is never touched.**

- The format has exactly five record markers (`ERMHDR`, `%T`, `%F`, `%R`, `%E`)
  and **no comment mechanism** — see [How is a .xer file structured?](002-xer-file-structure.md).
  There is nowhere safe to inject an attribution line, and doing so would break
  byte-identical round-tripping. Downloads serve original bytes. This also leaves
  [Personal data in published .xer files](013-personal-data-in-published-files.md)
  free to decide verbatim-vs-strip without fighting an attribution injection.
- **On-site forks satisfy CC-BY automatically.** The fork page renders the
  attribution block from lineage already in the schema: original uploader's
  display name, link to parent, `CC-BY-4.0`, and "modified from" (CC-BY 4.0
  requires indicating changes). The uploader never types a credit line, so cannot
  get it wrong.
- **Full ancestry chain is rendered**, not just the immediate parent — A → B → C.
- **Every programme page carries a "Cite this programme" block**: a copy-paste
  attribution string in the CC-BY-recommended shape. Off-site reuse obligation is
  the reuser's, as with any CC-BY work; the site's job is making the correct
  string one click away, not policing it.

### Identity

**No anonymous uploads. Pseudonymity by default.**

- CC-BY lets a licensor request not to be credited; supporting that means a ghost
  entry on the leaderboard and a hole in the fork chain. The leaderboard makes
  credit the point of the system, so anonymity fights the feature.
- **Google is the auth mechanism, not the public identity.** `display_name` is
  user-chosen at first upload. The Google real name and email are never shown
  publicly, anywhere.
- **`uploader_display_name` is snapshotted onto each programme row**, deliberately
  duplicated from the user record. A live join means renaming an account silently
  rewrites credit on every past upload, and a deleted account blanks it. The
  profile name may change and the leaderboard follows it; each programme keeps the
  name as it stood at upload ("uploaded by oldname, now newname").

### Takedown

**Split by reason — the downstream answer differs, and conflating the two is the
classic mistake.**

**Class A — voluntary withdrawal.** The uploader wants their own programme off.

- Programme is **tombstoned**: the page stays at its URL showing "withdrawn by
  uploader", blob bytes are deleted, the row is retained.
- **Title and uploader stay visible** on the tombstone.
- **Forks are untouched.** The grant was valid when taken and CC-BY is
  irrevocable, so downstream forks keep their rights.

**Class B — rights, confidentiality or personal-data complaint.** Someone says it
should never have been published.

- The grant was **never valid**, so every fork carries the same tainted content.
- Removal **cascades down the fork subtree**; each descendant is tombstoned and
  its bytes deleted.
- This is why fork lineage must be queryable as a **tree**, not just a parent
  pointer.

**Shared mechanics:**

- **Bytes hard-delete; rows never do.** The blob and `derived.json` are destroyed;
  the row survives as a tombstone carrying `status`, `removal_class`,
  `removed_at`. Deleting the row would punch a hole in the ancestry chain.
  *This is the answer to "can deletes ever be hard deletes": bytes yes, rows no.*
- **Granularity is the revision, not the programme.** If revision 5 is tainted,
  revision 5 goes and the series survives; the cascade follows forks taken from
  that revision.
- **Anyone can report, no account required.** A rights holder finding their
  programme here will not sign in with Google to complain. Public email address
  plus a form.
- **One operator adjudicates, best effort, no SLA promised** — stated honestly
  rather than pretending there is a process. Appeal is by email to the same
  operator.
- **Leaderboard:** a tombstoned programme stops contributing to contributor
  standing in both classes; Class B additionally voids its votes.

### The code licence

**Apache-2.0.**

- Express **patent grant**; MIT has none, and it costs nothing to have.
- **§5 makes contributions inbound under the same licence**, so no CLA is needed
  to accept a PR — the practical win for a public repo with a solo maintainer.
- Not copyleft. AGPL would be the anti-clone choice, but the moat is the corpus of
  uploaded programmes, not the parser; AGPL buys little and deters contributors.
- No contamination risk: we write our own TS parser precisely because xerparser is
  GPL-3.0 and MPXJ is LGPL/Java. Apache-2.0 stays clean and is one-way compatible
  with GPL-3.0 downstream.
- README states both licences plainly, so there is no ambiguity about which covers
  what.

### ToS and privacy policy

**Both exist in v1, minimal, versioned as markdown in the repo** —
`docs/legal/terms-v1.md`, `docs/legal/privacy-v1.md`. The `terms_version`
snapshotted on each upload must point at a real immutable artifact or the snapshot
proves nothing; repo history *is* the audit trail.

- **Privacy policy names exactly:** the Google account id, email and chosen display
  name are stored; email is used for account identity and takedown correspondence
  only and is never shown publicly; no sale, no ad tech; whatever analytics exist
  are named rather than glossed.
- **ToS carries the long form** of the three upload claims, the CC-BY grant, the
  A/B takedown policy, and an "operated by one person, best effort, no warranty"
  clause.

**Account deletion vs uploads** — the decision with teeth:

- The **account record is deleted** (Google id, email, auth linkage).
- **Uploads stay published.** The licence was irrevocably granted and forks depend
  on it.
- **The snapshotted pseudonym stays**, now unlinked to any account.
- This works *because* the public identity is pseudonymous by design. Erasing the
  account erases the personal data; the handle left behind is not personal data.
  Were the display name the Google real name, this position would collapse — the
  strongest argument for pseudonymous-by-default.
- Stated up front in the privacy policy, so nobody discovers it at deletion time.
- A user who wants their content gone as well uses Class A withdrawal **first**,
  then deletes the account. Two separate acts, both available.

### Re-uploading someone else's programme

Person B downloads person A's CC-BY programme and uploads it as a **new root**
with themselves as uploader. That is a licence violation, and it corrupts the
leaderboard — which people now have a reason to game.

- **Hash the raw bytes at ingest. A matched hash cannot become a new root.** The
  upload is offered as a **fork** of the match instead: lineage preserved, credit
  correct, leaderboard honest.
- If the hash matches a programme **the same user** already uploaded, it is a
  no-op or a new revision — their choice.
- **Near-duplicates slip through** (re-exported from P6, different bytes, same
  programme). Accepted for v1: exact-hash catches lazy re-upload, the common case,
  and anything cleverer needs a similarity model nobody has specified.
- Position stated here; implemented by
  [Upload and ingest pipeline](011-upload-ingest-pipeline.md).

### Schema fields this fixes

On the programme/revision row:

| Field | Purpose |
| --- | --- |
| `licence` | `CC-BY-4.0` for every v1 row; exists so a future change is not retroactive |
| `terms_version` | Which version of the ToS text was accepted for *this* upload |
| `asserted_at` | When the checkbox was ticked |
| `uploader_display_name` | Snapshotted pseudonym; deliberately duplicated from the user record |
| `status` | `published` \| `tombstoned` |
| `removal_class` | `A` (voluntary withdrawal) \| `B` (rights/confidentiality/PI) |
| `removed_at` | When it was tombstoned |
| `content_hash` | Raw-byte hash; blocks a matched file from becoming a new root |
| parent link | Already planned; must support **subtree** queries for Class B cascade and full-ancestry rendering |

On the user record: `display_name`, separate from the Google profile name, which
is never public.

### Flagged as genuinely needing a lawyer

- Whether the site qualifies for hosting-provider liability protection (UK/EU),
  and whether publishing a formal notice-and-takedown procedure is a condition of
  keeping it.
- Whether the CC-BY grant survives a UK GDPR erasure request in the form described
  above. The position taken here is defensible; it has not been reviewed.

### What this hands to other tickets

- [Domain model and schema](005-domain-model-and-schema.md) — the field table above,
  and the requirement that fork lineage supports subtree queries.
- [Upload and ingest pipeline](011-upload-ingest-pipeline.md) — content-hash check,
  hash-blocks-root routing to fork, the per-upload checkbox and its snapshot.
- [Personal data in published .xer files](013-personal-data-in-published-files.md) —
  downloads serve original bytes as far as *attribution* is concerned, leaving that
  ticket free to decide verbatim-vs-strip on its own merits; Class B takedown is the
  removal path for a personal-data complaint.
- [Credit, upvotes and the contributor leaderboard](016-credit-upvotes-leaderboard.md) —
  public durable pseudonymous identity, and the rule that tombstones stop
  contributing to standing.

Drafting the two legal documents is **build work, not a decision** — every position
they state is settled here, except the privacy policy's personal-data section,
which waits on [Personal data in published .xer files](013-personal-data-in-published-files.md).

### Amendment 2026-08-08 — [Credit, upvotes and the contributor leaderboard](016-credit-upvotes-leaderboard.md)

**The tombstone rule above is superseded by a mechanism, not contradicted.** This ticket
fixed that *a tombstoned programme stops contributing to contributor standing in both
classes, and Class B additionally voids its votes*. That sentence assumed standing flows
**through** programmes. 016 made the uploader itself votable as a second, independent
object, and the leaderboard reads that counter alone — so a direct uploader vote is
untethered from any artifact, and Class B'ing every programme someone owns would leave
their rank untouched. The operator's enforcement lever would have stopped at programmes
while the board this ticket flagged as newly worth gaming became unreachable.

The replacement is an **eligibility gate**: an uploader whose published, non-tombstoned
Programme count reaches zero is delisted from the board, votes retained but not ranked,
relisted on publishing again. Partial takedown deliberately does nothing. **Class B still
voids a Programme's votes**, unchanged — and that machinery is now the whole of the
manual anti-gaming lever, because 016 defends the board by hand rather than by algorithm,
on this ticket's own one-operator/best-effort/no-SLA posture.

Two positions here are load-bearing for 016 and survive intact. **Hash-blocks-root** stops
the laziest standing farm, and its residual gap narrows: bulk uploads of near-duplicates no
longer move the board at all under a split counter, so near-duplicate detection is a shelf
and takedown-evasion question rather than a leaderboard one. And **snapshotted
`uploader_display_name` versus a live Handle** now has a clean split — uploader votes attach
to the account, so the board follows a rename, while each Programme keeps the name it was
uploaded under.

### Amendment 2026-08-08 — [What tooling does the operator need to run a takedown?](017-operator-takedown-tooling.md)

Four changes. Three soften promises this ticket made too absolutely; one adds a defence it
did not know it needed.

1. **"Bytes hard-delete" was not true as written.** 004 serves blobs under
   `Cache-Control: public, max-age=31536000, immutable`, so deleting the R2 object leaves
   the file downloadable from a public unsigned URL for up to a year. Takedown gains a
   **fourth step — a verified Cloudflare purge** — and `original.xer.gz` drops to a 1-hour
   TTL so a failed purge self-heals rather than persisting for twelve months.
2. **Class B bytes are quarantined 30 days before destruction.** This ticket fixed that
   *anyone can report, no account required* — correct, but it means an unauthenticated
   stranger can trigger the permanent destruction of a stranger's programme and every fork
   of it, adjudicated by one person. 017 treats that as a griefing vector and buys an undo
   window. Only `original.xer.gz` is held; 006 rebuilds the rest. After 30 days a mistaken
   Class B is genuinely unrecoverable, stated plainly. Class A needs no quarantine.
3. **The hash-blocks-a-new-root rule is scoped to Class B.** 011 implemented this ticket's
   rule as a hard reject against any tombstoned Revision's hash, which meant **an owner who
   withdrew their own programme by mistake could never re-upload that file**. Class A is
   voluntary and the owner holds their own copy; the permanent block was defending against
   takedown evasion, which is a Class B concern. Class B's block stays permanent.
4. **Intake becomes a row, and the promise of "public email plus a form" is honoured
   differently than assumed.** 010 removed email from the system entirely, so the form
   cannot mail anyone. It writes a `takedown_report` row instead — the system of record,
   carrying the adjudication this ticket asked about — and the published mailbox remains a
   second channel, transcribed into a row by hand. Reporter contact is stored but **purged
   90 days after the case closes**, which is a fourth privacy-policy addition.

**Tombstone copy is fixed and gains a third variant.** Class A keeps *withdrawn by
uploader*. Class B carries a neutral line with **no case reference and no complainant** —
publishing the case id invites correlation, and naming a complainant in a personal-data
case would republish the data the takedown was for. Cascaded forks get their own line,
because 005 made the cascade unconditional below a tainted Fork and those owners are not
accused of anything.

**One thing this ticket implied that 017 declined to deliver:** there is **no operator
correspondence in the Class B flow**. Blameless fork owners are not told their work was
destroyed; they learn by visiting. The gap is recorded against the map's *signed-in user's
own space* fog rather than solved with a mailbox this operator would not keep up with.
The Clerk-lookup path survives, used only for the optional cleaned-revision softener.

**The leaderboard clause is now near-inert.** 016 moved standing off Programmes, so Class
B's vote-voiding is executed for consistency with this ticket rather than because it
defends anything.
