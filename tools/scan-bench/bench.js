// Page side of the bench. Everything the driver calls hangs off `window.bench`.
import { scan, parse, probeApis, clientStep } from './scan.js';

const log = (s) => { document.getElementById('log').textContent = s; };

/**
 * Fetch a fixture as a File, the way the upload page gets one from the file picker.
 *
 * `Response.blob()` rather than `arrayBuffer()` so the bytes are held by the platform
 * as a Blob and the scan reads them through `Blob.stream()`, which is the API under
 * test. A `File` is a `Blob`, and the scan only ever calls `.stream()`, `.size` and
 * `.arrayBuffer()` on it.
 */
async function fetchFile(name) {
  const res = await fetch(`./fixtures/${name}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} fetching ${name}`);
  const blob = await res.blob();
  return new File([blob], name, { type: 'application/octet-stream' });
}

/** Peak JS heap, where the engine will say. Chromium only; null everywhere else. */
function heapNow() {
  return typeof performance !== 'undefined' && performance.memory
    ? performance.memory.usedJSHeapSize : null;
}

async function settledMemory() {
  if (typeof performance === 'undefined'
    || typeof performance.measureUserAgentSpecificMemory !== 'function') return null;
  try { return await performance.measureUserAgentSpecificMemory(); } catch (e) { return { error: String(e) }; }
}

window.bench = {
  apis: () => probeApis(),

  ua: () => ({
    userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    deviceMemory: navigator.deviceMemory ?? null,
    secureContext: isSecureContext,
    crossOriginIsolated: typeof crossOriginIsolated === 'undefined' ? null : crossOriginIsolated,
  }),

  /** Load the page, touch nothing. The floor every net figure subtracts. */
  async noop() {
    log('noop');
    return { ok: true, wall_ms: 0, peak_heap: heapNow(), settled: await settledMemory() };
  },

  /** The whole client step on one fixture. */
  async run(name, opts = {}) {
    log(`run ${name}`);
    let peak = 0;
    const sampler = setInterval(() => { const h = heapNow(); if (h && h > peak) peak = h; }, 10);
    try {
      const file = await fetchFile(name);
      const fetched = heapNow();
      if (fetched && fetched > peak) peak = fetched;
      const out = await clientStep(file, opts);
      const after = heapNow();
      if (after && after > peak) peak = after;
      clearInterval(sampler);
      // Let the engine settle before asking what is still owed.
      await new Promise((r) => setTimeout(r, 400));
      out.peak_heap = peak || null;
      out.heap_after = heapNow();
      out.settled = await settledMemory();
      log(`done ${name} ${Math.round(out.wall_ms)}ms`);
      return out;
    } catch (e) {
      clearInterval(sampler);
      log(`FAIL ${name}: ${e}`);
      return { ok: false, error: String(e), stack: e && e.stack ? String(e.stack) : null };
    }
  },

  /**
   * The retaining driver — 011's original full parse, same tokenizer.
   *
   * The control on every constrained run: a heap ceiling nothing dies at proves nothing,
   * and this is the thing that is supposed to die.
   */
  async parse(name) {
    log(`parse ${name}`);
    let peak = 0;
    const sampler = setInterval(() => { const h = heapNow(); if (h && h > peak) peak = h; }, 10);
    try {
      const file = await fetchFile(name);
      const t0 = performance.now();
      const out = await parse(file);
      out.wall_ms = performance.now() - t0;
      clearInterval(sampler);
      const h = heapNow();
      if (h && h > peak) peak = h;
      out.peak_heap = peak || null;
      await new Promise((r) => setTimeout(r, 400));
      out.settled = await settledMemory();
      log(`parsed ${name} ${Math.round(out.wall_ms)}ms`);
      return out;
    } catch (e) {
      clearInterval(sampler);
      log(`FAIL parse ${name}: ${e}`);
      return { ok: false, error: String(e) };
    }
  },

  /**
   * Fetch the fixture and do nothing else.
   *
   * The transport floor. Everything below it is what holding the bytes costs before any
   * of the scan runs, which is the part a real file picker would not pay at all.
   */
  async fetchOnly(name) {
    log(`fetch ${name}`);
    const t0 = performance.now();
    const file = await fetchFile(name);
    const wall = performance.now() - t0;
    await new Promise((r) => setTimeout(r, 400));
    return { ok: true, wall_ms: wall, raw_bytes: file.size, peak_heap: heapNow(), settled: await settledMemory() };
  },

  /** Scan only (no hash, no gzip) over a list of fixtures — the corpus agreement check. */
  async scanMany(names) {
    const out = {};
    for (const name of names) {
      try {
        const file = await fetchFile(name);
        out[name] = await scan(file);
      } catch (e) { out[name] = { error: String(e) }; }
    }
    return out;
  },
};

log('ready');
window.__benchReady = true;
