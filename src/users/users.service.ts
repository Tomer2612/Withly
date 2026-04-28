import { Injectable, BadRequestException } from '@nestjs/common';
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

  async getAllUsers() {
    return this.prisma.user.findMany();
  }

  async findById(id: string) {
    // Try to find by ID first, then by email (for legacy tokens)
    let user = await this.prisma.user.findUnique({
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
    
    // If not found by ID, try by email (handles old tokens with email as sub)
    if (!user && id.includes('@')) {
      user = await this.prisma.user.findUnique({
        where: { email: id },
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
    
    return user;
  }

  async findByIdOrEmail(idOrEmail: string) {
    // First try by ID
    let user = await this.prisma.user.findUnique({
      where: { id: idOrEmail },
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
    
    // If not found, try by email
    if (!user && idOrEmail.includes('@')) {
      user = await this.prisma.user.findUnique({
        where: { email: idOrEmail },
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
    
    return user;
  }

  async updateProfile(userId: string, name?: string, profileImage?: string, coverImage?: string, bio?: string, location?: string) {
    // Find user by ID or email first
    const user = await this.findByIdOrEmail(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const data: any = {};
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
    const user = await this.findByIdOrEmail(userId);
    if (!user) {
      throw new Error('User not found');
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
    const user = await this.findByIdOrEmail(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return { showOnline: user.showOnline ?? true };
  }

  async getNotificationPreferences(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: userId },
          { email: userId },
        ],
      },
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
      throw new Error('User not found');
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
    const user = await this.findByIdOrEmail(userId);
    if (!user) {
      throw new Error('User not found');
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
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: userId },
          { email: userId },
        ],
      },
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
    const user = await this.findByIdOrEmail(userId);
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
    return this.prisma.community.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
        logo: true,
        memberCount: true,
        price: true,
        topic: true,
      },
      orderBy: { createdAt: 'desc' },
    });
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
            memberCount: true,
            price: true,
            topic: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map(m => m.community);
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

    // Get total members across all communities owned by this user
    const communities = await this.prisma.community.findMany({
      where: { ownerId: userId },
      select: { memberCount: true },
    });
    const totalCommunityMembers = communities.reduce((sum, c) => sum + (c.memberCount || 0), 0);

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
      throw new Error('User not found');
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
      orderBy: { createdAt: 'desc' },
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
    
    return this.prisma.userPaymentMethod.create({
      data: {
        userId,
        cardLastFour,
        cardBrand,
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
    
    return this.prisma.userPaymentMethod.deleteMany({
      where: { id: paymentMethodId, userId },
    });
  }

  async setPrimaryPaymentMethod(userId: string, paymentMethodId: string) {
    // Update the createdAt to now to make it the most recent (primary)
    return this.prisma.userPaymentMethod.updateMany({
      where: { id: paymentMethodId, userId },
      data: { createdAt: new Date() },
    });
  }
}
