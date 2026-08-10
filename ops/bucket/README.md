# The bucket document

`cors.json` is applied by `ops bucket apply` against whatever `S3_ENDPOINT` it is pointed at
— CI and the local compose stack point it at MinIO, the operator points it at R2. **The same
document applied twice** is what makes local CORS and production CORS the same artefact
rather than two things that resemble each other (§5.6).

**`<site-origin>` stays a placeholder and is resolved from `SITE_ORIGIN` at apply time**, by
`src/lib/blob/bucket-document.ts`. The runbook's step 12 says to edit this file in place with
`https://xerhero.com`; that instruction predates the resolution existing in code, and following
it would do two bad things — put a hostname literal into a repo artefact, which §4.8 forbids
everywhere else, and drop whatever origin the operator actually develops against (the committed
`http://localhost:3000` is a default, not everyone's port). Production R2 gets
`https://xerhero.com` because that is what `SITE_ORIGIN` says in `.env.ops` and in Vercel.

The document is parsed in exactly one place for the same reason: `ops bucket apply`,
`ops bucket check` and the edge contract are three readers of **one** decision, and the join the
edge contract exists to make would be worthless if it were a join between two copies.

Three lines exist for reasons that are not obvious:

- **`cache-control` and `x-robots-tag` are in `AllowedHeaders` because the presign signs
  them.** A SigV4 presigned PUT requires the client to send every header in `SignedHeaders`,
  and a browser sending an author-set header needs it allowed at preflight. The `noindex`
  header and the 1-hour TTL on the PI-bearing object are the reason these lines exist.
- **`content-encoding` is here for the same reason, and the spec's own list omits it.**
  §10.4 puts *both* `Content-Type` and `Content-Encoding` in the presign's signed header set,
  but §5.6's `AllowedHeaders` names only the first. `Content-Encoding` is **not** a
  CORS-safelisted request header, so with it signed and not allowed, the preflight for every
  presigned PUT is denied and upload cannot work at all. Adding it is the reading that makes
  the two sections agree; dropping it from the presign would contradict §10.4 instead. The
  `edge-contract` CI job derives its preflight list from the presign's own output, so this
  stays true by test rather than by memory.
- **`content-length` is deliberately absent.** Browsers set it themselves and forbid authors
  from setting it, so it never appears in `Access-Control-Request-Headers`.
- **`x-amz-*` covers a live hazard.** AWS SDK v3 computes a request checksum by default,
  adding `x-amz-checksum-crc32` to PUTs, which on a presigned browser PUT silently becomes a
  required signed header. `src/lib/blob/client.ts` sets `requestChecksumCalculation` to
  `WHEN_REQUIRED` to take that decision back, and this line is the belt to that braces.

**There are no bucket lifecycle rules, on purpose.** Every clock in this system is a Postgres
predicate the sweep evaluates — the 24 h reap, the 30-day quarantine, every alarm window. A
bucket lifecycle rule would be a second scheduler with its own state, drifting silently
against the rows. The bucket carries no policy at all beyond CORS.
