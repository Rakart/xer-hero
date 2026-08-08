#!/usr/bin/env node
// 020's device proxy, per engine: cap the JS heap and see what dies.
//
//   node tools/scan-bench/constrain.mjs
//   node tools/scan-bench/constrain.mjs --engines webkit --caps 64,32,16
//
// 020 used `--js-flags=--max-old-space-size=N` in Chromium, on the grounds that a
// renderer that exceeds it is killed with no catchable error — the same failure SHAPE
// mobile Safari produces, manufactured on demand. Each engine has its own knob:
//
//   chromium  --js-flags=--max-old-space-size=<MiB>     V8 old space
//   firefox   javascript.options.mem.max = <KiB>        SpiderMonkey GC heap
//   webkit    JSC_gcMaxHeapSize=<bytes>                 JavaScriptCore heap
//
// **These three are not the same instrument**, and the table this produces is not a
// cross-engine comparison of survival. Each column says only "this engine, at its own
// heap ceiling, on the cap-sized file". What transfers is the shape: does the scan stay
// inside a small ceiling at all, in this engine, on this file.
//
// It is still not iOS Safari. iOS enforces a per-TAB ceiling on total process memory in
// the OS, not a heap ceiling inside the engine, and it kills the tab. Nothing here
// reproduces that.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { start } from './server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CAP = 'cap-33k.xer';

const argv = process.argv.slice(2);
const arg = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i === -1 ? fallback : argv[i + 1];
};

const engines = arg('--engines', 'webkit,firefox,chromium').split(',').filter(Boolean);
const caps = arg('--caps', '512,256,128,64,32,16').split(',').map(Number);
const outFile = arg('--out', path.join(HERE, 'constrained.json'));

/** Launch options that impose an `mib` JS-heap ceiling on this engine. */
function constrained(name, mib) {
  switch (name) {
    case 'chromium':
      return [chromium, { args: [`--js-flags=--max-old-space-size=${mib}`, '--enable-precise-memory-info'] }];
    case 'firefox':
      return [firefox, { firefoxUserPrefs: { 'javascript.options.mem.max': mib * 1024 } }];
    case 'webkit':
      return [webkit, { env: { ...process.env, JSC_gcMaxHeapSize: String(mib * 1024 * 1024) } }];
    default:
      throw new Error(`unknown engine ${name}`);
  }
}

const results = { started: new Date().toISOString(), caps, engines: {} };
const { port, close } = await start(0);

// Two workloads at every ceiling. `scan` is what 020 shipped; `parse` is the retaining
// driver it replaced, and it is the CONTROL — a ceiling nothing dies at is not known to
// be a ceiling, and the parse is the thing that is supposed to die.
const WORKLOADS = [
  ['scan', (f) => `window.bench.run(${JSON.stringify(f)})`, (r) => r.scan?.activity_count === 33000 && r.scan?.reaches_end_marker === true],
  ['parse', (f) => `window.bench.parse(${JSON.stringify(f)})`, (r) => r.activity_count === 33000 && r.reaches_end_marker === true],
];

for (const name of engines) {
  const row = { knob: { chromium: '--js-flags=--max-old-space-size', firefox: 'javascript.options.mem.max', webkit: 'JSC_gcMaxHeapSize' }[name], workloads: {} };
  console.log(`\n=== ${name} (${row.knob}) ===`);
  for (const [workload, expr, correct] of WORKLOADS) {
    row.workloads[workload] = {};
    for (const mib of caps) {
      const [type, opts] = constrained(name, mib);
      let browser;
      try {
        browser = await type.launch({ timeout: 120000, ...opts });
        const page = await browser.newPage();
        let crashed = false;
        page.on('crash', () => { crashed = true; });
        await page.goto(`http://localhost:${port}/bench.html`, { waitUntil: 'load', timeout: 60000 });
        await page.waitForFunction('window.__benchReady === true', null, { timeout: 60000 });
        const run = await page.evaluate(expr(CAP));
        const ok = run.ok === true && !crashed && correct(run);
        row.workloads[workload][mib] = {
          verdict: ok ? 'ok' : 'failed',
          wall_ms: run.wall_ms ?? null,
          peak_heap: run.peak_heap ?? null,
          sha256: run.sha256 ?? null,
          gzip_bytes: run.gzip_bytes ?? null,
          crashed,
          // A thrown OOM is CATCHABLE — the page could tell the user. A killed process
          // is not, and that distinction is the whole of 020's worry.
          catchable: run.ok === false && !crashed,
          error: run.error ?? null,
        };
        console.log(`  ${workload.padEnd(6)} ${String(mib).padStart(4)} MiB  ${ok ? 'ok' : 'FAILED (catchable)'}  ${run.ok ? `${Math.round(run.wall_ms)} ms` : String(run.error).slice(0, 90)}`);
      } catch (e) {
        const msg = String(e).split('\n')[0];
        row.workloads[workload][mib] = { verdict: 'died', error: msg, catchable: false };
        console.log(`  ${workload.padEnd(6)} ${String(mib).padStart(4)} MiB  DIED (uncatchable)  ${msg.slice(0, 90)}`);
      } finally {
        await browser?.close().catch(() => {});
      }
      fs.writeFileSync(outFile, `${JSON.stringify(results, null, 2)}\n`);
    }
  }
  results.engines[name] = row;
  fs.writeFileSync(outFile, `${JSON.stringify(results, null, 2)}\n`);
}

results.finished = new Date().toISOString();
fs.writeFileSync(outFile, `${JSON.stringify(results, null, 2)}\n`);
await close();
console.log(`\nwrote ${outFile}`);
