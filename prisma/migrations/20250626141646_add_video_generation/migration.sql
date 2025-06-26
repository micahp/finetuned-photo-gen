-- AlterEnum
ALTER TYPE "RelatedEntityType" ADD VALUE 'video_generation';

-- CreateTable
CREATE TABLE "generated_videos" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "video_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "model_id" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "aspect_ratio" TEXT NOT NULL,
    "fps" INTEGER NOT NULL DEFAULT 24,
    "motion_level" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "file_size" INTEGER,
    "generation_params" JSONB,
    "credits_used" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "fal_job_id" TEXT,
    "generation_duration" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_videos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "generated_videos" ADD CONSTRAINT "generated_videos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
