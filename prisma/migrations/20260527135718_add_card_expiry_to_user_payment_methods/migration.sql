-- HYP integration Phase 4 prerequisite: store card expiry on tokenized
-- payment methods. HYP returns `Tokef` (YYMM) on getToken and does NOT
-- store card validity alongside the token, so we must store it ourselves
-- and pass Tmonth/Tyear on every recurring SOFT charge.
-- Purely additive; both columns nullable, no backfill, no constraints.

-- AlterTable
ALTER TABLE "public"."user_payment_methods" ADD COLUMN "cardExpMonth" INTEGER,
ADD COLUMN "cardExpYear" INTEGER;
