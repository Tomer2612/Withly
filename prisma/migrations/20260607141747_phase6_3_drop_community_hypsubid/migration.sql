/*
  Warnings:

  - You are about to drop the column `hypSubscriptionId` on the `communities` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."communities_hypSubscriptionId_key";

-- AlterTable
ALTER TABLE "public"."communities" DROP COLUMN "hypSubscriptionId";
