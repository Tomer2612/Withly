-- AlterTable
ALTER TABLE "public"."pending_community_creations" ADD COLUMN     "planId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."pending_community_creations" ADD CONSTRAINT "pending_community_creations_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
