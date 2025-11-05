-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "password_salt" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "language" TEXT NOT NULL DEFAULT 'es',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verification_code" TEXT,
    "email_verification_exp" TIMESTAMP(3),
    "password_reset_code" TEXT,
    "password_reset_exp" TIMESTAMP(3),
    "accepted_terms_at" TIMESTAMP(3),
    "accepted_privacy_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiktok_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "open_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "scope_granted" TEXT[],
    "access_token_enc" TEXT NOT NULL,
    "refresh_token_enc" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiktok_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_assets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "storage_url" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "duration_sec" INTEGER,
    "checksum" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_batches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "video_asset_id" TEXT NOT NULL,
    "defaults_json" JSONB NOT NULL,
    "schedule_time_utc" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publish_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_jobs" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tiktok_connection_id" TEXT NOT NULL,
    "video_asset_id" TEXT NOT NULL,
    "caption" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "privacy_status" TEXT NOT NULL DEFAULT 'public',
    "allow_duet" BOOLEAN NOT NULL DEFAULT true,
    "allow_stitch" BOOLEAN NOT NULL DEFAULT true,
    "allow_comment" BOOLEAN NOT NULL DEFAULT true,
    "schedule_time_utc" TIMESTAMP(3),
    "state" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "backoff_sec" INTEGER,
    "tiktok_video_id" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publish_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "type" TEXT NOT NULL,
    "details_json" JSONB NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_patterns" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tiktok_connection_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "logo_url" TEXT,
    "logo_position" TEXT NOT NULL DEFAULT 'bottom-right',
    "logo_size" INTEGER NOT NULL DEFAULT 15,
    "logo_opacity" INTEGER NOT NULL DEFAULT 100,
    "enable_color_grading" BOOLEAN NOT NULL DEFAULT false,
    "brightness" INTEGER NOT NULL DEFAULT 100,
    "contrast" INTEGER NOT NULL DEFAULT 100,
    "saturation" INTEGER NOT NULL DEFAULT 100,
    "temperature" INTEGER NOT NULL DEFAULT 100,
    "tint" INTEGER NOT NULL DEFAULT 100,
    "hue" INTEGER NOT NULL DEFAULT 0,
    "exposure" INTEGER NOT NULL DEFAULT 100,
    "highlights" INTEGER NOT NULL DEFAULT 100,
    "shadows" INTEGER NOT NULL DEFAULT 100,
    "enable_effects" BOOLEAN NOT NULL DEFAULT false,
    "filter_type" TEXT NOT NULL DEFAULT 'none',
    "vignette" INTEGER NOT NULL DEFAULT 0,
    "sharpen" INTEGER NOT NULL DEFAULT 0,
    "blur" INTEGER NOT NULL DEFAULT 0,
    "grain" INTEGER NOT NULL DEFAULT 0,
    "enable_stabilization" BOOLEAN NOT NULL DEFAULT false,
    "enable_denoise" BOOLEAN NOT NULL DEFAULT false,
    "denoise_strength" INTEGER NOT NULL DEFAULT 50,
    "speed_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "enable_smooth_slow" BOOLEAN NOT NULL DEFAULT false,
    "enable_auto_crop" BOOLEAN NOT NULL DEFAULT false,
    "target_aspect_ratio" TEXT NOT NULL DEFAULT 'original',
    "crop_position" TEXT NOT NULL DEFAULT 'center',
    "enable_subtitles" BOOLEAN NOT NULL DEFAULT false,
    "subtitle_style" TEXT NOT NULL DEFAULT 'modern',
    "subtitle_position" TEXT NOT NULL DEFAULT 'bottom',
    "subtitle_color" TEXT NOT NULL DEFAULT '#FFFFFF',
    "subtitle_bg_color" TEXT NOT NULL DEFAULT '#000000',
    "subtitle_font_size" INTEGER NOT NULL DEFAULT 24,
    "subtitle_font_family" TEXT NOT NULL DEFAULT 'Inter',
    "subtitle_animation" TEXT NOT NULL DEFAULT 'none',
    "transition_type" TEXT NOT NULL DEFAULT 'none',
    "transition_duration" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "enable_audio_enhance" BOOLEAN NOT NULL DEFAULT false,
    "audio_normalize" BOOLEAN NOT NULL DEFAULT false,
    "audio_volume" INTEGER NOT NULL DEFAULT 100,
    "enable_bg_music" BOOLEAN NOT NULL DEFAULT false,
    "bg_music_url" TEXT,
    "bg_music_volume" INTEGER NOT NULL DEFAULT 50,
    "output_quality" TEXT NOT NULL DEFAULT 'high',
    "output_bitrate" TEXT NOT NULL DEFAULT 'auto',
    "output_fps" INTEGER NOT NULL DEFAULT 30,
    "thumbnail_url" TEXT,
    "preview_video_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tiktok_connections_open_id_key" ON "tiktok_connections"("open_id");

