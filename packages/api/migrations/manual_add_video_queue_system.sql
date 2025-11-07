-- Manual Migration: Add Video Queue System
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/srwpupvycoyqdljvjglu/sql

-- 1. Add tier column to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tier" TEXT DEFAULT 'free';

-- 2. Create VideoStatus enum
DO $$ BEGIN
    CREATE TYPE "VideoStatus" AS ENUM (
        'DRAFT',
        'EDITING_QUEUED',
        'EDITING',
        'EDITED',
        'UPLOAD_QUEUED',
        'UPLOADING',
        'POSTED',
        'FAILED_EDIT',
        'FAILED_UPLOAD'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Create design_profiles table
CREATE TABLE IF NOT EXISTS "design_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "spec_json" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "design_profiles_user_id_fkey" FOREIGN KEY ("user_id") 
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "design_profiles_user_id_idx" ON "design_profiles"("user_id");
CREATE INDEX IF NOT EXISTS "design_profiles_active_idx" ON "design_profiles"("active");

-- 4. Add designId to tiktok_connections
ALTER TABLE "tiktok_connections" ADD COLUMN IF NOT EXISTS "design_id" TEXT;
CREATE INDEX IF NOT EXISTS "tiktok_connections_design_id_idx" ON "tiktok_connections"("design_id");

-- 5. Create videos table
CREATE TABLE IF NOT EXISTS "videos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT,
    "status" "VideoStatus" NOT NULL DEFAULT 'DRAFT',
    "src_url" TEXT NOT NULL,
    "edited_url" TEXT,
    "post_url" TEXT,
    "design_id" TEXT,
    "edit_spec_json" JSONB,
    "thumbnail_url" TEXT,
    "duration" DOUBLE PRECISION,
    "title" TEXT,
    "error" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "videos_user_id_fkey" FOREIGN KEY ("user_id") 
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "videos_account_id_fkey" FOREIGN KEY ("account_id") 
        REFERENCES "tiktok_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "videos_design_id_fkey" FOREIGN KEY ("design_id") 
        REFERENCES "design_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "videos_user_id_idx" ON "videos"("user_id");
CREATE INDEX IF NOT EXISTS "videos_account_id_idx" ON "videos"("account_id");
CREATE INDEX IF NOT EXISTS "videos_status_idx" ON "videos"("status");
CREATE INDEX IF NOT EXISTS "videos_created_at_idx" ON "videos"("created_at");

-- 6. Create jobs table
CREATE TABLE IF NOT EXISTS "jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "video_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "log" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "jobs_video_id_fkey" FOREIGN KEY ("video_id") 
        REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "jobs_video_id_idx" ON "jobs"("video_id");
CREATE INDEX IF NOT EXISTS "jobs_type_idx" ON "jobs"("type");
CREATE INDEX IF NOT EXISTS "jobs_status_idx" ON "jobs"("status");
CREATE INDEX IF NOT EXISTS "jobs_priority_idx" ON "jobs"("priority");
CREATE INDEX IF NOT EXISTS "jobs_created_at_idx" ON "jobs"("created_at");

-- 7. Add foreign key constraint for tiktok_connections.design_id
ALTER TABLE "tiktok_connections" 
    DROP CONSTRAINT IF EXISTS "tiktok_connections_design_id_fkey";

ALTER TABLE "tiktok_connections" 
    ADD CONSTRAINT "tiktok_connections_design_id_fkey" 
    FOREIGN KEY ("design_id") REFERENCES "design_profiles"("id") 
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Success message
SELECT 'Migration completed successfully! ✅' as status;
