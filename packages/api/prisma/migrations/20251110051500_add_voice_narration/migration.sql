-- AlterTable
ALTER TABLE "BrandPattern" ADD COLUMN     "enable_voice_narration" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "narration_language" TEXT,
ADD COLUMN     "narration_voice_id" TEXT,
ADD COLUMN     "narration_style" TEXT,
ADD COLUMN     "narration_volume" INTEGER NOT NULL DEFAULT 80,
ADD COLUMN     "narration_speed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "original_audio_volume" INTEGER NOT NULL DEFAULT 30;
