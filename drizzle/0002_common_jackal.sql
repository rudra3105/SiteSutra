CREATE TABLE "accounting" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"amount" double precision NOT NULL,
	"description" text NOT NULL,
	"payment_mode" text NOT NULL,
	"reference" text,
	"date" text NOT NULL,
	"invoice_no" text,
	"lpo_id" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"labour_id" text NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"status" text NOT NULL,
	"half_day" boolean DEFAULT false NOT NULL,
	"overtime" double precision,
	"notes" text,
	"synced" boolean DEFAULT true NOT NULL,
	"offline_id" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	CONSTRAINT "attendance_offline_id_unique" UNIQUE("offline_id"),
	CONSTRAINT "attendance_labour_id_date_unique" UNIQUE("labour_id","date")
);
--> statement-breakpoint
CREATE TABLE "cashbook_access" (
	"id" text PRIMARY KEY NOT NULL,
	"cashbook_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cashbook_custom_fields" (
	"id" text PRIMARY KEY NOT NULL,
	"cashbook_id" text NOT NULL,
	"label" text NOT NULL,
	"field_type" text DEFAULT 'TEXT' NOT NULL,
	"options" text,
	"required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cashbook_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"cashbook_id" text NOT NULL,
	"site_id" text NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"amount" double precision NOT NULL,
	"description" text NOT NULL,
	"payment_mode" text NOT NULL,
	"reference" text,
	"vendor" text,
	"date" text NOT NULL,
	"lpo_number" text,
	"lpo_status" text,
	"party_name" text,
	"proof_url" text,
	"custom_field_values" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "cashbooks" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_payment_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ideal_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"work_type_id" text NOT NULL,
	"material_id" text NOT NULL,
	"ideal_qty_per" double precision NOT NULL,
	"description" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labour" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"trade" text NOT NULL,
	"daily_wage" double precision NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"join_date" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labour_teams" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"attendance_method" text DEFAULT 'INDIVIDUAL' NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lpos" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"lpo_number" text NOT NULL,
	"vendor" text NOT NULL,
	"description" text NOT NULL,
	"amount" double precision NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"issue_date" text NOT NULL,
	"due_date" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	CONSTRAINT "lpos_lpo_number_unique" UNIQUE("lpo_number")
);
--> statement-breakpoint
CREATE TABLE "material_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"material_id" text NOT NULL,
	"type" text NOT NULL,
	"quantity" double precision NOT NULL,
	"unit_price" double precision,
	"notes" text,
	"date" text NOT NULL,
	"synced" boolean DEFAULT true NOT NULL,
	"offline_id" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	CONSTRAINT "material_logs_offline_id_unique" UNIQUE("offline_id")
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"phone" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll" (
	"id" text PRIMARY KEY NOT NULL,
	"labour_id" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"total_days" double precision NOT NULL,
	"daily_wage" double precision NOT NULL,
	"overtime" double precision DEFAULT 0 NOT NULL,
	"deductions" double precision DEFAULT 0 NOT NULL,
	"net_amount" double precision NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"paid_at" text,
	"payment_mode" text,
	"notes" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_access" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"site_id" text NOT NULL,
	CONSTRAINT "site_access_user_id_site_id_unique" UNIQUE("user_id","site_id")
);
--> statement-breakpoint
CREATE TABLE "site_locations" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"location_no" text NOT NULL,
	"tower_type" text NOT NULL,
	"span" text,
	"work_stage" text DEFAULT 'FOUNDATION' NOT NULL,
	"notes" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_work_status" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"work_stage" text DEFAULT 'FOUNDATION' NOT NULL,
	"attendance_method" text DEFAULT 'INDIVIDUAL' NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	CONSTRAINT "site_work_status_site_id_unique" UNIQUE("site_id")
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"budget" double precision DEFAULT 0 NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"labour_id" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	CONSTRAINT "team_members_team_id_labour_id_unique" UNIQUE("team_id","labour_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'SUPERVISOR' NOT NULL,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	"updated_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "work_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"user_id" text NOT NULL,
	"work_type_id" text NOT NULL,
	"description" text,
	"quantity" double precision NOT NULL,
	"unit" text NOT NULL,
	"date" text NOT NULL,
	"synced" boolean DEFAULT true NOT NULL,
	"offline_id" text,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL,
	CONSTRAINT "work_logs_offline_id_unique" UNIQUE("offline_id")
);
--> statement-breakpoint
CREATE TABLE "work_types" (
	"id" text PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"created_at" text DEFAULT CURRENT_TIMESTAMP::text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounting" ADD CONSTRAINT "accounting_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_labour_id_labour_id_fk" FOREIGN KEY ("labour_id") REFERENCES "public"."labour"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashbook_access" ADD CONSTRAINT "cashbook_access_cashbook_id_cashbooks_id_fk" FOREIGN KEY ("cashbook_id") REFERENCES "public"."cashbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashbook_custom_fields" ADD CONSTRAINT "cashbook_custom_fields_cashbook_id_cashbooks_id_fk" FOREIGN KEY ("cashbook_id") REFERENCES "public"."cashbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashbook_entries" ADD CONSTRAINT "cashbook_entries_cashbook_id_cashbooks_id_fk" FOREIGN KEY ("cashbook_id") REFERENCES "public"."cashbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashbook_entries" ADD CONSTRAINT "cashbook_entries_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashbooks" ADD CONSTRAINT "cashbooks_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_payment_methods" ADD CONSTRAINT "custom_payment_methods_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideal_rules" ADD CONSTRAINT "ideal_rules_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideal_rules" ADD CONSTRAINT "ideal_rules_work_type_id_work_types_id_fk" FOREIGN KEY ("work_type_id") REFERENCES "public"."work_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideal_rules" ADD CONSTRAINT "ideal_rules_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labour" ADD CONSTRAINT "labour_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labour_teams" ADD CONSTRAINT "labour_teams_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lpos" ADD CONSTRAINT "lpos_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_logs" ADD CONSTRAINT "material_logs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_logs" ADD CONSTRAINT "material_logs_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll" ADD CONSTRAINT "payroll_labour_id_labour_id_fk" FOREIGN KEY ("labour_id") REFERENCES "public"."labour"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_access" ADD CONSTRAINT "site_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_access" ADD CONSTRAINT "site_access_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_locations" ADD CONSTRAINT "site_locations_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_work_status" ADD CONSTRAINT "site_work_status_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_labour_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."labour_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_labour_id_labour_id_fk" FOREIGN KEY ("labour_id") REFERENCES "public"."labour"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_work_type_id_work_types_id_fk" FOREIGN KEY ("work_type_id") REFERENCES "public"."work_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_types" ADD CONSTRAINT "work_types_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;