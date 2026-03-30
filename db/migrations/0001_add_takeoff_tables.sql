CREATE TABLE "assemblies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assembly_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assembly_id" uuid NOT NULL,
	"product_id" uuid,
	"description" varchar(500),
	"qty_per_unit" numeric(10, 4) NOT NULL,
	"unit" varchar(50) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "takeoff_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bid_id" uuid,
	"name" varchar(255) NOT NULL,
	"pdf_file_name" varchar(500),
	"pdf_storage_key" varchar(1000),
	"page_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "takeoff_viewports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"bounds" jsonb,
	"pixels_per_unit" numeric(14, 6),
	"unit" varchar(50) DEFAULT 'ft' NOT NULL,
	"scale_name" varchar(100),
	"scale_preset" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "takeoff_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"color" varchar(20) DEFAULT '#22d3ee' NOT NULL,
	"type" varchar(20) NOT NULL,
	"assembly_id" uuid,
	"unit" varchar(20) DEFAULT 'LF' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"target_field" varchar(200),
	"is_preset" boolean DEFAULT false NOT NULL,
	"category" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "takeoff_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"viewport_id" uuid,
	"type" varchar(50) NOT NULL,
	"geometry" jsonb,
	"calculated_value" numeric(14, 4),
	"unit" varchar(20),
	"label" varchar(500),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "takeoff_page_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"fabric_json" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assembly_items" ADD CONSTRAINT "assembly_items_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_items" ADD CONSTRAINT "assembly_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takeoff_sessions" ADD CONSTRAINT "takeoff_sessions_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takeoff_sessions" ADD CONSTRAINT "takeoff_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takeoff_viewports" ADD CONSTRAINT "takeoff_viewports_session_id_takeoff_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."takeoff_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takeoff_groups" ADD CONSTRAINT "takeoff_groups_session_id_takeoff_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."takeoff_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takeoff_groups" ADD CONSTRAINT "takeoff_groups_assembly_id_assemblies_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."assemblies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takeoff_measurements" ADD CONSTRAINT "takeoff_measurements_group_id_takeoff_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."takeoff_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takeoff_measurements" ADD CONSTRAINT "takeoff_measurements_session_id_takeoff_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."takeoff_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takeoff_measurements" ADD CONSTRAINT "takeoff_measurements_viewport_id_takeoff_viewports_id_fk" FOREIGN KEY ("viewport_id") REFERENCES "public"."takeoff_viewports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takeoff_page_states" ADD CONSTRAINT "takeoff_page_states_session_id_takeoff_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."takeoff_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assembly_items_assembly_idx" ON "assembly_items" USING btree ("assembly_id");--> statement-breakpoint
CREATE INDEX "takeoff_sessions_bid_idx" ON "takeoff_sessions" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "takeoff_viewports_session_idx" ON "takeoff_viewports" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "takeoff_groups_session_idx" ON "takeoff_groups" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "takeoff_measurements_group_idx" ON "takeoff_measurements" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "takeoff_measurements_session_idx" ON "takeoff_measurements" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "takeoff_measurements_page_idx" ON "takeoff_measurements" USING btree ("session_id", "page_number");--> statement-breakpoint
CREATE UNIQUE INDEX "takeoff_page_states_session_page_idx" ON "takeoff_page_states" USING btree ("session_id", "page_number");
