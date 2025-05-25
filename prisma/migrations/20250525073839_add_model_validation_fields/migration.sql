-- AlterTable
ALTER TABLE "user_models" ADD COLUMN     "last_validation_check" TIMESTAMP(3),
ADD COLUMN     "validation_error" TEXT,
ADD COLUMN     "validation_error_type" TEXT,
ADD COLUMN     "validation_status" TEXT DEFAULT 'unknown';
