-- AlterTable: Change notification preference defaults from true to false
ALTER TABLE "User" ALTER COLUMN "notifyComments" SET DEFAULT false;
ALTER TABLE "User" ALTER COLUMN "notifyCommunityJoins" SET DEFAULT false;
ALTER TABLE "User" ALTER COLUMN "notifyFollows" SET DEFAULT false;
ALTER TABLE "User" ALTER COLUMN "notifyLikes" SET DEFAULT false;
ALTER TABLE "User" ALTER COLUMN "notifyMentions" SET DEFAULT false;
ALTER TABLE "User" ALTER COLUMN "notifyNewPosts" SET DEFAULT false;
ALTER TABLE "User" ALTER COLUMN "notifyMessages" SET DEFAULT false;
