#!/usr/bin/env node
// Drive the bench across Playwright's WebKit, Firefox and Chromium builds.
//
//   node tools/scan-bench/run.mjs                       everything, 5 timed repeats
//   node tools/scan-bench/run.mjs --engines webkit      one engine
//   node tools/scan-bench/run.mjs --repeats 3
//   node tools/scan-bench/run.mjs --out results.json
//
// Each timed run gets a FRESH browser process, because the memory instrument that every
// engine here has in common is the OS peak RSS of the content process (`VmHWM` in
// /proc), and VmHWM is a high-water mark that never falls. One browser per run is the
// only way that number means "this run".
//
// A caveat that belongs in the output rather than in a footnote: Playwright's WebKit is
// a real WebKit built for Linux (WPE), not the WebKit Apple ships in Safari, and no
// desktop engine reproduces iOS Safari's per-tab memory ceiling.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { start } from './server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const ENGINES = { webkit, firefox, chromium };

// What a process of this engine looks like in /proc/<pid>/cmdline. Derived from the
// Playwright cache root rather than hardcoded, and deliberately a PREFIX: headless
// Chromium runs out of `chromium_headless_shell-<rev>` while `executablePath()` names
// `chromium-<rev>`, and headless WebKit runs `minibrowser-wpe/bin/*` under a
// `pw_run.sh` whose own path is two directories up.
const CMD_PREFIX = { chromium: 'chromium', firefox: 'firefox-', webkit: 'webkit-' };

function cmdlineNeedle(engineName) {
  const exe = ENGINES[engineName].executablePath();
  const at = exe.indexOf('ms-playwright');
  const cacheRoot = at === -1 ? path.dirname(exe) : exe.slice(0, at + 'ms-playwright'.length);
  return `${cacheRoot}/${CMD_PREFIX[engineName]}`;
}

const argv = process.argv.slice(2);
const arg = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i === -1 ? fallback : argv[i + 1];
};

const wanted = (arg('--engines', 'webkit,firefox,chromium')).split(',').filter(Boolean);
const repeats = Number(arg('--repeats', '5'));
const outFile = arg('--out', path.join(HERE, 'results.json'));

const SCALE = ['perf-2k.xer', 'perf-20k.xer', 'perf-20k-dense.xer', 'cap-33k.xer'];
const CAP = 'cap-33k.xer';

const corpusDir = path.join(ROOT, 'fixtures/synthetic/corpus');
const CORPUS = fs.existsSync(corpusDir)
  ? fs.readdirSync(corpusDir).filter((f) => f.endsWith('.xer')).sort() : [];

// ---- process memory ---------------------------------------------------------

/** Every live pid whose cmdline mentions `needle`, with its peak RSS. */
function procPeaks(needle) {
  const out = [];
  for (const pid of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(pid)) continue;
    let cmd;
    try { cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8'); } catch { continue; }
    if (!cmd.includes(needle)) continue;
    let status;
    try { status = fs.readFileSync(`/proc/${pid}/status`, 'utf8'); } catch { continue; }
    const hwm = /VmHWM:\s+(\d+) kB/.exec(status);
    const rss = /VmRSS:\s+(\d+) kB/.exec(status);
    out.push({
      pid: Number(pid),
      peak_kb: hwm ? Number(hwm[1]) : null,
      rss_kb: rss ? Number(rss[1]) : null,
      // Enough of the command line to tell a content process from the parent.
      tag: cmd.split('\0').slice(1).filter((a) => a.startsWith('-') || a.includes('Process'))
        .slice(0, 4).join(' ') || 'parent',
    });
  }
  return out.sort((a, b) => (b.peak_kb ?? 0) - (a.peak_kb ?? 0));
}

const mib = (kb) => (kb === null || kb === undefined ? null : Math.round((kb / 1024) * 10) / 10);

