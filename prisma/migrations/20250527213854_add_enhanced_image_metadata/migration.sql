-- AlterTable
ALTER TABLE "generated_images" ADD COLUMN     "file_size" INTEGER,
ADD COLUMN     "generation_duration" INTEGER,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "original_temp_url" TEXT,
ADD COLUMN     "width" INTEGER;
