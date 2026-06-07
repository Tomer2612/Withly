-- CreateEnum
CREATE TYPE "public"."DunningKind" AS ENUM ('OWNER_MONTHLY', 'MEMBER_MONTHLY');

-- CreateTable
CREATE TABLE "public"."payment_dunning_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "kind" "public"."DunningKind" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "hypOrderId" TEXT NOT NULL,
    "fulfilledAt" TIMESTAMP(3),
    "hypTxnId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_dunning_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_dunning_requests_hypOrderId_key" ON "public"."payment_dunning_requests"("hypOrderId");

-- CreateIndex
CREATE INDEX "payment_dunning_requests_userId_communityId_kind_fulfilledA_idx" ON "public"."payment_dunning_requests"("userId", "communityId", "kind", "fulfilledAt");

-- AddForeignKey
ALTER TABLE "public"."payment_dunning_requests" ADD CONSTRAINT "payment_dunning_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment_dunning_requests" ADD CONSTRAINT "payment_dunning_requests_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "public"."communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
