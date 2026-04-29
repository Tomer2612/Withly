-- AlterTable: fix typo in column name
ALTER TABLE "poll_votes" RENAME COLUMN "oderId" TO "userId";

-- AddForeignKey: link poll_votes.userId to User.id (was missing from
-- the original model — now wired through the new @relation in schema)
ALTER TABLE "poll_votes"
  ADD CONSTRAINT "poll_votes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
