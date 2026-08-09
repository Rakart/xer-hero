-- The two contrib extensions the schema depends on (§2.10).
--
-- They run before anything else because `citext` is a *column type* — `app_user.display_name`,
-- `reserved_handle.name` and `revision.uploader_display_name` cannot be created without it —
-- and because `pg_trgm` supplies the `gin_trgm_ops` operator class the zero-result search
-- fallback indexes on.
--
-- Both ship with stock Postgres, which is why `docker compose` runs the plain `postgres:16`
-- image and neither extension is a Neon dependency (§4.9).

create extension if not exists citext;
--> statement-breakpoint
create extension if not exists pg_trgm;
