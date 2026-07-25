-- CreateEnum
CREATE TYPE "ProcessArtifactContentType" AS ENUM ('file', 'link', 'article');

-- AlterTable
ALTER TABLE "process_artifacts" ADD COLUMN     "allow_download" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "content_body" TEXT,
ADD COLUMN     "content_type" "ProcessArtifactContentType" NOT NULL DEFAULT 'file',
ADD COLUMN     "url" TEXT;
