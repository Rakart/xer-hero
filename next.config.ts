import type { NextConfig } from 'next'

// §4.6: the `cacheComponents` flag is deliberately OFF. Public pages are byte-identical
// for every viewer and cached as whole documents; per-viewer state arrives from a single
// client-side GET /api/viewer.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // §10.2: Node.js runtime everywhere, never Edge. Ingest needs Node built-ins for gzip,
  // and the whole cost model was measured on Node.
  // Kept out of the server bundle: both are Node-native and the AWS SDK's dynamic requires do
  // not survive bundling. The runtime choice itself (§10.2 — Node, never Edge) is made where it
  // is actually selectable: route handlers default to Node, and `src/middleware.ts` declares
  // `runtime: 'nodejs'` because middleware is the one place Next defaults to Edge.
  serverExternalPackages: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],

  // Next 16 writes an `AGENTS.md` and a `CLAUDE.md` describing itself. This repo's conventions
  // are the spec in README.md, and a generated file at the root that silently outranks it is
  // worse than no file at all.
  agentRules: false,

  async redirects() {
    return [
      // §7.16.3: `page=1` is the default and is omitted from the canonical form, so the
      // explicit spelling redirects rather than minting a second URL for page one. `page` is
      // the one shelf parameter `robots.txt` deliberately allows, which is exactly why this
      // duplicate has to be closed — a crawlable parameter that has two spellings is a
      // crawlable duplicate.
      {
        source: '/',
        has: [{ type: 'query', key: 'page', value: '1' }],
        destination: '/',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
