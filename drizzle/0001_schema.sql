CREATE TABLE "alarm_state" (
	"rule" text PRIMARY KEY NOT NULL,
	"breaching" boolean DEFAULT false NOT NULL,
	"breaching_since" timestamp with time zone,
	"last_alarmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"display_name" "citext" NOT NULL,
	"uploader_vote_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "app_user_clerk_user_id_key" UNIQUE("clerk_user_id"),
	CONSTRAINT "app_user_display_name_key" UNIQUE("display_name")
);
--> statement-breakpoint
CREATE TABLE "bookmark" (
	"user_id" uuid NOT NULL,
	"programme_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "bookmark_user_id_programme_id_key" UNIQUE("user_id","programme_id")
);
--> statement-breakpoint
CREATE TABLE "programme" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sector" text,
	"owner_user_id" uuid,
	"licence" text DEFAULT 'CC-BY-4.0' NOT NULL,
	"parent_revision_id" uuid,
	"parent_programme_id" uuid,
	"root_programme_id" uuid NOT NULL,
	"current_revision_id" uuid,
	"status" text NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"search_tsv" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(description, '')), 'B')) STORED,
	CONSTRAINT "programme_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "programme_vote" (
	"voter_user_id" uuid,
	"programme_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "programme_vote_voter_user_id_programme_id_key" UNIQUE("voter_user_id","programme_id")
);
--> statement-breakpoint
CREATE TABLE "reserved_handle" (
	"name" "citext" PRIMARY KEY NOT NULL,
	"released_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revision" (
	"id" uuid PRIMARY KEY NOT NULL,
	"programme_id" uuid NOT NULL,
	"rev_no" integer NOT NULL,
	"uploaded_at" timestamp with time zone NOT NULL,
	"uploader_display_name" "citext" NOT NULL,
	"change_note" text,
	"content_hash" text,
	"is_root_rev" boolean DEFAULT false NOT NULL,
	"terms_version" text NOT NULL,
	"asserted_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"ingest_attempts" smallint DEFAULT 0 NOT NULL,
	"failure_reason" text,
	"failure_detail" text,
	"removal_class" char(1),
	"removed_at" timestamp with time zone,
	"bytes_deleted_at" timestamp with time zone,
	"quarantine_purged_at" timestamp with time zone,
	"p6_version" text,
	"activity_count" integer,
	"start_date" date,
	"finish_date" date,
	"data_date" date,
	"pct_complete" numeric(5, 2),
	"is_baseline" boolean,
	"checks_passed" smallint,
	"checks_applicable" smallint,
	"card" jsonb,
	"derived_version" smallint,
	CONSTRAINT "revision_programme_id_rev_no_key" UNIQUE("programme_id","rev_no")
);
--> statement-breakpoint
CREATE TABLE "sector" (
	"code" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sweep_run" (
	"id" uuid PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"actions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"breaches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "takedown_report" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"reporter_contact" text,
	"contact_purged_at" timestamp with time zone,
	"subject_ref" text,
	"name_as_it_appears" text,
	"reported_reason" text NOT NULL,
	"class" char(1),
	"status" text NOT NULL,
	"resolution_note" text,
	"plan_ref" text,
	"actioned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "upload_intent" (
	"revision_id" uuid PRIMARY KEY NOT NULL,
	"programme_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploader_vote" (
	"voter_user_id" uuid,
	"subject_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uploader_vote_voter_user_id_subject_user_id_key" UNIQUE("voter_user_id","subject_user_id")
);
--> statement-breakpoint
ALTER TABLE "bookmark" ADD CONSTRAINT "bookmark_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmark" ADD CONSTRAINT "bookmark_programme_id_programme_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme" ADD CONSTRAINT "programme_sector_sector_code_fk" FOREIGN KEY ("sector") REFERENCES "public"."sector"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme" ADD CONSTRAINT "programme_owner_user_id_app_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme" ADD CONSTRAINT "programme_parent_revision_id_revision_id_fk" FOREIGN KEY ("parent_revision_id") REFERENCES "public"."revision"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme" ADD CONSTRAINT "programme_parent_programme_id_programme_id_fk" FOREIGN KEY ("parent_programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme" ADD CONSTRAINT "programme_root_programme_id_programme_id_fk" FOREIGN KEY ("root_programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme" ADD CONSTRAINT "programme_current_revision_id_revision_id_fk" FOREIGN KEY ("current_revision_id") REFERENCES "public"."revision"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme_vote" ADD CONSTRAINT "programme_vote_voter_user_id_app_user_id_fk" FOREIGN KEY ("voter_user_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme_vote" ADD CONSTRAINT "programme_vote_programme_id_programme_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision" ADD CONSTRAINT "revision_programme_id_programme_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_intent" ADD CONSTRAINT "upload_intent_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploader_vote" ADD CONSTRAINT "uploader_vote_voter_user_id_app_user_id_fk" FOREIGN KEY ("voter_user_id") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploader_vote" ADD CONSTRAINT "uploader_vote_subject_user_id_app_user_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "programme_search_tsv_idx" ON "programme" USING gin ("search_tsv");--> statement-breakpoint
CREATE INDEX "programme_title_idx" ON "programme" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "programme_created_at_id_idx" ON "programme" USING btree ("created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE UNIQUE INDEX "revision_root_content_hash_uq" ON "revision" USING btree ("content_hash") WHERE "revision"."is_root_rev";--> statement-breakpoint
CREATE INDEX "revision_content_hash_idx" ON "revision" USING btree ("content_hash");