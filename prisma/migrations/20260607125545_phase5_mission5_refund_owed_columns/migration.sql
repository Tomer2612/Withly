-- AlterTable
ALTER TABLE "public"."member_subscriptions" ADD COLUMN     "refundAmountOwed" DOUBLE PRECISION,
ADD COLUMN     "refundFailureReason" TEXT,
ADD COLUMN     "refundOwedAt" TIMESTAMP(3);
