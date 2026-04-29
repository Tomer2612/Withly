-- AlterTable
ALTER TABLE "user_payment_methods"
  ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: previous behavior treated "most recent createdAt" as the
-- primary card (setPrimaryPaymentMethod actually mutated createdAt to
-- pretend). Mark the most-recent payment method per user as primary so
-- existing UIs see the same card highlighted after rollout.
UPDATE "user_payment_methods" upm
SET "isPrimary" = true
FROM (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt" DESC) AS rn
    FROM "user_payment_methods"
  ) sub
  WHERE rn = 1
) latest
WHERE upm.id = latest.id;

-- CreateIndex: at most one primary per user at the DB level.
CREATE UNIQUE INDEX "user_payment_methods_userId_primary_unique"
  ON "user_payment_methods"("userId")
  WHERE "isPrimary" = true;