/**
 * What the run cost, measured WITHIN one browser instance.
 *
 * An absolute RSS is not comparable across these three builds: they have different
 * process topologies and each maps a different amount of Mesa's software rasteriser,
 * so a whole-browser figure is mostly floor and the floor is noisy. What is comparable
 * is how far a run pushed a process past its OWN startup high-water mark — `VmHWM`
 * after the run minus `VmHWM` at the moment the page had loaded and settled.
 *
 * That is a LOWER bound: a run that peaks below the startup peak reads as zero. It is
 * also the honest one, because it is measured on the same process in the same instance
 * with nothing between the two readings but the work.
 */
function costOfRun(before, after) {
  const beforeBy = new Map(before.map((p) => [p.pid, p]));
  const deltas = after.map((p) => ({
    pid: p.pid,
    tag: p.tag,
    before_peak_mib: mib(beforeBy.get(p.pid)?.peak_kb ?? null),
    after_peak_mib: mib(p.peak_kb),
    delta_mib: beforeBy.has(p.pid) ? mib((p.peak_kb ?? 0) - (beforeBy.get(p.pid).peak_kb ?? 0)) : null,
    new_process: !beforeBy.has(p.pid),
  })).sort((a, b) => (b.delta_mib ?? -1) - (a.delta_mib ?? -1));

  const growth = deltas.reduce((n, d) => n + Math.max(0, d.delta_mib ?? 0), 0);
  const newProcesses = deltas.filter((d) => d.new_process)
    .reduce((n, d) => n + (d.after_peak_mib ?? 0), 0);

  return {
    process_count: after.length,
    // The headline: the single process that grew most, and the total growth over all.
    largest_growth_mib: deltas[0]?.delta_mib ?? null,
    total_growth_mib: Math.round(growth * 10) / 10,
    new_process_peak_mib: Math.round(newProcesses * 10) / 10,
    // Absolutes too, for anyone who wants them, but they are mostly floor.
    largest_process_peak_mib: mib(Math.max(...after.map((p) => p.peak_kb ?? 0))),
    all_processes_peak_mib: mib(after.reduce((n, p) => n + (p.peak_kb ?? 0), 0)),
    processes: deltas.slice(0, 8),
  };
}

// ---- driving ----------------------------------------------------------------

// Chromium only, and it is 020's flag: without it `performance.memory` is quantised to
// a flat 10 MB in a headless shell, which is not a measurement of anything.
const LAUNCH = { chromium: { args: ['--enable-precise-memory-info'] } };

