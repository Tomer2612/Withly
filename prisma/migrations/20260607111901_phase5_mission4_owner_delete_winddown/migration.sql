-- DropForeignKey
ALTER TABLE "public"."communities" DROP CONSTRAINT "communities_ownerId_fkey";

-- AlterTable
ALTER TABLE "public"."communities" ADD COLUMN     "ownerDeletedAt" TIMESTAMP(3),
ALTER COLUMN "ownerId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."communities" ADD CONSTRAINT "communities_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
