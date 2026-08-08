#!/usr/bin/env node
// Does the heap knob `constrain.mjs` uses actually bite, in each engine?
//
//   node tools/scan-bench/knob-check.mjs
//
// Every constrained result is worthless without this. If the knob is a no-op, "survives
// a 16 MiB heap" means "the flag was ignored", not "the workload is frugal" — and the
// two are indistinguishable from the scan's own output, because the scan survives either
// way. So: set the ceiling, then deliberately allocate far past it. An engine honouring
// the ceiling must either throw or die. An engine that sails through is not enforcing it.

import { chromium, firefox, webkit } from 'playwright';

const CAP_MIB = 16;
const ALLOCATE_MIB = 512;

const CASES = [
  ['chromium', chromium, { args: [`--js-flags=--max-old-space-size=${CAP_MIB}`] }],
  ['firefox', firefox, { firefoxUserPrefs: { 'javascript.options.mem.max': CAP_MIB * 1024 } }],
  ['webkit', webkit, { env: { ...process.env, JSC_gcMaxHeapSize: String(CAP_MIB * 1024 * 1024) } }],
];

// 512 MiB of live, non-collectable, non-deduplicable JS strings.
const HOG = `(() => {
  const keep = [];
  for (let i = 0; i < ${ALLOCATE_MIB}; i++) {
    let s = String(i).padStart(8, '0');
    while (s.length < 1024 * 1024) s += s.length.toString(36) + s.slice(0, 64);
    keep.push(s.slice(0, 1024 * 1024));
  }
  return { chunks: keep.length, mib: keep.reduce((n, s) => n + s.length, 0) / 1048576 };
})()`;

for (const [name, type, opts] of CASES) {
  let browser;
  try {
    browser = await type.launch({ timeout: 120000, ...opts });
    const page = await browser.newPage();
    let crashed = false;
    page.on('crash', () => { crashed = true; });
    const got = await page.evaluate(HOG);
    console.log(`${name.padEnd(9)} cap ${CAP_MIB} MiB — allocated ${Math.round(got.mib)} MiB and SURVIVED`
      + `${crashed ? ' (but crashed)' : ''}  => the knob is a NO-OP`);
  } catch (e) {
    const msg = String(e).split('\n')[0];
    const catchable = /out of memory|RangeError|Array buffer allocation/i.test(msg);
    console.log(`${name.padEnd(9)} cap ${CAP_MIB} MiB — ${catchable ? 'THREW (catchable)' : 'DIED (uncatchable)'}`
      + `: ${msg.slice(0, 100)}  => the knob BITES`);
  } finally {
    await browser?.close().catch(() => {});
  }
}
