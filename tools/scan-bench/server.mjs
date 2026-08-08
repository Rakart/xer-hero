#!/usr/bin/env node
// A dependency-free static server for the bench page and the fixtures.
//
// http://localhost — a SECURE ORIGIN, which `crypto.subtle` requires and which a
// file:// URL or a LAN IP is not. That is not a harness detail: it is a real constraint
// on the upload page, and testing over file:// would measure a scan with no hash in it.
//
// COOP: same-origin + COEP: require-corp, so `performance.measureUserAgentSpecificMemory()`
// is available where the engine has it (Chromium). 020's harness did the same, and the
// Chromium control run here has to be measured the same way to be comparable.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xer': 'application/octet-stream',
};

// `/fixtures/<name>` resolves against these, in order. Keeps the URL flat while the
// files stay where the generator puts them.
const FIXTURE_DIRS = [
  path.join(ROOT, 'fixtures/generated'),
  path.join(ROOT, 'fixtures/synthetic'),
  path.join(ROOT, 'fixtures/synthetic/corpus'),
];

function resolve(urlPath) {
  if (urlPath === '/' || urlPath === '/bench.html') return path.join(HERE, 'bench.html');
  if (urlPath.startsWith('/fixtures/')) {
    const name = path.basename(decodeURIComponent(urlPath.slice('/fixtures/'.length)));
    for (const dir of FIXTURE_DIRS) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) return p;
    }
    return null;
  }
  const p = path.join(HERE, path.basename(decodeURIComponent(urlPath)));
  return fs.existsSync(p) ? p : null;
}

const server = http.createServer((req, res) => {
  const file = resolve(new URL(req.url, 'http://localhost').pathname);
  const headers = {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cache-Control': 'no-store',
  };
  if (!file || !fs.existsSync(file)) {
    res.writeHead(404, { ...headers, 'Content-Type': 'text/plain' });
    res.end('not found');
    return;
  }
  const stat = fs.statSync(file);
  res.writeHead(200, {
    ...headers,
    'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
    'Content-Length': stat.size,
  });
  fs.createReadStream(file).pipe(res);
});

export function start(port = 0) {
  return new Promise((resolve_) => {
    server.listen(port, '127.0.0.1', () => resolve_({
      port: server.address().port,
      close: () => new Promise((r) => server.close(r)),
    }));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { port } = await start(Number(process.argv[2] ?? 8137));
  console.log(`http://localhost:${port}/`);
}
