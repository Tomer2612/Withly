import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { NotificationType } from '@prisma/client';
import { MessagesGateway } from '../messages/messages.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => MessagesGateway))
    private messagesGateway: MessagesGateway,
  ) {}

  // Create a notification (respects user preferences)
  async create(data: {
    type: NotificationType;
    recipientId: string;
    actorId?: string;
    postId?: string;
    communityId?: string;
  }) {
    // Don't notify yourself
    if (data.actorId && data.actorId === data.recipientId) {
      return null;
    }

    // Check user's notification preferences
    const user = await this.prisma.user.findUnique({
      where: { id: data.recipientId },
      select: {
        notifyLikes: true,
        notifyComments: true,
        notifyFollows: true,
        notifyNewPosts: true,
        notifyMentions: true,
        notifyCommunityJoins: true,
      },
    });

    // If user has disabled this notification type, don't create it.
    // Moderation events (COMMUNITY_BAN, COMMUNITY_BAN_LIFTED) deliberately
    // skip this map - they go through createUnconditional and never hit
    // this method.
    if (user) {
      const preferenceMap: Partial<Record<NotificationType, boolean>> = {
        'LIKE': user.notifyLikes,
        'COMMENT': user.notifyComments,
        'FOLLOW': user.notifyFollows,
        'NEW_POST': user.notifyNewPosts,
        'MENTION': user.notifyMentions,
        'COMMUNITY_JOIN': user.notifyCommunityJoins,
      };

      if (preferenceMap[data.type] === false) {
        return null;
      }
    }

    const notification = await this.prisma.notification.create({
      data,
      include: {
        actor: {
          select: { id: true, name: true, profileImage: true },
        },
      },
    });

    // Emit real-time notification via WebSocket
    if (notification && this.messagesGateway) {
      this.messagesGateway.sendNotificationToUser(data.recipientId, notification);
    }

    return notification;
  }

  // Get notifications for a user
  async getNotifications(userId: string, limit = 50, offset = 0) {
    const [rawNotifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { recipientId: userId },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              profileImage: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notification.count({
        where: { recipientId: userId },
      }),
      this.prisma.notification.count({
        where: { recipientId: userId, isRead: false },
      }),
    ]);

    // Enrich notifications with post and community data
    const postIds = [...new Set(rawNotifications.filter(n => n.postId).map(n => n.postId))];
    const communityIds = [...new Set(rawNotifications.filter(n => n.communityId).map(n => n.communityId))];

    const [posts, communities] = await Promise.all([
      postIds.length > 0 
        ? this.prisma.post.findMany({
            where: { id: { in: postIds as string[] } },
            select: { 
              id: true, 
              title: true,
              community: { select: { id: true, name: true } }
            },
          })
        : [],
      communityIds.length > 0
        ? this.prisma.community.findMany({
            where: { id: { in: communityIds as string[] } },
            // slug is included so the bell can link to the canonical URL
            // and avoid a slug-redirect refetch on the destination page.
            // ownerId lets the bell route PAYMENT_FAILED to the owner's
            // /manage vs a member's /settings#payment.
            select: { id: true, name: true, slug: true, ownerId: true },
          })
        : [],
    ]);

    const postMap = new Map(posts.map(p => [p.id, p] as const));
    const communityMap = new Map(communities.map(c => [c.id, c] as const));

    const notifications = rawNotifications.map(n => ({
      ...n,
      post: n.postId ? postMap.get(n.postId) : undefined,
      community: n.communityId ? communityMap.get(n.communityId) : undefined,
    }));

    return { notifications, total, unreadCount };
  }

  // Get unread count only
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { recipientId: userId, isRead: false },
    });
    return { unreadCount: count };
  }

  // Mark notification as read
  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, recipientId: userId },
      data: { isRead: true },
    });
  }

  // Mark all notifications as read
  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true },
    });
  }

  // Delete a notification
  async delete(notificationId: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: { id: notificationId, recipientId: userId },
    });
  }

  // Delete every notification for this user — bell "clear all" action.
  async deleteAll(userId: string) {
    return this.prisma.notification.deleteMany({
      where: { recipientId: userId },
    });
  }

  // Helper methods to create specific notification types
  async notifyLike(postAuthorId: string, actorId: string, postId: string, communityId: string) {
    return this.create({
      type: 'LIKE',
      recipientId: postAuthorId,
      actorId,
      postId,
      communityId,
    });
  }

  async notifyComment(postAuthorId: string, actorId: string, postId: string, communityId: string) {
    return this.create({
      type: 'COMMENT',
      recipientId: postAuthorId,
      actorId,
      postId,
      communityId,
    });
  }

  async notifyFollow(followedUserId: string, actorId: string) {
    // Rate limit: Check if there's already a FOLLOW notification from this actor in the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingNotification = await this.prisma.notification.findFirst({
      where: {
        type: 'FOLLOW',
        recipientId: followedUserId,
        actorId: actorId,
        createdAt: { gte: twentyFourHoursAgo },
      },
    });

    // If notification exists within 24h, just update its timestamp instead of creating new
    if (existingNotification) {
      const updated = await this.prisma.notification.update({
        where: { id: existingNotification.id },
        data: { 
          createdAt: new Date(),
          isRead: false, // Mark as unread again
        },
        include: {
          actor: {
            select: { id: true, name: true, profileImage: true },
          },
        },
      });
      
      // Emit real-time notification via WebSocket for the updated notification
      if (updated && this.messagesGateway) {
        this.messagesGateway.sendNotificationToUser(followedUserId, updated);
      }
      
      return updated;
    }

    return this.create({
      type: 'FOLLOW',
      recipientId: followedUserId,
      actorId,
    });
  }

  // Notify all followers of a user when they create a new post.
  // Batched so a user with thousands of followers doesn't saturate the
  // connection pool by firing every notification concurrently.
  async notifyNewPost(authorId: string, postId: string, communityId: string) {
    const followers = await this.prisma.userFollow.findMany({
      where: { followingId: authorId },
      select: { followerId: true },
    });

    const BATCH_SIZE = 50;
    const notifications: Array<unknown> = [];
    for (let i = 0; i < followers.length; i += BATCH_SIZE) {
      const chunk = followers.slice(i, i + BATCH_SIZE);
      const chunkResults = await Promise.all(
        chunk.map(f =>
          this.create({
            type: 'NEW_POST',
            recipientId: f.followerId,
            actorId: authorId,
            postId,
            communityId,
          }),
        ),
      );
      notifications.push(...chunkResults);
    }

    return notifications.filter(Boolean);
  }

  // Notify a user that they were banned (suspended) from a community.
  // Bypasses the per-user notification preference check by going through
  // a direct create — moderation actions shouldn't be silenceable by the
  // recipient.
  async notifyCommunityBan(bannedUserId: string, actorId: string, communityId: string) {
    return this.createUnconditional({
      type: 'COMMUNITY_BAN',
      recipientId: bannedUserId,
      actorId,
      communityId,
    });
  }

  // Notify a user that their ban was lifted.
  async notifyCommunityBanLifted(unbannedUserId: string, actorId: string, communityId: string) {
    return this.createUnconditional({
      type: 'COMMUNITY_BAN_LIFTED',
      recipientId: unbannedUserId,
      actorId,
      communityId,
    });
  }

  // Owner scheduled the community for suspension (cancelled subscription).
  // Members can't opt out — they need to know access is going away.
  async notifyCommunityScheduledForSuspension(recipientUserId: string, actorId: string, communityId: string) {
    return this.createUnconditional({
      type: 'COMMUNITY_SCHEDULED_FOR_SUSPENSION',
      recipientId: recipientUserId,
      actorId,
      communityId,
    });
  }

  // Cancellation date passed (or HYP charge failed) — community is now suspended.
  async notifyCommunitySuspended(recipientUserId: string, actorId: string, communityId: string) {
    return this.createUnconditional({
      type: 'COMMUNITY_SUSPENDED',
      recipientId: recipientUserId,
      actorId,
      communityId,
    });
  }

  // Owner reactivated a suspended community (placeholder pre-HYP, charge-success post-HYP).
  async notifyCommunityReactivated(recipientUserId: string, actorId: string, communityId: string) {
    return this.createUnconditional({
      type: 'COMMUNITY_REACTIVATED',
      recipientId: recipientUserId,
      actorId,
      communityId,
    });
  }

  // Mirrors the existing PriceChangeAnnouncementModal + new email — bell
  // icon entry so members who don't open the community AND don't check
  // email still know. Unconditional (can't opt out): pricing changes
  // affect what they pay; we must surface them everywhere.
  async notifyPriceChangeAnnounced(recipientUserId: string, actorId: string, communityId: string) {
    return this.createUnconditional({
      type: 'PRICE_CHANGE_ANNOUNCED',
      recipientId: recipientUserId,
      actorId,
      communityId,
    });
  }

  // Mirrors the existing event-reminder email — bell-icon entry for
  // attendees an hour before / day before / whatever reminderDays is.
  // Unconditional (can't opt out): the user already RSVPed GOING, so
  // they want to know.
  async notifyEventReminder(recipientUserId: string, actorId: string, communityId: string) {
    return this.createUnconditional({
      type: 'EVENT_REMINDER',
      recipientId: recipientUserId,
      actorId,
      communityId,
    });
  }

  // Phase 4 — fired by the daily billing cron when a recurring SOFT
  // charge fails and the community gets suspended as a result. Owner-
  // facing only (members get the existing COMMUNITY_SUSPENDED fan-out).
  // No actor: this is a system event triggered by the cron, not by
  // another user. Unconditional — owner cannot opt out of billing alerts.
  async notifyPaymentFailed(recipientUserId: string, communityId: string) {
    return this.createUnconditional({
      type: 'PAYMENT_FAILED',
      recipientId: recipientUserId,
      communityId,
    });
  }

  // Internal: create + emit without checking the user's preference flags.
  // Used for moderation events the recipient cannot opt out of.
  private async createUnconditional(data: {
    type: NotificationType;
    recipientId: string;
    actorId?: string;
    communityId?: string;
  }) {
    if (data.actorId && data.actorId === data.recipientId) {
      return null;
    }
    const notification = await this.prisma.notification.create({
      data,
      include: {
        actor: {
          select: { id: true, name: true, profileImage: true },
        },
      },
    });
    if (notification && this.messagesGateway) {
      this.messagesGateway.sendNotificationToUser(data.recipientId, notification);
    }
    return notification;
  }

  async notifyCommunityJoin(communityOwnerId: string, actorId: string, communityId: string) {
    return this.create({
      type: 'COMMUNITY_JOIN',
      recipientId: communityOwnerId,
      actorId,
      communityId,
    });
  }

  // Notify a user when they are mentioned in a comment
  async notifyMention(mentionedUserId: string, actorId: string, postId: string, communityId: string) {
    return this.create({
      type: 'MENTION',
      recipientId: mentionedUserId,
      actorId,
      postId,
      communityId,
    });
  }

  // Parse @mentions from text and notify mentioned users
  async processMentions(
    content: string,
    actorId: string,
    postId: string,
    communityId: string,
  ) {
    // Match @username pattern (Hebrew and English characters, numbers, underscores, spaces)
    const mentionRegex = /@([\w\u0590-\u05FF][\w\u0590-\u05FF\s]*)/g;
    const mentions = content.match(mentionRegex);

    if (!mentions || mentions.length === 0) return [];

    // Extract usernames (remove @ symbol and trim)
    const usernames = mentions.map(m => m.slice(1).trim());

    // Find users by name (exact match, case-insensitive). Substring match
    // would notify lookalike names: @Yossi would also notify Yossi-Cohen,
    // Yossifa, etc. The mention picker writes the full canonical name into
    // the content, so equality is the right check here.
    const users = await this.prisma.user.findMany({
      where: {
        OR: usernames.map(username => ({
          name: { equals: username, mode: 'insensitive' as const },
        })),
        id: { not: actorId }, // Don't notify yourself
      },
      select: { id: true, name: true },
    });

    // Create notifications for each mentioned user. Batched for the same
    // reason as notifyNewPost - bounded concurrency on the connection pool.
    const BATCH_SIZE = 50;
    const notifications: Array<unknown> = [];
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const chunk = users.slice(i, i + BATCH_SIZE);
      const chunkResults = await Promise.all(
        chunk.map(user =>
          this.notifyMention(user.id, actorId, postId, communityId),
        ),
      );
      notifications.push(...chunkResults);
    }

    return notifications.filter(Boolean);
  }
}
