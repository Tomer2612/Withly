-- HYP integration Phase 1.2: schema additions for tokenized billing.
-- Purely additive; no columns dropped, no data backfilled. Existing rows
-- get NULL in the new columns. Old `Community.cardLastFour` / `cardBrand`
-- stay until Phase 6.1 backfill is verified, then drop in a later migration.

-- CreateEnum
CREATE TYPE "public"."MemberSubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'ENDED');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN "hypCustomerId" TEXT;

-- AlterTable
ALTER TABLE "public"."communities" ADD COLUMN "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN "currentPeriodStart" TIMESTAMP(3),
ADD COLUMN "hypSubscriptionId" TEXT,
ADD COLUMN "nextBillingDate" TIMESTAMP(3),
ADD COLUMN "paymentMethodId" TEXT;

-- AlterTable
ALTER TABLE "public"."user_payment_methods" ADD COLUMN "hypPaymentMethodId" TEXT;

-- CreateTable
CREATE TABLE "public"."member_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "paymentMethodId" TEXT,
    "hypSubscriptionId" TEXT NOT NULL,
    "priceAtJoin" DOUBLE PRECISION NOT NULL,
    "nextBillingDate" TIMESTAMP(3) NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "status" "public"."MemberSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_subscriptions_hypSubscriptionId_key" ON "public"."member_subscriptions"("hypSubscriptionId");

-- CreateIndex
CREATE INDEX "member_subscriptions_userId_idx" ON "public"."member_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "member_subscriptions_communityId_idx" ON "public"."member_subscriptions"("communityId");

-- CreateIndex
CREATE INDEX "member_subscriptions_status_idx" ON "public"."member_subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_hypCustomerId_key" ON "public"."User"("hypCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "communities_hypSubscriptionId_key" ON "public"."communities"("hypSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_payment_methods_hypPaymentMethodId_key" ON "public"."user_payment_methods"("hypPaymentMethodId");

-- AddForeignKey
ALTER TABLE "public"."communities" ADD CONSTRAINT "communities_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "public"."user_payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."member_subscriptions" ADD CONSTRAINT "member_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."member_subscriptions" ADD CONSTRAINT "member_subscriptions_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "public"."communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."member_subscriptions" ADD CONSTRAINT "member_subscriptions_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "public"."user_payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
