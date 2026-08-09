/**
 * Applies the migrations in `drizzle/`.
 *
 * It goes over `drizzle-orm/neon-http/migrator` deliberately: that keeps migration
 * application on **the same wire production uses** (§4.9), so a statement that the HTTP
 * driver cannot carry fails here rather than at deploy time. The driver has no interactive
 * transaction, so a migration that fails half-way does not roll back — which is the reason
 * each migration in this repo is written to be re-runnable (`if not exists`,
 * `on conflict do nothing`) rather than clever.
 *
 * Run it with `pnpm db:migrate`, against the local stack or against production; the only
 * difference is `DATABASE_URL` and `NEON_FETCH_ENDPOINT`.
 */

import { migrate } from 'drizzle-orm/neon-http/migrator'
import { getDb } from '@/lib/db/client'

async function main(): Promise<void> {
  const db = getDb()
  await migrate(db, { migrationsFolder: 'drizzle' })
  console.log('migrations applied')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
