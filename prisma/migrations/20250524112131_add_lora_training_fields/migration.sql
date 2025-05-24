-- AlterTable
ALTER TABLE "user_models" ADD COLUMN     "external_training_id" TEXT,
ADD COLUMN     "external_training_service" TEXT,
ADD COLUMN     "huggingface_repo" TEXT,
ADD COLUMN     "huggingface_status" TEXT,
ADD COLUMN     "lora_ready_for_inference" BOOLEAN NOT NULL DEFAULT false;
