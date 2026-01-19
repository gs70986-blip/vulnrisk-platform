-- AlterTable
ALTER TABLE "predictions" ADD COLUMN     "explanation" TEXT,
ADD COLUMN     "metadata" JSONB;
