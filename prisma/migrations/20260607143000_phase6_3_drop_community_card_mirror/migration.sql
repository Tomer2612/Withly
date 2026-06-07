-- Phase 6.3: drop denormalized card columns from communities. Card
-- display now comes from the bound paymentMethod relation. Both columns
-- had been write-only mirrors with zero backend readers (verified by
-- grep). Frontend manage page reads community.paymentMethod?.cardLastFour
-- via the findById include.

ALTER TABLE "public"."communities" DROP COLUMN "cardLastFour";
ALTER TABLE "public"."communities" DROP COLUMN "cardBrand";

