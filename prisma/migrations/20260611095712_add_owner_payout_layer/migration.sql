-- CreateEnum
CREATE TYPE "public"."PayoutStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PayoutMethod" AS ENUM ('MANUAL_BANK_TRANSFER', 'MASAV');

-- CreateTable
CREATE TABLE "public"."owner_bank_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "branchNumber" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."owner_payouts" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "public"."PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "method" "public"."PayoutMethod" NOT NULL DEFAULT 'MANUAL_BANK_TRANSFER',
    "reference" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "notes" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "owner_bank_accounts_userId_key" ON "public"."owner_bank_accounts"("userId");

-- CreateIndex
CREATE INDEX "owner_payouts_ownerId_idx" ON "public"."owner_payouts"("ownerId");

-- AddForeignKey
ALTER TABLE "public"."owner_bank_accounts" ADD CONSTRAINT "owner_bank_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."owner_payouts" ADD CONSTRAINT "owner_payouts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
