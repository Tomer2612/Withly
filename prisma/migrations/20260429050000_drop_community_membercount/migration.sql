-- AlterTable: drop denormalized memberCount counter.
-- Reads now compute it from the members relation via _count.members,
-- which the community_members(communityId) index from migration
-- 20260429020000 makes cheap.
ALTER TABLE "communities" DROP COLUMN "memberCount";
