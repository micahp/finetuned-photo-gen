-- AlterTable
ALTER TABLE "users" ADD COLUMN     "daily_free_generations" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_free_generation_date" TIMESTAMP(3);
