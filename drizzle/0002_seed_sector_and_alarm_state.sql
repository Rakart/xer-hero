-- The two data sets that are seeded by migration rather than written by the app.

-- The sector taxonomy (§1.6). Adding a code is a seeded row applied by migration from the
-- versioned list in `src/lib/contracts/domain.ts` — a PR and a deploy, never a hand-written
-- INSERT on production. `src/lib/db/seed-migration.test.ts` fails if this list and that one
-- ever disagree.
--
-- `sort_order` runs transport -> vertical -> utilities -> process, deliberately NOT
-- alphabetically, so the chip row reads as related things sitting together. There is no
-- `unsectored` code and no ninth chip: a blank sector is a null column, not a row here.
--
-- `on conflict do nothing` because the driver has no interactive transaction and a migration
-- that fails half-way is re-run rather than rolled back.
insert into sector (code, label, sort_order) values
  ('rail',     'Rail',               10),
  ('highways', 'Highways & roads',   20),
  ('aviation', 'Aviation',           30),
  ('marine',   'Marine & ports',     40),
  ('building', 'Buildings',          50),
  ('water',    'Water & wastewater', 60),
  ('power',    'Power & energy',     70),
  ('process',  'Oil, gas & process', 80)
on conflict (code) do nothing;
--> statement-breakpoint
-- The five alarm rules (§2.10, §5.10). Exactly five rows, and every future rule is another
-- migration — kept deliberately, because the seeded set is an inventory `/ops` renders rather
-- than a log, and upsert-on-first-run would hide a rule from the dashboard until it had
-- successfully run once, which is the wrong behaviour in exactly the case where you want to
-- see it.
insert into alarm_state (rule) values
  ('takedown_open'),
  ('deterministic_failure'),
  ('transient_burst'),
  ('reconciler_stuck'),
  ('edge_drift')
on conflict (rule) do nothing;
