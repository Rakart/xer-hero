---
id: 036
title: Recheck the lag and non-FS exposure figures against their source
type: task
status: closed
assignee: carlo
blocked_by: []
---

## Question

[022](022-generator-longest-path-and-landmines.md)'s asset,
[028](028-driving-test-relationship-types.md)'s body and
[014](014-compute-critical-path.md) decision 4 all carry the same exposure table:

| | non-FS relationships | lagged relationships (014 decision 4) |
|---|---|---|
| Fixture A | 0.4% | 8.8% |
| Fixture B | 10.5% | 0.3% |

The right-hand column appears to be **transposed**. Its source is
[the derived contract's DCMA measurement](assets/derived-json-contract.md), whose table is
headed `| # | Check | Fixture B tender | Fixture A update |` and whose row 3 reads
`| 3 | Lags | 8.8% ❌ | 0.3% ✅ |` — so lags are **8.8% of Fixture B and 0.3% of Fixture A**,
the opposite of what all three documents state.

The non-FS column in the same table is read *correctly*: row 4 gives `89.5% FS` for
Fixture B and `99.6%` for Fixture A, which is exactly the 10.5% / 0.4% recorded. 022's own
relationship counts confirm it independently (Fixture A `PR_FS` 2,813 of 2,825 = 0.4%
non-FS; Fixture B `PR_FS` 5,267 of 5,883 = 10.5%). So exactly one row of one table is read
from the wrong column, and it has propagated to three places plus the map.

**Why it matters is not tidiness.** 028 was filed on the argument that the two
approximations in decision 4 land on **opposite fixtures** — non-FS logic on B, lags on A —
and that 014 decision 9's ship gate measures **Fixture A only**, so the gate is blind to the
non-FS defect. If lags are 8.8% of B and 0.3% of A, then both approximations sit on **Fixture
B** and Fixture A has neither in quantity, which is a different argument with a different
consequence for the gate: it would mean Fixture A is a weak gate for *both* named residues
rather than for one of them.

Settle:

- **Is the transposition real?** Read `derived-json-contract.md`'s table headers and row 3
  directly, and if possible re-derive the lag percentage from the recorded relationship
  counts the way 022 re-derived the non-FS one. One of the two documents is wrong and it
  should be said which.
- **What does the correction do to 014 decision 9's gate?** If both residues are
  Fixture-B-shaped, the "gate measures Fixture A only" observation gets *worse*, not better —
  and 028 already decided the gate needs no second fixture, on three grounds that do not
  obviously depend on which fixture carries the lags. Confirm they survive, or say which one
  does not.
- **What does it do to 028's own conclusion?** Probably nothing: the per-type rule was
  adopted because it is free and correct, not because of where the exposure sat. But the
  *urgency* argument changes, and 028's resolution should say so rather than leave a reader
  deriving the contradiction.
- **Where does the correction get written?** 014 decision 4's named limitation, 022's asset
  table, 028's opening table, and the map's 014/022/028 entries all carry the figure. This is
  a correction to closed reasoning in four places, which is why it is a ticket rather than an
  edit.

Found by [032](032-generator-free-float-by-type.md) while sweeping landmine strings for
drifted numbers — the same reading exercise, one document further out. No code, no fixture,
no regeneration.

## Resolution

**The transposition is real. `derived-json-contract.md` is right and the other three
documents are wrong.** Verbatim from
[the derived contract's DCMA measurement](assets/derived-json-contract.md), section
*Measured against both fixtures*:

```
| # | Check | Fixture B tender | Fixture A update |
|---|---|---|---|
| 3 | Lags | **8.8%** ❌ | 0.3% ✅ |
| 4 | Relationship types | **89.5% FS** ❌ | 99.6% ✅ |
```

Column 3 is **Fixture B**, column 4 is **Fixture A**. Lagged relationships are **8.8% of
Fixture B and 0.3% of Fixture A**. Non-FS logic is 10.5% of B and 0.4% of A, exactly as
recorded — so one row of one table was read across, and the row beneath it was not.

Three independent checks on the column orientation, none of which depends on the header:

1. **Arithmetic.** 022's relationship counts reproduce row 4 to the decimal in the printed
   order: Fixture B `PR_FS` 5,267 of 5,883 = **89.53%**, Fixture A `PR_FS` 2,813 of 2,825 =
   **99.58%**. There is no reading under which those two land the other way round.
2. **A fact fixed elsewhere.** Row 7 is `| 7 | Negative float | 0% ✅ | **69.0%** ❌ |`, and
   009 records DCMA "failing the real live contract (69% negative float)". Fixture A is the
   live contract programme (001); Fixture B is four tender variants, 100% not started. The
   69% sits in column 4.
3. **Internal coherence of the fixtures.** Leads and lags are the sign of one column,
   `TASKPRED.lag_hr_cnt`. The correct reading gives Fixture B 6.2% leads with 8.8% lags and
   Fixture A 0% leads with 0.3% lags — a compressed tender network and a disciplined monthly
   update. The transposed reading requires Fixture A to use no leads but 8.8% lags while
   Fixture B uses 6.2% leads and almost no lags, which is not a shape a planner produces.

Re-deriving the lag percentage from counts the way 022 did for non-FS is **not possible from
this repo**: no lagged-relationship count is recorded anywhere, only the percentage, and the
fixtures are gitignored forever (010). The three checks above are what is available, and they
agree.

**How the error was available to make**, which is worth recording because the source document
is unchanged and will be read again: `derived-json-contract.md` has **two fixture tables in
opposite column orders**. Its *Evidence base* table at the top is headed
`| | Fixture A | Fixture B |`; the DCMA measurement table 240 lines later is headed
`| # | Check | Fixture B tender | Fixture A update |`. A reader who has internalised the
first reads the second backwards, which is exactly what happened to one row.

### What it does to 014 decision 9's gate

Corrected, Fixture A carries **0.4% non-FS logic and 0.3% lagged relationships** — about
twelve and about eight relationships in 2,825. The only fixture the gate measures carries
**neither** of decision 4's two named approximations in quantity. Both are Fixture-B-shaped.

**The gate does not change, and 028's answer stands.** Of its three grounds:

1. *No second real fixture could serve* — **survives and strengthens.** The programme worth
   measuring and the programme that cannot measure are now emphatically the same one:
   Fixture B carries both residues and offers one flagged activity in 3,344 as its oracle.
2. *Promoting the synthetic corpus would break decision 8 for nothing* — **survives
   untouched.** It is an argument about the provenance of ground truth and never referred to
   a fixture's exposure.
3. *The blindness was the rule's hole, not the gate's* — **survives as written, and does not
   extend.** It was said about the non-FS hole, which is closed by construction and held
   closed by `logic-nonfs-drivers` in CI. The lag residue is not closed — 028 built and
   rejected the shift-boundary repair at 98.1% → 92.9% — so there the blindness genuinely is
   the gate's, at ~8 relationships in 2,825.

So the conclusion holds on grounds 1 and 2, which were always the load-bearing ones. What
does not survive is a sentence nobody listed as a ground: **014 decision 4's own claim that
the lag limitation "surfaces as oracle disagreement under decision 9 rather than hiding"**.
That was true only under the transposed reading and is withdrawn. The residue does still
reach Fixture A, but through 028's widening of it — a finish instant compared against a start
instant on a **zero-lag** relationship — and that path is unquantified on Fixture A. The
honest statement is that the gate tells us whether we are broken, and is a weaker instrument
than 028 believed when it decided it needed no second fixture.

**028's own conclusion is unaffected.** The per-type rule was adopted because it is free and
correct. Its filing argument also survives, because the operative half — non-FS logic is 0.4%
of Fixture A, so the gate passes either way — was read from the column that was correct. Only
the *opposite fixtures* framing dies, and it dies in the direction that makes the point
sharper: the two approximations were not hiding in different places, they were hiding in the
same one.

### Where the correction was written

Corrected in place, with the old figure quoted in a dated correction note beside each, since
these are closed tickets:

- [014](014-compute-critical-path.md) decision 4's named limitation, plus a note on decision
  9's *What the gate does not measure*.
- [022](022-generator-longest-path-and-landmines.md) *Two surprises*, and its asset
  [driving-path-corpus.md](assets/driving-path-corpus.md) — the table and the header block.
- [028](028-driving-test-relationship-types.md)'s opening table, and its *ship gate does not
  need a second fixture* section, which is the only place the correction changes an argument
  rather than a number.
- [032](032-generator-free-float-by-type.md)'s filing note, confirmed rather than corrected.

028's asset [driving-test-relationship-types.md](assets/driving-test-relationship-types.md)
carries only the non-FS figure (Fixture B's 10.5%) and needed no change. A sweep of `docs/`,
`tools/` and `fixtures/` for 8.8, 0.3, 10.5 and 0.4 in this sense found no other occurrence;
the remaining hits are unrelated (013 and the PI audit's *under 0.3% of the free-text bytes*,
004/011's *under 0.4% of rows* between Fixture B's tender siblings, and DCMA row 8's 18.8%).

**The map's 014 and 028 entries still carry the transposed figure** in three places and are
left for the integrating session, per this ticket's instructions.

No code, no fixture, no regeneration — as filed.
