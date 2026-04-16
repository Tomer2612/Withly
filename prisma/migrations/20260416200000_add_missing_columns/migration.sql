-- CreateEnum
CREATE TYPE "CommunityStatus" AS ENUM ('DRAFT', 'PRIVATE', 'PUBLIC');

-- AlterTable: communities
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "galleryVideos" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "showOnlineMembers" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "status" "CommunityStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable: Post
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "videos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: events
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
