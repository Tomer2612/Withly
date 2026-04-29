-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_lastActiveAt_idx" ON "User"("lastActiveAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_follows_followingId_idx" ON "user_follows"("followingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_actorId_idx" ON "notifications"("actorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "community_members_communityId_idx" ON "community_members"("communityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "community_bans_communityId_expiresAt_idx" ON "community_bans"("communityId", "expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Post_communityId_createdAt_idx" ON "Post"("communityId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Post_authorId_idx" ON "Post"("authorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "likes_postId_idx" ON "likes"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "comments_postId_idx" ON "comments"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "saved_posts_postId_idx" ON "saved_posts"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_rsvps_userId_idx" ON "event_rsvps"("userId");
