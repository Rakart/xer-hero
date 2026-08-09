#!/usr/bin/env node
// Generate the dev catalogue — the ~40 programmes a fresh clone browses (§4.9).
//
//   node tools/dev-catalogue/generate.mjs
//
// Deterministic from seeds and NOT committed, exactly like the perf fixtures. It writes
// `.xer` bytes plus a `manifest.json` naming the row states the seed script must build,
// because the interesting half of the dev catalogue is not in any file: a monthly revision
// series, a set of fork siblings, tombstones under both classes, a `failed` row, and the
// vote and bookmark counts. No generated `.xer` can produce those.
//
// **Reusing the committed test corpus for this was rejected to protect the corpus.** Those
// files exist to *fail* — mojibake, missing calendars, no WBS, 20 activities each — and the
// moment the test corpus is also the demo corpus, someone tunes it to look presentable.
//
// This tool stays dependency-free plain Node ESM, like `tools/fixture-gen` (§10.12). Sector
// is assigned by the seed script, not here: it is a product fact the uploader declares, and
// nothing in a `.xer` implies one.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { synthesise } from '../fixture-gen/lib/programme.mjs';
import { buildTables } from '../fixture-gen/lib/tables.mjs';
import { writeXer, orderTables } from '../fixture-gen/lib/emit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'fixtures/dev-catalogue');

// Titles read like real programmes, because the shelf is the thing being looked at. The
// sector each is filed under is in the manifest, applied by the seed script.
const CATALOGUE = [
  // --- rail ----------------------------------------------------------------
  ['tanfield-station-remodelling', 'Tanfield station remodelling — Stage 3', 'rail', 1_751, 'partial', '6.0'],
  ['depot-resignalling', 'Ravenhill depot resignalling', 'rail', 640, 'partial', '8.3'],
  ['viaduct-strengthening', 'Kelder viaduct strengthening', 'rail', 320, 'none', '8.3'],
  ['coastal-line-renewals', 'Coastal line track renewals — CP7', 'rail', 5_200, 'partial', '6.0'],
  ['platform-extensions', 'Platform extension programme, phase 2', 'rail', 210, 'none', '8.3'],

  // --- highways ------------------------------------------------------------
  ['a19-junction-upgrade', 'A19 Norton junction upgrade', 'highways', 1_240, 'partial', '6.0'],
  ['ring-road-widening', 'Southern ring road widening', 'highways', 2_600, 'partial', '8.3'],
  ['bridge-deck-replacement', 'Weirside bridge deck replacement', 'highways', 480, 'none', '8.3'],
  ['smart-motorway-retrofit', 'Smart motorway technology retrofit', 'highways', 890, 'full', '6.0'],

  // --- aviation ------------------------------------------------------------
  ['terminal-two-fitout', 'Terminal 2 pier fitout', 'aviation', 3_100, 'partial', '8.3'],
  ['runway-resurfacing', 'Runway 09/27 resurfacing', 'aviation', 260, 'full', '6.0'],
  ['baggage-hall-upgrade', 'Baggage hall handling upgrade', 'aviation', 1_450, 'none', '8.3'],

  // --- marine --------------------------------------------------------------
  ['quay-wall-reconstruction', 'Quay wall reconstruction — berths 4–6', 'marine', 970, 'partial', '6.0'],
  ['lock-gate-refurbishment', 'Lock gate refurbishment', 'marine', 340, 'none', '8.3'],

  // --- building ------------------------------------------------------------
  ['civic-centre-refurbishment', 'Civic centre refurbishment', 'building', 1_820, 'partial', '8.3'],
  ['hospital-wing-extension', 'District hospital east wing', 'building', 4_400, 'partial', '6.0'],
  ['school-rebuild-programme', 'Secondary school rebuild programme', 'building', 720, 'none', '8.3'],
  ['residential-block-c', 'Residential block C — superstructure', 'building', 410, 'partial', '8.3'],
  ['university-labs', 'University science labs refit', 'building', 155, 'none', '6.0'],

  // --- water ---------------------------------------------------------------
  ['wwtw-capacity-upgrade', 'Wastewater treatment works capacity upgrade', 'water', 2_150, 'partial', '8.3'],
  ['trunk-main-renewal', 'Trunk main renewal — zone 4', 'water', 530, 'none', '6.0'],
  ['reservoir-spillway', 'Reservoir spillway remediation', 'water', 290, 'partial', '8.3'],

  // --- power ---------------------------------------------------------------
  ['grid-substation-400kv', '400 kV substation rebuild', 'power', 1_680, 'partial', '6.0'],
  ['offshore-array-cabling', 'Offshore array cabling campaign', 'power', 6_100, 'partial', '8.3'],
  ['battery-storage-site', 'Grid-scale battery storage site', 'power', 380, 'none', '8.3'],
  ['overhead-line-refurb', 'Overhead line refurbishment — route ZB', 'power', 860, 'full', '6.0'],

  // --- process -------------------------------------------------------------
  ['refinery-turnaround', 'Refinery turnaround — unit 12', 'process', 2_900, 'partial', '8.3'],
  ['lng-jetty-topsides', 'LNG jetty topsides installation', 'process', 1_120, 'none', '6.0'],
  ['chemical-plant-debottleneck', 'Chemical plant debottlenecking', 'process', 640, 'partial', '8.3'],

  // --- unsectored: the guaranteed state of every upload by someone who did not care.
  //     Plausibly the largest bucket at launch, so it is well represented here.
  ['tender-programme-b', 'Tender programme — works package B', null, 3_344, 'none', '8.3'],
  ['framework-lookahead', 'Framework 12-week look-ahead', null, 180, 'partial', '6.0'],
  ['shutdown-sequence', 'Shutdown sequence — outage 7', null, 460, 'partial', '8.3'],
  ['design-stage-programme', 'Design stage programme', null, 240, 'none', '6.0'],
  ['fitout-package', 'Fitout package — levels 3 to 8', null, 1_050, 'partial', '8.3'],
  ['enabling-works', 'Enabling works and site setup', null, 130, 'full', '6.0'],
  ['integration-testing', 'Systems integration and testing', null, 770, 'none', '8.3'],
];

