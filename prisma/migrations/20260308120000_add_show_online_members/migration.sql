-- AlterTable
ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "showOnlineMembers" BOOLEAN NOT NULL DEFAULT true;
