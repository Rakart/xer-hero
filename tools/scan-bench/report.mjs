#!/usr/bin/env node
// Turn `results.json` into the tables the asset carries, and check two things the raw
// numbers do not say on their own:
//
//   1. Does the scan give the SAME ANSWERS in every engine? Byte-for-byte, per fixture.
//   2. Do those answers agree with 012's goldens, which were written from the
//      generator's intent and never from parsing its own output?
//
//   node tools/scan-bench/report.mjs [results.json]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const file = process.argv[2] ?? path.join(HERE, 'results.json');
const R = JSON.parse(fs.readFileSync(file, 'utf8'));
const names = Object.keys(R.engines);

const round = (x, n = 0) => (x === null || x === undefined ? null : Number(x.toFixed(n)));
const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return {
    n: s.length,
    min: round(s[0]),
    median: round(s[Math.floor(s.length / 2)]),
    max: round(s[s.length - 1]),
    mean: round(s.reduce((a, b) => a + b, 0) / s.length),
  };
};

console.log('## Engines\n');
console.log('| Engine | Version | User agent |');
console.log('|---|---|---|');
for (const n of names) {
  const e = R.engines[n];
  console.log(`| ${n} | ${e.version} | \`${e.ua?.userAgent ?? '?'}\` |`);
}

console.log('\n## The three required APIs\n');
console.log('| Engine | `Blob.stream()` | `CompressionStream` | `crypto.subtle.digest` | secure context | `performance.memory` | `measureUserAgentSpecificMemory` |');
console.log('|---|---|---|---|---|---|---|');
for (const n of names) {
  const a = R.engines[n].apis ?? {};
  const cell = (k) => {
    const v = a[k];
    if (!v) return '—';
    return v.present ? (v.works ? 'yes, verified' : '**present but wrong**') : `**absent** (${v.error})`;
  };
  const i = a.instruments ?? {};
  console.log(`| ${n} | ${cell('Blob.stream()')} | ${cell('CompressionStream')} | ${cell('crypto.subtle.digest')} `
    + `| ${a.secure_context ? 'yes' : 'no'} | ${i['performance.memory'] ? 'yes' : 'no'} `
    + `| ${i['performance.measureUserAgentSpecificMemory'] ? 'yes' : 'no'} |`);
}

console.log('\n## The cap-sized file, repeated\n');
console.log('| Engine | Completes | Wall ms (min / median / max, n) | hash ms | scan+gzip ms | Peak growth over startup | gzip bytes |');
console.log('|---|---|---|---|---|---|---|');
for (const n of names) {
  const runs = R.engines[n].cap_runs ?? [];
  const okAll = runs.length > 0 && runs.every((r) => r.ok && r.scan?.activity_count === 33000);
  const w = stats(runs.map((r) => r.wall_ms));
  const h = stats(runs.filter((r) => r.hash_ms != null).map((r) => r.hash_ms));
  const s = stats(runs.map((r) => r.scan_gzip_ms));
  const m = stats(runs.map((r) => r.memory?.largest_growth_mib ?? 0));
  console.log(`| ${n} | ${okAll ? `**yes**, ${runs.length}/${runs.length}` : '**NO**'} `
    + `| ${w.min} / ${w.median} / ${w.max} (n=${w.n}) | ${h.median} | ${s.median} `
    + `| ${m.median} MiB (${m.min}–${m.max}) | ${runs[0]?.gzip_bytes ?? '—'} |`);
}

console.log('\n## Where the memory goes (cap-33k, one run each)\n');
const VAR = ['fetch-only', 'scan-only', 'scan+hash', 'scan+gzip', 'full'];
console.log(`| Stage | ${names.map((n) => `${n} ms`).join(' | ')} | ${names.map((n) => `${n} MiB`).join(' | ')} |`);
console.log(`|---|${names.map(() => '---').join('|')}|${names.map(() => '---').join('|')}|`);
for (const v of VAR) {
  const ms = names.map((n) => round(R.engines[n].decomposition?.[v]?.wall_ms));
  const mm = names.map((n) => R.engines[n].decomposition?.[v]?.memory?.largest_growth_mib ?? null);
  console.log(`| ${v} | ${ms.join(' | ')} | ${mm.join(' | ')} |`);
}