-- CreateIndex
CREATE INDEX "tiktok_connections_user_id_idx" ON "tiktok_connections"("user_id");

-- CreateIndex
CREATE INDEX "video_assets_user_id_idx" ON "video_assets"("user_id");

-- CreateIndex
CREATE INDEX "video_assets_status_idx" ON "video_assets"("status");

-- CreateIndex
CREATE INDEX "publish_batches_user_id_idx" ON "publish_batches"("user_id");

-- CreateIndex
CREATE INDEX "publish_batches_schedule_time_utc_idx" ON "publish_batches"("schedule_time_utc");

-- CreateIndex
CREATE UNIQUE INDEX "publish_jobs_idempotency_key_key" ON "publish_jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "publish_jobs_batch_id_idx" ON "publish_jobs"("batch_id");

-- CreateIndex
CREATE INDEX "publish_jobs_user_id_idx" ON "publish_jobs"("user_id");

-- CreateIndex
CREATE INDEX "publish_jobs_state_idx" ON "publish_jobs"("state");

-- CreateIndex
CREATE INDEX "publish_jobs_schedule_time_utc_idx" ON "publish_jobs"("schedule_time_utc");

-- CreateIndex
CREATE INDEX "audit_events_user_id_idx" ON "audit_events"("user_id");

-- CreateIndex
CREATE INDEX "audit_events_type_idx" ON "audit_events"("type");

-- CreateIndex
CREATE INDEX "audit_events_created_at_idx" ON "audit_events"("created_at");

-- CreateIndex
CREATE INDEX "webhook_events_provider_idx" ON "webhook_events"("provider");

-- CreateIndex
CREATE INDEX "webhook_events_processed_idx" ON "webhook_events"("processed");

-- CreateIndex
CREATE INDEX "webhook_events_created_at_idx" ON "webhook_events"("created_at");

-- CreateIndex
CREATE INDEX "brand_patterns_user_id_idx" ON "brand_patterns"("user_id");

-- CreateIndex
CREATE INDEX "brand_patterns_tiktok_connection_id_idx" ON "brand_patterns"("tiktok_connection_id");

-- CreateIndex
CREATE INDEX "brand_patterns_is_default_idx" ON "brand_patterns"("is_default");

-- AddForeignKey
ALTER TABLE "tiktok_connections" ADD CONSTRAINT "tiktok_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_batches" ADD CONSTRAINT "publish_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_batches" ADD CONSTRAINT "publish_batches_video_asset_id_fkey" FOREIGN KEY ("video_asset_id") REFERENCES "video_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "publish_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_tiktok_connection_id_fkey" FOREIGN KEY ("tiktok_connection_id") REFERENCES "tiktok_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_video_asset_id_fkey" FOREIGN KEY ("video_asset_id") REFERENCES "video_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_patterns" ADD CONSTRAINT "brand_patterns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_patterns" ADD CONSTRAINT "brand_patterns_tiktok_connection_id_fkey" FOREIGN KEY ("tiktok_connection_id") REFERENCES "tiktok_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
