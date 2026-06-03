-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "planId" TEXT;

-- CreateTable
CREATE TABLE "public"."plans" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyPriceILS" INTEGER NOT NULL,
    "commissionBasisPoints" INTEGER NOT NULL DEFAULT 500,
    "trialLengthMonths" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "features" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_slug_key" ON "public"."plans"("slug");

-- CreateIndex
CREATE INDEX "plans_isActive_idx" ON "public"."plans"("isActive");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: the default community plan. Stable id so subsequent migrations
-- and seeds can reference it without a lookup. Matches the previously-
-- hardcoded values: 99 ILS/month, 5% commission (500 basis points),
-- 1-month free trial.
INSERT INTO "public"."plans" (id, slug, name, "monthlyPriceILS", "commissionBasisPoints", "trialLengthMonths", "isActive", "isDefault", "createdAt", "updatedAt")
VALUES ('plan-community-default', 'community', 'מנוי קהילה', 99, 500, 1, true, true, NOW(), NOW());

-- Backfill: every existing user lands on the default plan. New users get
-- assigned in the signup service (separate code change in the same commit).
UPDATE "public"."User" SET "planId" = 'plan-community-default' WHERE "planId" IS NULL;
