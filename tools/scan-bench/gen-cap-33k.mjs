#!/usr/bin/env node
// Generate `cap-33k.xer` — a file AT the byte cap, for the engine benchmarks.
//
// 020 generated this fixture in a session scratchpad rather than adding it to the
// committed catalogue, and this script reproduces it the same way: same library, same
// name-derived seed, same knobs as `perf-20k` scaled to 33,000 activities. It writes to
// `fixtures/generated/`, which is gitignored and regenerable, and it does not touch
// `catalogue.mjs`, `generate.mjs` or `measure.mjs`.
//
//   node tools/scan-bench/gen-cap-33k.mjs
//
// ~50.5 MB out. Reproducible: the seed is sha256('cap-33k') read as a big-endian u32,
// which is `generate.mjs`'s own `hashSeed`.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { synthesise } from '../fixture-gen/lib/programme.mjs';
import { buildTables } from '../fixture-gen/lib/tables.mjs';
import { writeXer, orderTables } from '../fixture-gen/lib/emit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = path.join(ROOT, 'fixtures/generated');

// perf-20k's knobs, scaled. wbsNodes tracks 012's measured density of ~90 WBS nodes per
// 1,000 activities, which is where 020's "2,970 PROJWBS rows at 33k" comes from.
export const CAP_33K = {
  name: 'cap-33k',
  version: '8.3',
  activities: 33000,
  wbsNodes: 2970,
  wbsDepth: 5,
  progress: 'partial',
  deadlineSlipDays: 40,
  codesPerActivity: 6,
  resources: 40,
  calendars: 4,
};

const hashSeed = (name) => crypto.createHash('sha256').update(name).digest().readUInt32BE(0);

const { name, ...opts } = CAP_33K;
fs.mkdirSync(OUT_DIR, { recursive: true });
const file = path.join(OUT_DIR, `${name}.xer`);

const started = process.hrtime.bigint();
const model = synthesise({ seed: hashSeed(name), ...opts });
const tables = buildTables(model, {});
const bytes = await writeXer(file, { version: opts.version, tables: orderTables(opts.version, tables) });
const ms = Math.round(Number(process.hrtime.bigint() - started) / 1e6);

const sha256 = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
console.log(JSON.stringify({
  file: path.relative(ROOT, file),
  bytes,
  mb: (bytes / 1e6).toFixed(3),
  ms,
  sha256,
  seed: hashSeed(name),
  activities: tables.TASK.rows.length,
  projwbs: tables.PROJWBS.rows.length,
  taskactv: tables.TASKACTV?.rows.length ?? 0,
  records: orderTables(opts.version, tables).reduce((n, t) => n + t.rows.length, 0),
}, null, 2));
