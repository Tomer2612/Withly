-- CreateEnum
CREATE TYPE "public"."TransactionKind" AS ENUM ('OWNER_MONTHLY', 'MEMBER_MONTHLY');

-- CreateTable
CREATE TABLE "public"."transactions" (
    "id" TEXT NOT NULL,
    "kind" "public"."TransactionKind" NOT NULL,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "commissionBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "platformAmount" DOUBLE PRECISION NOT NULL,
    "ownerAmount" DOUBLE PRECISION NOT NULL,
    "communityId" TEXT,
    "ownerId" TEXT,
    "payerId" TEXT,
    "memberSubscriptionId" TEXT,
    "hypTxnId" TEXT,
    "hypOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_hypTxnId_key" ON "public"."transactions"("hypTxnId");

-- CreateIndex
CREATE INDEX "transactions_communityId_idx" ON "public"."transactions"("communityId");

-- CreateIndex
CREATE INDEX "transactions_ownerId_idx" ON "public"."transactions"("ownerId");

-- CreateIndex
CREATE INDEX "transactions_createdAt_idx" ON "public"."transactions"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "public"."communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_memberSubscriptionId_fkey" FOREIGN KEY ("memberSubscriptionId") REFERENCES "public"."member_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
