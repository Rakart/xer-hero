import { defineConfig } from 'drizzle-kit'

// `generate` only reads the schema; the credentials are here so `drizzle-kit studio` and
// introspection work against the local stack too. Migrations are applied by
// `src/scripts/migrate.ts` over the neon-http driver, which is the production path.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/xerhero',
  },
  verbose: true,
  strict: true,
})
