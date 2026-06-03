-- CreateTable
CREATE TABLE "public"."pending_community_creations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "topic" TEXT,
    "image" TEXT,
    "logo" TEXT,
    "price" DOUBLE PRECISION DEFAULT 0,
    "youtubeUrl" TEXT,
    "whatsappUrl" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "galleryImages" TEXT[],
    "galleryVideos" TEXT[],
    "showOnlineMembers" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_community_creations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pending_community_creations_userId_key" ON "public"."pending_community_creations"("userId");

-- CreateIndex
CREATE INDEX "pending_community_creations_createdAt_idx" ON "public"."pending_community_creations"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."pending_community_creations" ADD CONSTRAINT "pending_community_creations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
