-- AlterEnum
-- This migration adds two new values to the NotificationType enum.
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction in older
-- Postgres versions, so each statement is its own.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMMUNITY_BAN';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMMUNITY_BAN_LIFTED';
