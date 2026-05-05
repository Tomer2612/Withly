-- CreateEnum
CREATE TYPE "public"."CommunitySubscriptionStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."NotificationType" ADD VALUE 'COMMUNITY_SCHEDULED_FOR_SUSPENSION';
ALTER TYPE "public"."NotificationType" ADD VALUE 'COMMUNITY_SUSPENDED';
ALTER TYPE "public"."NotificationType" ADD VALUE 'COMMUNITY_REACTIVATED';

-- DropForeignKey
ALTER TABLE "public"."poll_votes" DROP CONSTRAINT "poll_votes_userId_fkey";

-- AlterTable
ALTER TABLE "public"."Post" ALTER COLUMN "videos" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "notifyMessages",
ALTER COLUMN "notifyCommunityJoins" SET DEFAULT true,
ALTER COLUMN "notifyFollows" SET DEFAULT true,
ALTER COLUMN "notifyMentions" SET DEFAULT true;

-- AlterTable
ALTER TABLE "public"."communities" DROP COLUMN "trialCancelled",
ADD COLUMN     "pendingPrice" DOUBLE PRECISION,
ADD COLUMN     "pendingPriceEffectiveAt" TIMESTAMP(3),
ADD COLUMN     "priceChangeAnnouncedAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionCancelledAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionStatus" "public"."CommunitySubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."community_members" ADD COLUMN     "priceChangeSeenForEffectiveAt" TIMESTAMP(3),
ADD COLUMN     "suspensionScheduledSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."notifications" DROP COLUMN "commentId",
DROP COLUMN "message";

-- AddForeignKey
ALTER TABLE "public"."poll_votes" ADD CONSTRAINT "poll_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."poll_votes_optionId_oderId_key" RENAME TO "poll_votes_optionId_userId_key";

