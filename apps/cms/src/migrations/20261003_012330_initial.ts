import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // The CMS lives in its own schema so it can share a database safely (CMS_DB_SCHEMA=armyx_cms).
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "armyx_cms";`)
  await db.execute(sql`
   CREATE TYPE "armyx_cms"."enum_users_role" AS ENUM('admin', 'editor');
  CREATE TYPE "armyx_cms"."enum_news_category" AS ENUM('press-release', 'operations', 'training', 'civil-military', 'welfare', 'sports');
  CREATE TYPE "armyx_cms"."enum_news_status" AS ENUM('draft', 'published');
  CREATE TYPE "armyx_cms"."enum__news_v_version_category" AS ENUM('press-release', 'operations', 'training', 'civil-military', 'welfare', 'sports');
  CREATE TYPE "armyx_cms"."enum__news_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "armyx_cms"."enum_events_category" AS ENUM('ceremony', 'recruitment', 'sports', 'community', 'training');
  CREATE TYPE "armyx_cms"."enum_gallery_type" AS ENUM('photo', 'video');
  CREATE TYPE "armyx_cms"."enum_ranks_category" AS ENUM('commissioned', 'non-commissioned', 'other');
  CREATE TYPE "armyx_cms"."enum_institutions_type" AS ENUM('academy', 'depot', 'school', 'college');
  CREATE TYPE "armyx_cms"."enum_faqs_category" AS ENUM('eligibility', 'application', 'documents', 'screening', 'training', 'general');
  CREATE TYPE "armyx_cms"."enum_downloads_category" AS ENUM('forms', 'publications', 'reports', 'policies');
  CREATE TYPE "armyx_cms"."enum_downloads_file_type" AS ENUM('PDF', 'DOCX', 'XLSX');
  CREATE TYPE "armyx_cms"."enum_tenders_category" AS ENUM('works', 'goods', 'services', 'consultancy');
  CREATE TYPE "armyx_cms"."enum_tenders_status" AS ENUM('open', 'closed', 'awarded', 'cancelled');
  CREATE TYPE "armyx_cms"."enum_welfare_services_area" AS ENUM('healthcare', 'pension', 'housing', 'education', 'insurance', 'support');
  CREATE TYPE "armyx_cms"."enum_welfare_slug" AS ENUM('serving-personnel', 'veterans', 'families');
  CREATE TABLE "armyx_cms"."users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "armyx_cms"."enum_users_role" DEFAULT 'editor' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "armyx_cms"."media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_hero_url" varchar,
  	"sizes_hero_width" numeric,
  	"sizes_hero_height" numeric,
  	"sizes_hero_mime_type" varchar,
  	"sizes_hero_filesize" numeric,
  	"sizes_hero_filename" varchar
  );
  
  CREATE TABLE "armyx_cms"."news_body" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "armyx_cms"."news" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"excerpt" varchar,
  	"category" "armyx_cms"."enum_news_category",
  	"published_at" timestamp(3) with time zone,
  	"image" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "armyx_cms"."enum_news_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "armyx_cms"."_news_v_version_body" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "armyx_cms"."_news_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_excerpt" varchar,
  	"version_category" "armyx_cms"."enum__news_v_version_category",
  	"version_published_at" timestamp(3) with time zone,
  	"version_image" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "armyx_cms"."enum__news_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "armyx_cms"."announcements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"summary" varchar NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"href" varchar,
  	"urgent" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"end_date" timestamp(3) with time zone,
  	"location" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"category" "armyx_cms"."enum_events_category" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."gallery" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"type" "armyx_cms"."enum_gallery_type" NOT NULL,
  	"src" varchar NOT NULL,
  	"video_url" varchar,
  	"date" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."leaders_bio" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."leaders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"rank" varchar NOT NULL,
  	"appointment" varchar NOT NULL,
  	"photo" varchar NOT NULL,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."ranks" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"abbreviation" varchar NOT NULL,
  	"category" "armyx_cms"."enum_ranks_category" NOT NULL,
  	"nato_code" varchar NOT NULL,
  	"order" numeric NOT NULL,
  	"insignia" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."institutions_courses" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."institutions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"location" varchar NOT NULL,
  	"state" varchar NOT NULL,
  	"type" "armyx_cms"."enum_institutions_type" NOT NULL,
  	"description" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."faqs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL,
  	"category" "armyx_cms"."enum_faqs_category" NOT NULL,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."downloads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"category" "armyx_cms"."enum_downloads_category" NOT NULL,
  	"file_type" "armyx_cms"."enum_downloads_file_type" NOT NULL,
  	"size_kb" numeric NOT NULL,
  	"url" varchar NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."tenders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"ref" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"category" "armyx_cms"."enum_tenders_category" NOT NULL,
  	"published_at" timestamp(3) with time zone NOT NULL,
  	"deadline" timestamp(3) with time zone NOT NULL,
  	"status" "armyx_cms"."enum_tenders_status" NOT NULL,
  	"description" varchar NOT NULL,
  	"document_url" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."welfare_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"area" "armyx_cms"."enum_welfare_services_area" NOT NULL,
  	"description" varchar NOT NULL,
  	"contact" varchar
  );
  
  CREATE TABLE "armyx_cms"."welfare" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" "armyx_cms"."enum_welfare_slug" NOT NULL,
  	"title" varchar NOT NULL,
  	"intro" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"news_id" integer,
  	"announcements_id" integer,
  	"events_id" integer,
  	"gallery_id" integer,
  	"leaders_id" integer,
  	"ranks_id" integer,
  	"institutions_id" integer,
  	"faqs_id" integer,
  	"downloads_id" integer,
  	"tenders_id" integer,
  	"welfare_id" integer
  );
  
  CREATE TABLE "armyx_cms"."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "armyx_cms"."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."site_settings_emergency_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"number" varchar NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."site_settings_social" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."site_settings_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"year" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."site_settings_core_values" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "armyx_cms"."site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"motto" varchar NOT NULL,
  	"hero_title" varchar NOT NULL,
  	"hero_subtitle" varchar NOT NULL,
  	"mission" varchar NOT NULL,
  	"vision" varchar NOT NULL,
  	"hq_address" varchar NOT NULL,
  	"hq_phones" jsonb NOT NULL,
  	"hq_email" varchar NOT NULL,
  	"hq_map_embed" varchar NOT NULL,
  	"org_chart" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "armyx_cms"."users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "armyx_cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."news_body" ADD CONSTRAINT "news_body_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "armyx_cms"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."_news_v_version_body" ADD CONSTRAINT "_news_v_version_body_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "armyx_cms"."_news_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."_news_v" ADD CONSTRAINT "_news_v_parent_id_news_id_fk" FOREIGN KEY ("parent_id") REFERENCES "armyx_cms"."news"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "armyx_cms"."leaders_bio" ADD CONSTRAINT "leaders_bio_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "armyx_cms"."leaders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."institutions_courses" ADD CONSTRAINT "institutions_courses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "armyx_cms"."institutions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."welfare_services" ADD CONSTRAINT "welfare_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "armyx_cms"."welfare"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "armyx_cms"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "armyx_cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "armyx_cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_news_fk" FOREIGN KEY ("news_id") REFERENCES "armyx_cms"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_announcements_fk" FOREIGN KEY ("announcements_id") REFERENCES "armyx_cms"."announcements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "armyx_cms"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gallery_fk" FOREIGN KEY ("gallery_id") REFERENCES "armyx_cms"."gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_leaders_fk" FOREIGN KEY ("leaders_id") REFERENCES "armyx_cms"."leaders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ranks_fk" FOREIGN KEY ("ranks_id") REFERENCES "armyx_cms"."ranks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_institutions_fk" FOREIGN KEY ("institutions_id") REFERENCES "armyx_cms"."institutions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_faqs_fk" FOREIGN KEY ("faqs_id") REFERENCES "armyx_cms"."faqs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_downloads_fk" FOREIGN KEY ("downloads_id") REFERENCES "armyx_cms"."downloads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenders_fk" FOREIGN KEY ("tenders_id") REFERENCES "armyx_cms"."tenders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_welfare_fk" FOREIGN KEY ("welfare_id") REFERENCES "armyx_cms"."welfare"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "armyx_cms"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "armyx_cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."site_settings_emergency_lines" ADD CONSTRAINT "site_settings_emergency_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "armyx_cms"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."site_settings_social" ADD CONSTRAINT "site_settings_social_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "armyx_cms"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."site_settings_history" ADD CONSTRAINT "site_settings_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "armyx_cms"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "armyx_cms"."site_settings_core_values" ADD CONSTRAINT "site_settings_core_values_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "armyx_cms"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "armyx_cms"."users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "armyx_cms"."users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "armyx_cms"."users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "armyx_cms"."users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "armyx_cms"."users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "armyx_cms"."media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "armyx_cms"."media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "armyx_cms"."media" USING btree ("filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "armyx_cms"."media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_hero_sizes_hero_filename_idx" ON "armyx_cms"."media" USING btree ("sizes_hero_filename");
  CREATE INDEX "news_body_order_idx" ON "armyx_cms"."news_body" USING btree ("_order");
  CREATE INDEX "news_body_parent_id_idx" ON "armyx_cms"."news_body" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "news_slug_idx" ON "armyx_cms"."news" USING btree ("slug");
  CREATE INDEX "news_updated_at_idx" ON "armyx_cms"."news" USING btree ("updated_at");
  CREATE INDEX "news_created_at_idx" ON "armyx_cms"."news" USING btree ("created_at");
  CREATE INDEX "news__status_idx" ON "armyx_cms"."news" USING btree ("_status");
  CREATE INDEX "_news_v_version_body_order_idx" ON "armyx_cms"."_news_v_version_body" USING btree ("_order");
  CREATE INDEX "_news_v_version_body_parent_id_idx" ON "armyx_cms"."_news_v_version_body" USING btree ("_parent_id");
  CREATE INDEX "_news_v_parent_idx" ON "armyx_cms"."_news_v" USING btree ("parent_id");
  CREATE INDEX "_news_v_version_version_slug_idx" ON "armyx_cms"."_news_v" USING btree ("version_slug");
  CREATE INDEX "_news_v_version_version_updated_at_idx" ON "armyx_cms"."_news_v" USING btree ("version_updated_at");
  CREATE INDEX "_news_v_version_version_created_at_idx" ON "armyx_cms"."_news_v" USING btree ("version_created_at");
  CREATE INDEX "_news_v_version_version__status_idx" ON "armyx_cms"."_news_v" USING btree ("version__status");
  CREATE INDEX "_news_v_created_at_idx" ON "armyx_cms"."_news_v" USING btree ("created_at");
  CREATE INDEX "_news_v_updated_at_idx" ON "armyx_cms"."_news_v" USING btree ("updated_at");
  CREATE INDEX "_news_v_latest_idx" ON "armyx_cms"."_news_v" USING btree ("latest");
  CREATE INDEX "announcements_updated_at_idx" ON "armyx_cms"."announcements" USING btree ("updated_at");
  CREATE INDEX "announcements_created_at_idx" ON "armyx_cms"."announcements" USING btree ("created_at");
  CREATE UNIQUE INDEX "events_slug_idx" ON "armyx_cms"."events" USING btree ("slug");
  CREATE INDEX "events_updated_at_idx" ON "armyx_cms"."events" USING btree ("updated_at");
  CREATE INDEX "events_created_at_idx" ON "armyx_cms"."events" USING btree ("created_at");
  CREATE INDEX "gallery_updated_at_idx" ON "armyx_cms"."gallery" USING btree ("updated_at");
  CREATE INDEX "gallery_created_at_idx" ON "armyx_cms"."gallery" USING btree ("created_at");
  CREATE INDEX "leaders_bio_order_idx" ON "armyx_cms"."leaders_bio" USING btree ("_order");
  CREATE INDEX "leaders_bio_parent_id_idx" ON "armyx_cms"."leaders_bio" USING btree ("_parent_id");
  CREATE INDEX "leaders_updated_at_idx" ON "armyx_cms"."leaders" USING btree ("updated_at");
  CREATE INDEX "leaders_created_at_idx" ON "armyx_cms"."leaders" USING btree ("created_at");
  CREATE INDEX "ranks_updated_at_idx" ON "armyx_cms"."ranks" USING btree ("updated_at");
  CREATE INDEX "ranks_created_at_idx" ON "armyx_cms"."ranks" USING btree ("created_at");
  CREATE INDEX "institutions_courses_order_idx" ON "armyx_cms"."institutions_courses" USING btree ("_order");
  CREATE INDEX "institutions_courses_parent_id_idx" ON "armyx_cms"."institutions_courses" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "institutions_slug_idx" ON "armyx_cms"."institutions" USING btree ("slug");
  CREATE INDEX "institutions_updated_at_idx" ON "armyx_cms"."institutions" USING btree ("updated_at");
  CREATE INDEX "institutions_created_at_idx" ON "armyx_cms"."institutions" USING btree ("created_at");
  CREATE INDEX "faqs_updated_at_idx" ON "armyx_cms"."faqs" USING btree ("updated_at");
  CREATE INDEX "faqs_created_at_idx" ON "armyx_cms"."faqs" USING btree ("created_at");
  CREATE INDEX "downloads_updated_at_idx" ON "armyx_cms"."downloads" USING btree ("updated_at");
  CREATE INDEX "downloads_created_at_idx" ON "armyx_cms"."downloads" USING btree ("created_at");
  CREATE UNIQUE INDEX "tenders_ref_idx" ON "armyx_cms"."tenders" USING btree ("ref");
  CREATE INDEX "tenders_updated_at_idx" ON "armyx_cms"."tenders" USING btree ("updated_at");
  CREATE INDEX "tenders_created_at_idx" ON "armyx_cms"."tenders" USING btree ("created_at");
  CREATE INDEX "welfare_services_order_idx" ON "armyx_cms"."welfare_services" USING btree ("_order");
  CREATE INDEX "welfare_services_parent_id_idx" ON "armyx_cms"."welfare_services" USING btree ("_parent_id");
  CREATE INDEX "welfare_updated_at_idx" ON "armyx_cms"."welfare" USING btree ("updated_at");
  CREATE INDEX "welfare_created_at_idx" ON "armyx_cms"."welfare" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "armyx_cms"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "armyx_cms"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "armyx_cms"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "armyx_cms"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "armyx_cms"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "armyx_cms"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "armyx_cms"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "armyx_cms"."payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "armyx_cms"."payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_news_id_idx" ON "armyx_cms"."payload_locked_documents_rels" USING btree ("news_id");
  CREATE INDEX "payload_locked_documents_rels_announcements_id_idx" ON "armyx_cms"."payload_locked_documents_rels" USING btree ("announcements_id");
  CREATE INDEX "payload_locked_documents_rels_events_id_idx" ON "armyx_cms"."payload_locked_documents_rels" USING btree ("events_id");
  CREATE INDEX "payload_locked_documents_rels_gallery_id_idx" ON "armyx_cms"."payload_locked_documents_rels" USING btree ("gallery_id");
  CREATE INDEX "payload_locked_documents_rels_leaders_id_idx" ON "armyx_cms"."payload_locked_documents_rels" USING btree ("leaders_id");
  CREATE INDEX "payload_locked_documents_rels_ranks_id_idx" ON "armyx_cms"."payload_locked_documents_rels" USING btree ("ranks_id");
  CREATE INDEX "payload_locked_documents_rels_institutions_id_idx" ON "armyx_cms"."payload_locked_documents_rels" USING btree ("institutions_id");
  CREATE INDEX "payload_locked_documents_rels_faqs_id_idx" ON "armyx_cms"."payload_locked_documents_rels" USING btree ("faqs_id");
  CREATE INDEX "payload_locked_documents_rels_downloads_id_idx" ON "armyx_cms"."payload_locked_documents_rels" USING btree ("downloads_id");
  CREATE INDEX "payload_locked_documents_rels_tenders_id_idx" ON "armyx_cms"."payload_locked_documents_rels" USING btree ("tenders_id");
  CREATE INDEX "payload_locked_documents_rels_welfare_id_idx" ON "armyx_cms"."payload_locked_documents_rels" USING btree ("welfare_id");
  CREATE INDEX "payload_preferences_key_idx" ON "armyx_cms"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "armyx_cms"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "armyx_cms"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "armyx_cms"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "armyx_cms"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "armyx_cms"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "armyx_cms"."payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "armyx_cms"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "armyx_cms"."payload_migrations" USING btree ("created_at");
  CREATE INDEX "site_settings_emergency_lines_order_idx" ON "armyx_cms"."site_settings_emergency_lines" USING btree ("_order");
  CREATE INDEX "site_settings_emergency_lines_parent_id_idx" ON "armyx_cms"."site_settings_emergency_lines" USING btree ("_parent_id");
  CREATE INDEX "site_settings_social_order_idx" ON "armyx_cms"."site_settings_social" USING btree ("_order");
  CREATE INDEX "site_settings_social_parent_id_idx" ON "armyx_cms"."site_settings_social" USING btree ("_parent_id");
  CREATE INDEX "site_settings_history_order_idx" ON "armyx_cms"."site_settings_history" USING btree ("_order");
  CREATE INDEX "site_settings_history_parent_id_idx" ON "armyx_cms"."site_settings_history" USING btree ("_parent_id");
  CREATE INDEX "site_settings_core_values_order_idx" ON "armyx_cms"."site_settings_core_values" USING btree ("_order");
  CREATE INDEX "site_settings_core_values_parent_id_idx" ON "armyx_cms"."site_settings_core_values" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "armyx_cms"."users_sessions" CASCADE;
  DROP TABLE "armyx_cms"."users" CASCADE;
  DROP TABLE "armyx_cms"."media" CASCADE;
  DROP TABLE "armyx_cms"."news_body" CASCADE;
  DROP TABLE "armyx_cms"."news" CASCADE;
  DROP TABLE "armyx_cms"."_news_v_version_body" CASCADE;
  DROP TABLE "armyx_cms"."_news_v" CASCADE;
  DROP TABLE "armyx_cms"."announcements" CASCADE;
  DROP TABLE "armyx_cms"."events" CASCADE;
  DROP TABLE "armyx_cms"."gallery" CASCADE;
  DROP TABLE "armyx_cms"."leaders_bio" CASCADE;
  DROP TABLE "armyx_cms"."leaders" CASCADE;
  DROP TABLE "armyx_cms"."ranks" CASCADE;
  DROP TABLE "armyx_cms"."institutions_courses" CASCADE;
  DROP TABLE "armyx_cms"."institutions" CASCADE;
  DROP TABLE "armyx_cms"."faqs" CASCADE;
  DROP TABLE "armyx_cms"."downloads" CASCADE;
  DROP TABLE "armyx_cms"."tenders" CASCADE;
  DROP TABLE "armyx_cms"."welfare_services" CASCADE;
  DROP TABLE "armyx_cms"."welfare" CASCADE;
  DROP TABLE "armyx_cms"."payload_kv" CASCADE;
  DROP TABLE "armyx_cms"."payload_locked_documents" CASCADE;
  DROP TABLE "armyx_cms"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "armyx_cms"."payload_preferences" CASCADE;
  DROP TABLE "armyx_cms"."payload_preferences_rels" CASCADE;
  DROP TABLE "armyx_cms"."payload_migrations" CASCADE;
  DROP TABLE "armyx_cms"."site_settings_emergency_lines" CASCADE;
  DROP TABLE "armyx_cms"."site_settings_social" CASCADE;
  DROP TABLE "armyx_cms"."site_settings_history" CASCADE;
  DROP TABLE "armyx_cms"."site_settings_core_values" CASCADE;
  DROP TABLE "armyx_cms"."site_settings" CASCADE;
  DROP TYPE "armyx_cms"."enum_users_role";
  DROP TYPE "armyx_cms"."enum_news_category";
  DROP TYPE "armyx_cms"."enum_news_status";
  DROP TYPE "armyx_cms"."enum__news_v_version_category";
  DROP TYPE "armyx_cms"."enum__news_v_version_status";
  DROP TYPE "armyx_cms"."enum_events_category";
  DROP TYPE "armyx_cms"."enum_gallery_type";
  DROP TYPE "armyx_cms"."enum_ranks_category";
  DROP TYPE "armyx_cms"."enum_institutions_type";
  DROP TYPE "armyx_cms"."enum_faqs_category";
  DROP TYPE "armyx_cms"."enum_downloads_category";
  DROP TYPE "armyx_cms"."enum_downloads_file_type";
  DROP TYPE "armyx_cms"."enum_tenders_category";
  DROP TYPE "armyx_cms"."enum_tenders_status";
  DROP TYPE "armyx_cms"."enum_welfare_services_area";
  DROP TYPE "armyx_cms"."enum_welfare_slug";`)
}