// The programmes carrying row states no `.xer` can express. Each names a base entry above.
const REVISION_SERIES = 'tanfield-station-remodelling'; // four monthly updates
const FORK_PARENT = 'a19-junction-upgrade';             // two forks by other contributors
const TOMBSTONE_A = 'university-labs';                  // owner withdrew, voluntarily
const TOMBSTONE_B = 'lock-gate-refurbishment';          // adjudicated complaint
const FAILED = 'integration-testing';                   // never got past ingest

function seedOf(name) {
  // FNV-1a. Any stable hash does; what matters is that a name always yields one programme.
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Bigger programmes carry deeper breakdowns and more logic, as real ones do. */
function optionsFor(activities, progress, version, seed) {
  const wbsNodes = Math.max(4, Math.min(120, Math.round(activities / 22)));
  return {
    seed,
    version,
    activities,
    wbsNodes,
    wbsDepth: activities > 2_000 ? 5 : activities > 500 ? 4 : 3,
    progress,
    // A progressed update is where negative float lives, which is what makes the float
    // sliver on the shelf row show three bands rather than one.
    deadlineSlipDays: progress === 'partial' ? 25 : 0,
    calendars: 3,
    predPerActivity: 1.7,
    codesPerActivity: activities > 2_000 ? 12 : 8,
    rsrcPerActivity: 1.6,
    udfPerActivity: 3,
    resources: Math.max(6, Math.min(40, Math.round(activities / 60))),
    startDate: '2026-01-05',
    // P6 only populates the flag when asked to. Leaving it off on some files is the point:
    // `logic.longest_path` is always computed, and the shelf must look identical either way.
    longestPathFlag: seed % 3 !== 0,
  };
}

async function generateOne(entry, index) {
  const [name, title, sector, activities, progress, version] = entry;
  const seed = seedOf(name);
  const opts = optionsFor(activities, progress, version, seed);
  const model = synthesise(opts);
  const tables = buildTables(model, {});
  const emitted = orderTables(version, tables);
  const file = path.join(OUT, `${name}.xer`);
  const bytes = await writeXer(file, { version, tables: emitted });
  process.stdout.write(
    `  ${String(index + 1).padStart(2)} ${name.padEnd(32)} ${String(activities).padStart(5)} acts  ${(bytes / 1024).toFixed(0)} KB\n`,
  );
  return { name, title, sector, activities, progress, version, file: `${name}.xer`, bytes };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  process.stdout.write(`Generating ${CATALOGUE.length} programmes into fixtures/dev-catalogue\n`);

  const programmes = [];
  for (const [i, entry] of CATALOGUE.entries()) {
    programmes.push(await generateOne(entry, i));
  }

  // A revision series needs distinct bytes per revision, not one file listed four times: the
  // dedup index is defined on `content_hash`, and four identical hashes under one programme
  // would be a legitimate state the shelf never shows. Each update moves the data date on.
  const seriesBase = CATALOGUE.find(([n]) => n === REVISION_SERIES);
  const series = [];
  for (let rev = 2; rev <= 4; rev++) {
    const name = `${REVISION_SERIES}-r${rev}`;
    const [, , , activities, , version] = seriesBase;
    const opts = optionsFor(activities, 'partial', version, seedOf(name));
    const model = synthesise(opts);
    const tables = buildTables(model, {});
    const file = path.join(OUT, `${name}.xer`);
    const bytes = await writeXer(file, { version, tables: orderTables(version, tables) });
    series.push({ name, rev_no: rev, file: `${name}.xer`, bytes });
    process.stdout.write(`  r${rev} ${name}\n`);
  }

  // Forks are new programmes with their own bytes and their own lineage edge. A fork that
  // shared its parent's bytes would be a duplicate root, which §5.8 rejects outright.
  const forks = [];
  for (const [i, suffix] of ['revised-sequence', 'contractor-b'].entries()) {
    const name = `${FORK_PARENT}-fork-${suffix}`;
    const opts = optionsFor(1_240, 'partial', '8.3', seedOf(name));
    const model = synthesise(opts);
    const tables = buildTables(model, {});
    const file = path.join(OUT, `${name}.xer`);
    const bytes = await writeXer(file, { version: '8.3', tables: orderTables('8.3', tables) });
    forks.push({
      name,
      parent: FORK_PARENT,
      title: i === 0 ? 'A19 Norton junction — revised sequence' : 'A19 Norton junction — contractor B logic',
      change_note:
        i === 0
          ? 'Re-sequenced the deck pours after the temporary works review.'
          : 'Rebuilt the logic to contractor B methodology; durations unchanged.',
      file: `${name}.xer`,
      bytes,
    });
    process.stdout.write(`  fork ${name}\n`);
  }

  const manifest = {
    generated_by: 'tools/dev-catalogue/generate.mjs',
    programmes,
    revision_series: { programme: REVISION_SERIES, revisions: series },
    forks,
    tombstones: [
      { programme: TOMBSTONE_A, removal_class: 'A' },
      { programme: TOMBSTONE_B, removal_class: 'B' },
    ],
    failed: { programme: FAILED },
  };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`\nWrote ${programmes.length + series.length + forks.length} files + manifest.json\n`);
}

await main();
