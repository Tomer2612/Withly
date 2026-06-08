-- AlterTable
ALTER TABLE "public"."communities" ADD COLUMN     "planId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."communities" ADD CONSTRAINT "communities_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
