import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import * as bcrypt from 'bcrypt';
import { ERROR_MESSAGES } from '../common/messages';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // Search users by name for @mentions
  async searchUsersByName(query: string, excludeUserId?: string) {
    if (!query || query.length < 1) {
      return [];
    }

    return this.prisma.user.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' },
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: {
        id: true,
        name: true,
        profileImage: true,
      },
      take: 10,
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        profileImage: true,
        coverImage: true,
        bio: true,
        location: true,
        googleId: true,
      },
    });
  }

  // Same as findById but includes password + showOnline; for paths that need to
  // verify credentials or read mutable state, not the public profile.
  async findByIdWithAuth(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        profileImage: true,
        googleId: true,
        showOnline: true,
      },
    });
  }

  async updateProfile(userId: string, name?: string, profileImage?: string, coverImage?: string, bio?: string, location?: string) {
    const user = await this.findByIdWithAuth(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const data: Prisma.UserUpdateInput = {};
    if (name) data.name = name;
    if (profileImage) data.profileImage = profileImage;
    if (coverImage) data.coverImage = coverImage;
    if (bio !== undefined) data.bio = bio;
    if (location !== undefined) data.location = location;

    return this.prisma.user.update({
      where: { id: user.id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        profileImage: true,
        coverImage: true,
        bio: true,
        location: true,
        googleId: true,
      },
    });
  }

  async toggleOnlineStatus(userId: string, showOnline: boolean) {
    const user = await this.findByIdWithAuth(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: user.id },
      data: { showOnline },
      select: {
        id: true,
        showOnline: true,
      },
    });
  }

  async getOnlineStatus(userId: string) {
    const user = await this.findByIdWithAuth(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { showOnline: user.showOnline ?? true };
  }

  async getNotificationPreferences(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        notifyLikes: true,
        notifyComments: true,
        notifyFollows: true,
        notifyNewPosts: true,
        notifyMentions: true,
        notifyCommunityJoins: true,
        notifyMessages: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateNotificationPreferences(userId: string, preferences: {
    notifyLikes?: boolean;
    notifyComments?: boolean;
    notifyFollows?: boolean;
    notifyNewPosts?: boolean;
    notifyMentions?: boolean;
    notifyCommunityJoins?: boolean;
    notifyMessages?: boolean;
  }) {
    const user = await this.findByIdWithAuth(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: user.id },
      data: preferences,
      select: {
        notifyLikes: true,
        notifyComments: true,
        notifyFollows: true,
        notifyNewPosts: true,
        notifyMentions: true,
        notifyCommunityJoins: true,
        notifyMessages: true,
      },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    return this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });
  }

  async deleteAccount(userId: string) {
    const user = await this.findByIdWithAuth(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Delete user - cascade will handle related records
    await this.prisma.user.delete({
      where: { id: user.id },
    });

    return { message: 'Account deleted successfully' };
  }

  // Public profile - get user by ID (limited info)
  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        profileImage: true,
        coverImage: true,
        bio: true,
        location: true,
        createdAt: true,
        lastActiveAt: true,
        showOnline: true,
      },
    });

    return user;
  }

  // Get communities created by user
  async getCreatedCommunities(userId: string) {
    const communities = await this.prisma.community.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
        logo: true,
        price: true,
        topic: true,
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return communities.map(({ _count, ...c }) => ({ ...c, memberCount: _count.members + 1 }));
  }

  // Get communities user is a member of
  async getMemberCommunities(userId: string) {
    const memberships = await this.prisma.communityMember.findMany({
      where: { userId },
      include: {
        community: {
          select: {
            id: true,
            name: true,
            description: true,
            image: true,
            logo: true,
            price: true,
            topic: true,
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map(m => {
      const { _count, ...rest } = m.community;
      return { ...rest, memberCount: _count.members + 1 };
    });
  }

  // Get user stats (followers, following, total community members)
  async getUserStats(userId: string) {
    // Count followers (people who follow this user)
    const followersCount = await this.prisma.userFollow.count({
      where: { followingId: userId },
    });

    // Count following (people this user follows)
    const followingCount = await this.prisma.userFollow.count({
      where: { followerId: userId },
    });

    // Get total members across all communities owned by this user.
    // After D2 the owner has no community_members row, so add the owned-
    // community count to keep the owner counted once per community.
    const [memberRows, ownedCount] = await Promise.all([
      this.prisma.communityMember.count({
        where: { community: { ownerId: userId } },
      }),
      this.prisma.community.count({ where: { ownerId: userId } }),
    ]);
    const totalCommunityMembers = memberRows + ownedCount;

    return {
      followers: followersCount,
      following: followingCount,
      communityMembers: totalCommunityMembers,
    };
  }

  // Follow a user
  async followUser(followerId: string, followingId: string) {
    // Check if user exists
    const userToFollow = await this.prisma.user.findUnique({
      where: { id: followingId },
    });
    if (!userToFollow) {
      throw new NotFoundException('User not found');
    }

    // Create follow relationship
    await this.prisma.userFollow.create({
      data: {
        followerId,
        followingId,
      },
    });

    return { success: true, message: 'User followed successfully' };
  }

  // Unfollow a user
  async unfollowUser(followerId: string, followingId: string) {
    await this.prisma.userFollow.deleteMany({
      where: {
        followerId,
        followingId,
      },
    });

    return { success: true, message: 'User unfollowed successfully' };
  }

  // Check if user is following another user
  async isFollowing(followerId: string, followingId: string) {
    const follow = await this.prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    return { isFollowing: !!follow };
  }

  // Payment Methods
  async getPaymentMethods(userId: string) {
    return this.prisma.userPaymentMethod.findMany({
      where: { userId },
      // Primary first, then by recency. Real createdAt is preserved now
      // (setPrimaryPaymentMethod no longer mutates it).
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async addPaymentMethod(userId: string, cardLastFour: string, cardBrand: string = 'Visa') {
    // Check if this card already exists for the user
    const existing = await this.prisma.userPaymentMethod.findFirst({
      where: { userId, cardLastFour },
    });

    if (existing) {
      return existing; // Don't add duplicate
    }

    // First card a user adds becomes primary automatically.
    const hasAny = await this.prisma.userPaymentMethod.count({ where: { userId } });

    return this.prisma.userPaymentMethod.create({
      data: {
        userId,
        cardLastFour,
        cardBrand,
        isPrimary: hasAny === 0,
      },
    });
  }

  async deletePaymentMethod(userId: string, paymentMethodId: string) {
    // Check if user has more than one payment method
    const count = await this.prisma.userPaymentMethod.count({
      where: { userId },
    });

    if (count <= 1) {
      throw new BadRequestException(ERROR_MESSAGES.CANNOT_DELETE_LAST_PAYMENT_METHOD);
    }

    // If the card being deleted was primary, promote another to primary.
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.userPaymentMethod.findFirst({
        where: { id: paymentMethodId, userId },
        select: { isPrimary: true },
      });
      if (!target) return { count: 0 };

      const result = await tx.userPaymentMethod.deleteMany({
        where: { id: paymentMethodId, userId },
      });

      if (target.isPrimary) {
        const replacement = await tx.userPaymentMethod.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });
        if (replacement) {
          await tx.userPaymentMethod.update({
            where: { id: replacement.id },
            data: { isPrimary: true },
          });
        }
      }

      return result;
    });
  }

  async setPrimaryPaymentMethod(userId: string, paymentMethodId: string) {
    // Atomically demote any current primary, promote the chosen one.
    // The partial unique index in the DB enforces "at most one primary
    // per user", so doing this in a single transaction prevents races.
    return this.prisma.$transaction(async (tx) => {
      await tx.userPaymentMethod.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });
      return tx.userPaymentMethod.updateMany({
        where: { id: paymentMethodId, userId },
        data: { isPrimary: true },
      });
    });
  }
}
