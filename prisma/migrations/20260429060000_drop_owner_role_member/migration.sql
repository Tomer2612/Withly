-- D2: ownership is tracked solely by Community.ownerId after this migration.
-- The OWNER value of MemberRole is removed because every owner already has a
-- corresponding Community.ownerId row, making the OWNER membership row
-- redundant.

DELETE FROM community_members WHERE role = 'OWNER';

CREATE TYPE "MemberRole_new" AS ENUM ('MANAGER', 'USER');

ALTER TABLE community_members
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE "MemberRole_new" USING (role::text::"MemberRole_new"),
  ALTER COLUMN role SET DEFAULT 'USER';

DROP TYPE "MemberRole";
ALTER TYPE "MemberRole_new" RENAME TO "MemberRole";
