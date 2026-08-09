/**
 * The database client.
 *
 * **`drizzle-orm/neon-http` is the only driver, in development as well as in production.**
 * It speaks one HTTP request per statement: batched, non-interactive transactions only —
 * no `BEGIN…COMMIT`, no WebSocket pool. Three closed decisions rest on that limit, so §4.9
 * rejects `node-postgres` in development on the *direction* of its divergence: dev would be
 * *more* capable than production, and someone would write a `BEGIN…COMMIT` that passes
 * locally, passes review and fails in production. Do not add `pg` or `postgres` here.
 *
 * The circular `programme` ↔ `revision` foreign keys are the case that proves the driver
 * suffices: insert the Programme with a null `current_revision_id`, insert the Revision,
 * update after — a **batch** rather than an interactive transaction, which works precisely
 * because the ids are uuids the caller generates (§2.10). `db.batch([...])` is the API.
 *
 * Local development differs from production by exactly one swap: `NEON_FETCH_ENDPOINT`
 * points the driver at the HTTP proxy from `docker-compose.yml` instead of at the hosted
 * service. No vendor is named in product code — both are named in an environment variable
 * (§4.9).
 */

import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'

export type Db = NeonHttpDatabase<typeof schema>

/**
 * Present locally, absent in production. Setting it is global to the driver, so it happens
 * once at module load and before any query is built. When it is absent the driver is left
 * entirely alone — that is the whole of the dev↔prod difference, and the reason there is no
 * adapter, no interface and no second code path to rot.
 */
if (process.env.NEON_FETCH_ENDPOINT) {
  neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT
}

/**
 * Build a client against an explicit connection string. Used by the migrator and by tests
 * that stand up a throwaway database; application code wants {@link getDb}.
 */
export function createDb(connectionString: string): Db {
  return drizzle(neon(connectionString), { schema })
}

let cached: Db | undefined

/**
 * The process-wide client.
 *
 * Deliberately lazy rather than a module-level `export const db`: `neon()` opens no socket,
 * but reading `DATABASE_URL` at import time turns a missing environment variable into a
 * *build* failure in anything that so much as imports a query module — including the unit
 * tests, which never touch a server.
 */
export function getDb(): Db {
  if (cached) return cached
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local (§4.8).')
  }
  cached = createDb(url)
  return cached
}
