CREATE TYPE "public"."task_kind" AS ENUM('study', 'habit', 'revision');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'done', 'skipped');--> statement-breakpoint
CREATE TABLE "plan_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"kind" "task_kind" NOT NULL,
	"subject_id" text,
	"topic_id" text,
	"subject_name" text,
	"title" text NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"part" integer DEFAULT 1 NOT NULL,
	"parts" integer DEFAULT 1 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_tasks" ADD CONSTRAINT "plan_tasks_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_tasks_plan_date_idx" ON "plan_tasks" USING btree ("plan_id","date");--> statement-breakpoint
CREATE INDEX "plan_tasks_user_date_idx" ON "plan_tasks" USING btree ("user_id","date");