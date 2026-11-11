ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "has_password" boolean DEFAULT false NOT NULL;