async function withBrowser(engineName, port, fn) {
  const type = ENGINES[engineName];
  const needle = cmdlineNeedle(engineName);
  const browser = await type.launch({ timeout: 120000, ...(LAUNCH[engineName] ?? {}) });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('crash', () => consoleErrors.push('PAGE CRASHED'));
  await page.goto(`http://localhost:${port}/bench.html`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__benchReady === true', null, { timeout: 60000 });
  // Let startup settle so the "before" high-water mark is the page's, not the launch's.
  await page.waitForTimeout(1500);
  const before = procPeaks(needle);
  try {
    const result = await fn(page, browser);
    const after = procPeaks(needle);
    return { ...result, memory: costOfRun(before, after), pageErrors: consoleErrors };
  } finally {
    await browser.close().catch(() => {});
  }
}

async function main() {
  const { port, close } = await start(0);
  const started = new Date().toISOString();
  const results = { started, port, node: process.version, repeats, engines: {} };

  for (const name of wanted) {
    const type = ENGINES[name];
    if (!type) { console.error(`unknown engine ${name}`); continue; }
    const engine = { engine: name, executable: type.executablePath() };
    console.log(`\n=== ${name} ===`);

    try {
      // 1. Version, APIs, and the floor.
      const first = await withBrowser(name, port, async (page, browser) => ({
        version: browser.version(),
        ua: await page.evaluate('window.bench.ua()'),
        apis: await page.evaluate('window.bench.apis()'),
        noop: await page.evaluate('window.bench.noop()'),
      }));
      engine.version = first.version;
      engine.ua = first.ua;
      engine.apis = first.apis;
      engine.floor = first.memory;
      engine.pageErrors = first.pageErrors;
      console.log(`  version ${first.version}`);
      for (const k of ['Blob.stream()', 'CompressionStream', 'crypto.subtle.digest']) {
        console.log(`  ${k.padEnd(22)} ${JSON.stringify(first.apis[k])}`);
      }
      console.log(`  floor  ${JSON.stringify(engine.floor.largest_process_peak_mib)} MiB largest, `
        + `${engine.floor.all_processes_peak_mib} MiB all`);

      // 2. The cap-sized file, repeated.
      engine.cap_runs = [];
      for (let i = 0; i < repeats; i++) {
        const r = await withBrowser(name, port, async (page) => ({
          run: await page.evaluate(`window.bench.run(${JSON.stringify(CAP)})`),
        }));
        engine.cap_runs.push({ ...r.run, memory: r.memory, pageErrors: r.pageErrors });
        const w = r.run.ok ? `${Math.round(r.run.wall_ms)} ms` : `FAIL ${r.run.error}`;
        console.log(`  ${CAP} #${i + 1}  ${w}  peak ${r.memory.largest_process_peak_mib} MiB`);
      }

      // 3. Where the memory goes. Same file, the client step taken apart.
      engine.decomposition = {};
      const VARIANTS = [
        ['fetch-only', null],
        ['scan-only', { hash: false, gzip: false }],
        ['scan+hash', { gzip: false }],
        ['scan+gzip', { hash: false }],
        ['full', {}],
      ];
      for (const [label, opts] of VARIANTS) {
        const r = await withBrowser(name, port, async (page) => ({
          run: opts === null
            ? await page.evaluate(`window.bench.fetchOnly(${JSON.stringify(CAP)})`)
            : await page.evaluate(`window.bench.run(${JSON.stringify(CAP)}, ${JSON.stringify(opts)})`),
        }));
        engine.decomposition[label] = { ...r.run, memory: r.memory };
        console.log(`  ${label.padEnd(12)} ${r.run.ok ? `${Math.round(r.run.wall_ms)} ms` : `FAIL ${r.run.error}`}`
          + `  peak ${r.memory.largest_process_peak_mib} MiB`);
      }

      // 4. The scale curve, one run each.
      engine.scale = {};
      for (const fixture of SCALE) {
        if (!fs.existsSync(path.join(ROOT, 'fixtures/generated', fixture))) continue;
        const r = await withBrowser(name, port, async (page) => ({
          run: await page.evaluate(`window.bench.run(${JSON.stringify(fixture)})`),
        }));
        engine.scale[fixture] = { ...r.run, memory: r.memory };
        console.log(`  scale ${fixture.padEnd(20)} ${r.run.ok ? `${Math.round(r.run.wall_ms)} ms` : `FAIL ${r.run.error}`}`
          + `  peak ${r.memory.largest_process_peak_mib} MiB`);
      }

      // 5. Corpus agreement — does the scan give the same answers in this engine.
      if (CORPUS.length) {
        const r = await withBrowser(name, port, async (page) => ({
          scans: await page.evaluate(`window.bench.scanMany(${JSON.stringify(CORPUS)})`),
        }));
        engine.corpus = r.scans;
        console.log(`  corpus  ${Object.keys(r.scans).length} fixtures scanned`);
      }
    } catch (e) {
      engine.error = String(e && e.stack ? e.stack : e);
      console.error(`  ENGINE FAILED: ${engine.error.split('\n')[0]}`);
    }

    results.engines[name] = engine;
    fs.writeFileSync(outFile, `${JSON.stringify(results, null, 2)}\n`);
  }

  results.finished = new Date().toISOString();
  fs.writeFileSync(outFile, `${JSON.stringify(results, null, 2)}\n`);
  await close();
  console.log(`\nwrote ${outFile}`);
}

await main();