console.log('\n## Scale curve\n');
const scaleFiles = ['perf-2k.xer', 'perf-20k.xer', 'perf-20k-dense.xer', 'cap-33k.xer'];
console.log(`| Fixture | Raw MB | ${names.map((n) => `${n} ms`).join(' | ')} | ${names.map((n) => `${n} MiB`).join(' | ')} |`);
console.log(`|---|---|${names.map(() => '---').join('|')}|${names.map(() => '---').join('|')}|`);
for (const f of scaleFiles) {
  const any = names.map((n) => R.engines[n].scale?.[f]).find(Boolean);
  if (!any) continue;
  const ms = names.map((n) => round(R.engines[n].scale?.[f]?.wall_ms));
  const mm = names.map((n) => R.engines[n].scale?.[f]?.memory?.largest_growth_mib ?? null);
  console.log(`| \`${f.replace('.xer', '')}\` | ${(any.raw_bytes / 1e6).toFixed(2)} | ${ms.join(' | ')} | ${mm.join(' | ')} |`);
}

// ---- agreement --------------------------------------------------------------

console.log('\n## Do the engines agree with each other?\n');
const corpusNames = Object.keys(R.engines[names[0]]?.corpus ?? {});
const differing = [];
for (const f of corpusNames) {
  const shapes = names.map((n) => JSON.stringify(R.engines[n].corpus[f]));
  if (new Set(shapes).size !== 1) differing.push(f);
}
console.log(`${corpusNames.length - differing.length}/${corpusNames.length} corpus fixtures produce a `
  + `**byte-identical** \`ScanResult\` in ${names.join(', ')}.`);
if (differing.length) {
  console.log(`\nDiffering: ${differing.join(', ')}`);
  for (const f of differing.slice(0, 5)) {
    for (const n of names) {
      const c = R.engines[n].corpus[f];
      console.log(`  ${f} ${n}: ${JSON.stringify(c).slice(0, 300)}`);
    }
  }
}

// Also the cap file's hash, which is the strongest single cross-engine check there is.
const hashes = new Set(names.map((n) => R.engines[n].cap_runs?.[0]?.sha256).filter(Boolean));
console.log(`\ncap-33k SHA-256 across engines: ${hashes.size === 1 ? `**identical** — \`${[...hashes][0]}\`` : `**DIFFER** ${[...hashes].join(' ')}`}`);

// ---- goldens ----------------------------------------------------------------

console.log('\n## Do the answers agree with 012\'s goldens?\n');
const corpusDir = path.join(ROOT, 'fixtures/synthetic/corpus');
let pass = 0;
const fails = [];
for (const f of corpusNames) {
  const goldenPath = path.join(corpusDir, f.replace('.xer', '.expected.json'));
  if (!fs.existsSync(goldenPath)) continue;
  const g = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
  const s = R.engines[names[0]].corpus[f];
  const problems = [];
  const eq = (label, got, want) => { if (got !== want) problems.push(`${label} ${JSON.stringify(got)} != ${JSON.stringify(want)}`); };

  eq('activity_count', s.activity_count, g.assertions.activity_count);
  eq('distinct_task_proj_id', s.distinct_task_proj_id, g.assertions.distinct_task_proj_id);
  eq('project_row_count', s.project_row_count, g.assertions.project_row_count);
  eq('wbs.node_count', s.wbs.node_count, g.assertions.wbs.node_count);
  eq('resource_count', s.resources.count, g.assertions.resource_count);
  eq('activity_code_assignments', s.tables.TASKACTV ?? 0, g.assertions.activity_code_assignment_count);
  eq('resource_assignments', s.tables.TASKRSRC ?? 0, g.assertions.resource_assignment_count);
  eq('calendar_count', s.tables.CALENDAR ?? 0, g.assertions.calendar_count);
  eq('p6_version', s.p6_version, g.p6_version);
  eq('data_date', s.data_date, g.assertions.data_date);
  for (const t of g.tables) eq(`table ${t.name}`, s.tables[t.name] ?? 0, t.rows);
  for (const [k, v] of Object.entries(g.assertions.status_mix)) eq(`status ${k}`, s.status_mix[k] ?? 0, v);
  if (g.readability) {
    eq('reaches_end_marker', s.reaches_end_marker, g.readability.reaches_end_marker);
    eq('nul_byte_count', s.nul_byte_count, g.readability.nul_byte_count);
  } else {
    eq('reaches_end_marker', s.reaches_end_marker, true);
    eq('nul_byte_count', s.nul_byte_count, 0);
  }

  if (problems.length === 0) pass++;
  else fails.push(`${f}: ${problems.join('; ')}`);
}
console.log(`**${pass}/${pass + fails.length}** corpus fixtures scan correctly against their goldens.`);
for (const f of fails) console.log(`- FAIL ${f}`);

// The two 011 turns on.
for (const f of ['multiproj-two-proj-id.xer', 'multiproj-baseline-rows.xer']) {
  const s = R.engines[names[0]].corpus[f];
  if (s) console.log(`\n\`${f.replace('.xer', '')}\` — distinct TASK.proj_id **${s.distinct_task_proj_id}**, PROJECT rows **${s.project_row_count}**`);
}
