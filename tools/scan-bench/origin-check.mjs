#!/usr/bin/env node
// Which origins give the upload page the APIs it needs?
//
//   node tools/scan-bench/origin-check.mjs
//
// `crypto.subtle` is gated on a secure context and the other two are not, so an
// insecure origin does not fail loudly — it silently removes exactly one of the three
// requirements, the content hash, which is 011's dedup key. That is the trap waiting
// for anyone who tests the upload page on a phone by pointing it at the dev machine's
// LAN address, and it would read as "this engine has no WebCrypto".
//
// Serves one page on 0.0.0.0 and loads it three ways in each engine.

import { chromium, firefox, webkit } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const page = path.join(HERE, 'bench.html');
const html = fs.readFileSync(page);

const srv = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});
await new Promise((r) => srv.listen(0, '0.0.0.0', r));
const port = srv.address().port;
const lan = Object.values(os.networkInterfaces()).flat()
  .find((i) => i.family === 'IPv4' && !i.internal)?.address;

const PROBE = `({
  secure: isSecureContext,
  hasSubtle: !!(globalThis.crypto && crypto.subtle),
  hasCompression: typeof CompressionStream !== 'undefined',
  hasBlobStream: typeof Blob.prototype.stream === 'function',
})`;

const ORIGINS = [
  ['localhost', `http://localhost:${port}/`],
  ['lan-ip', `http://${lan}:${port}/`],
  ['file://', `file://${page}`],
];

for (const [name, type] of [['webkit', webkit], ['firefox', firefox], ['chromium', chromium]]) {
  const browser = await type.launch();
  const p = await browser.newPage();
  for (const [label, url] of ORIGINS) {
    try {
      await p.goto(url, { timeout: 20000 });
      console.log(`${name.padEnd(9)} ${label.padEnd(10)} ${JSON.stringify(await p.evaluate(PROBE))}`);
    } catch (e) {
      console.log(`${name.padEnd(9)} ${label.padEnd(10)} ERR ${String(e).split('\n')[0].slice(0, 90)}`);
    }
  }
  await browser.close();
}
srv.close();
