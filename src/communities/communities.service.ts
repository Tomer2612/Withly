import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../users/prisma.service';

@Injectable()
export class CommunitiesService {
  constructor(private prisma: PrismaService) {}

  async create(
    name: string,
    description: string,
    ownerId: string,
    image?: string | null,
    logo?: string | null,
    topic?: string | null,
    youtubeUrl?: string | null,
    whatsappUrl?: string | null,
    facebookUrl?: string | null,
    instagramUrl?: string | null,
    galleryImages?: string[],
    galleryVideos?: string[],
    price?: number | null,
  ) {
    try {
      console.log('Creating community with:', { name, description, ownerId, image, logo, topic, youtubeUrl, whatsappUrl, facebookUrl, instagramUrl, galleryImages, galleryVideos, price });
      
      // Create community
      const community = await this.prisma.community.create({
        data: { 
          name, 
          description, 
          ownerId,
          image: image || null,
          logo: logo || null,
          topic: topic || null,
          memberCount: 1,
          price: price ?? 0,
          youtubeUrl: youtubeUrl || null,
          whatsappUrl: whatsappUrl || null,
          facebookUrl: facebookUrl || null,
          instagramUrl: instagramUrl || null,
          galleryImages: galleryImages || [],
          galleryVideos: galleryVideos || [],
          trialStartDate: new Date(),
        } as any,
      });
      
      // Add owner as member with OWNER role
      await this.prisma.communityMember.create({
        data: {
          userId: ownerId,
          communityId: community.id,
          role: 'OWNER',
        },
      });
      
      return community;
    } catch (err) {
      console.error('Community creation failed:', err);
      throw new InternalServerErrorException('Could not create community');
    }
  }

  async findAll() {
    try {
      const communities = await this.prisma.community.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          _count: {
            select: { members: true }
          }
        }
      });
      
      // Return with actual member count from members table
      return communities.map(community => ({
        ...community,
        memberCount: community._count.members,
      }));
    } catch (err) {
      console.error('Failed to fetch communities:', err);
      throw new InternalServerErrorException('Could not fetch communities');
    }
  }

  async findById(idOrSlug: string) {
    try {
      // First try to find by ID
      let community = await this.prisma.community.findUnique({
        where: { id: idOrSlug },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              profileImage: true,
            },
          },
        },
      });

      // If not found by ID, try by slug
      if (!community) {
        community = await this.prisma.community.findUnique({
          where: { slug: idOrSlug },
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
                profileImage: true,
              },
            },
          },
        });
      }

      if (!community) {
        throw new NotFoundException('Community not found');
      }

      return community;
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      console.error('Failed to fetch community:', err);
      throw new InternalServerErrorException('Could not fetch community');
    }
  }

  async update(
    idOrSlug: string,
    userId: string,
    name?: string,
    description?: string,
    image?: string | null,
    logo?: string | null,
    topic?: string | null,
    youtubeUrl?: string | null,
    whatsappUrl?: string | null,
    facebookUrl?: string | null,
    instagramUrl?: string | null,
    galleryImages?: string[],
    galleryVideos?: string[],
    price?: number | null,
    trialCancelled?: boolean,
    cardLastFour?: string | null,
    cardBrand?: string | null,
    showOnlineMembers?: boolean,
  ) {
    try {
      const id = await this.resolveId(idOrSlug);
      
      const community = await this.prisma.community.findUnique({
        where: { id },
      });

      if (!community) {
        throw new NotFoundException('Community not found');
      }

      // Check if user has permission to edit (owner or manager)
      const membership = await this.prisma.communityMember.findUnique({
        where: { userId_communityId: { userId, communityId: id } },
      });

      if (!membership || (membership.role !== 'OWNER' && membership.role !== 'MANAGER')) {
        throw new ForbiddenException('Only owners and managers can update the community');
      }

      const updateData: any = {};
      if (name !== undefined) {
        updateData.name = name;
      }
      if (description !== undefined) {
        updateData.description = description;
      }
      if (image !== undefined) {
        updateData.image = image; // Can be null to remove, or a path to set
      }
      if (logo !== undefined) {
        updateData.logo = logo; // Can be null to remove, or a path to set
      }
      if (topic !== undefined) {
        updateData.topic = topic;
      }
      if (youtubeUrl !== undefined) {
        updateData.youtubeUrl = youtubeUrl || null;
      }
      if (whatsappUrl !== undefined) {
        updateData.whatsappUrl = whatsappUrl || null;
      }
      if (facebookUrl !== undefined) {
        updateData.facebookUrl = facebookUrl || null;
      }
      if (instagramUrl !== undefined) {
        updateData.instagramUrl = instagramUrl || null;
      }
      if (galleryImages !== undefined) {
        updateData.galleryImages = galleryImages;
      }
      if (galleryVideos !== undefined) {
        updateData.galleryVideos = galleryVideos;
      }
      if (price !== undefined) {
        updateData.price = price;
      }
      if (trialCancelled !== undefined) {
        updateData.trialCancelled = trialCancelled;
      }
      if (cardLastFour !== undefined) {
        updateData.cardLastFour = cardLastFour;
      }
      if (cardBrand !== undefined) {
        updateData.cardBrand = cardBrand;
      }
      if (showOnlineMembers !== undefined) {
        updateData.showOnlineMembers = showOnlineMembers;
      }

      return await this.prisma.community.update({
        where: { id },
        data: updateData,
      });
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      console.error('Failed to update community:', err);
      throw new InternalServerErrorException('Could not update community');
    }
  }

  async delete(idOrSlug: string, userId: string) {
    try {
      const id = await this.resolveId(idOrSlug);
      console.log(`Delete request - Community ID: ${id}, User ID: ${userId}`);
      
      const community = await this.prisma.community.findUnique({
        where: { id },
      });

      if (!community) {
        console.error(`Community not found: ${id}`);
        throw new NotFoundException('Community not found');
      }

      // Check if user is owner
      const membership = await this.prisma.communityMember.findUnique({
        where: { userId_communityId: { userId, communityId: id } },
      });

      if (!membership || membership.role !== 'OWNER') {
        console.error(`Unauthorized delete attempt - User: ${userId} is not OWNER`);
        throw new ForbiddenException('Only community owner can delete');
      }

      const deleted = await this.prisma.community.delete({
        where: { id },
      });
      
      console.log(`Community deleted successfully: ${id}`);
      return deleted;
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof ForbiddenException) {
        throw err;
      }
      console.error('Failed to delete community:', err);
      throw new InternalServerErrorException('Could not delete community');
    }
  }

  async joinCommunity(communityIdOrSlug: string, userId: string) {
    try {
      const communityId = await this.resolveId(communityIdOrSlug);
      
      // Check if user is banned from this community
      const activeBan = await this.prisma.communityBan.findUnique({
        where: { userId_communityId: { userId, communityId } },
      });

      if (activeBan && activeBan.expiresAt > new Date()) {
        const daysLeft = Math.ceil((activeBan.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        throw new ForbiddenException(`You are banned from this community. Ban expires in ${daysLeft} day(s).`);
      }

      // If ban has expired, delete it
      if (activeBan && activeBan.expiresAt <= new Date()) {
        await this.prisma.communityBan.delete({
          where: { userId_communityId: { userId, communityId } },
        });
      }

      // Check if already a member
      const existing = await this.prisma.communityMember.findUnique({
        where: {
          userId_communityId: { userId, communityId },
        },
      });

      if (existing) {
        return { message: 'Already a member', isMember: true, role: existing.role };
      }

      // Add membership with USER role
      const membership = await this.prisma.communityMember.create({
        data: { userId, communityId, role: 'USER' },
      });

      // Update member count
      await this.prisma.community.update({
        where: { id: communityId },
        data: { memberCount: { increment: 1 } },
      });

      return { message: 'Joined community', isMember: true, role: membership.role };
    } catch (err) {
      if (err instanceof ForbiddenException) {
        throw err;
      }
      console.error('Failed to join community:', err);
      throw new InternalServerErrorException('Could not join community');
    }
  }

  async leaveCommunity(communityIdOrSlug: string, userId: string) {
    try {
      const communityId = await this.resolveId(communityIdOrSlug);
      
      // Check if community owner
      const community = await this.prisma.community.findUnique({
        where: { id: communityId },
      });

      if (community && community.ownerId === userId) {
        throw new InternalServerErrorException('Owner cannot leave their own community');
      }

      // Remove membership
      const deleted = await this.prisma.communityMember.deleteMany({
        where: { userId, communityId },
      });

      if (deleted.count > 0) {
        // Update member count
        await this.prisma.community.update({
          where: { id: communityId },
          data: { memberCount: { decrement: 1 } },
        });
      }

      return { message: 'Left community', isMember: false };
    } catch (err) {
      if (err instanceof InternalServerErrorException) {
        throw err;
      }
      console.error('Failed to leave community:', err);
      throw new InternalServerErrorException('Could not leave community');
    }
  }

  async checkMembership(communityIdOrSlug: string, userId: string) {
    const communityId = await this.resolveId(communityIdOrSlug);
    
    const membership = await this.prisma.communityMember.findUnique({
      where: {
        userId_communityId: { userId, communityId },
      },
    });

    if (membership) {
      return { 
        isMember: true, 
        role: membership.role,
        isOwner: membership.role === 'OWNER',
        isManager: membership.role === 'MANAGER',
        canEdit: membership.role === 'OWNER' || membership.role === 'MANAGER',
        canDelete: membership.role === 'OWNER',
        canManageRoles: membership.role === 'OWNER',
      };
    }

    return { 
      isMember: false, 
      role: null,
      isOwner: false, 
      isManager: false,
      canEdit: false,
      canDelete: false,
      canManageRoles: false,
    };
  }

  async updateMemberRole(communityIdOrSlug: string, targetUserId: string, newRole: 'MANAGER' | 'USER', requesterId: string) {
    const communityId = await this.resolveId(communityIdOrSlug);
    
    // Check if requester is owner
    const requesterMembership = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: requesterId, communityId } },
    });

    if (!requesterMembership || requesterMembership.role !== 'OWNER') {
      throw new ForbiddenException('Only owners can change member roles');
    }

    // Check target membership exists
    const targetMembership = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: targetUserId, communityId } },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member not found');
    }

    // Cannot change owner role
    if (targetMembership.role === 'OWNER') {
      throw new ForbiddenException('Cannot change owner role');
    }

    // Update role
    const updated = await this.prisma.communityMember.update({
      where: { userId_communityId: { userId: targetUserId, communityId } },
      data: { role: newRole },
      include: {
        user: {
          select: { id: true, name: true, email: true, profileImage: true },
        },
      },
    });

    return { message: 'Role updated', member: updated };
  }

  async removeMember(communityIdOrSlug: string, targetUserId: string, requesterId: string, banDays: number = 7) {
    const communityId = await this.resolveId(communityIdOrSlug);
    
    // Check if requester is owner or manager
    const requesterMembership = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: requesterId, communityId } },
    });

    if (!requesterMembership || (requesterMembership.role !== 'OWNER' && requesterMembership.role !== 'MANAGER')) {
      throw new ForbiddenException('Only owners and managers can remove members');
    }

    // Check target membership exists
    const targetMembership = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: targetUserId, communityId } },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member not found');
    }

    // Cannot remove owner
    if (targetMembership.role === 'OWNER') {
      throw new ForbiddenException('Cannot remove the owner');
    }

    // Managers cannot remove other managers
    if (requesterMembership.role === 'MANAGER' && targetMembership.role === 'MANAGER') {
      throw new ForbiddenException('Managers cannot remove other managers');
    }

    // Remove the member
    await this.prisma.communityMember.delete({
      where: { userId_communityId: { userId: targetUserId, communityId } },
    });

    // Create a ban record (default 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + banDays);
    
    await this.prisma.communityBan.upsert({
      where: { userId_communityId: { userId: targetUserId, communityId } },
      create: {
        userId: targetUserId,
        communityId,
        expiresAt,
        reason: 'Removed by community management',
      },
      update: {
        bannedAt: new Date(),
        expiresAt,
        reason: 'Removed by community management',
      },
    });

    // Update member count
    await this.prisma.community.update({
      where: { id: communityId },
      data: { memberCount: { decrement: 1 } },
    });

    return { message: 'Member removed and banned for ' + banDays + ' days' };
  }

  async getUserMemberships(userId: string) {
    const memberships = await this.prisma.communityMember.findMany({
      where: { userId },
      select: { communityId: true, role: true },
    });

    return memberships.map(m => m.communityId);
  }

  async getUserCommunitiesWithDetails(userId: string) {
    // Get communities where user is a member
    const memberships = await this.prisma.communityMember.findMany({
      where: { userId },
      include: {
        community: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
      },
    });

    // Also get communities where user is the owner (but not a member record)
    const ownedCommunities = await this.prisma.community.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
      },
    });

    // Combine and deduplicate
    const communityMap = new Map<string, { id: string; name: string; slug: string | null; logo: string | null }>();
    
    for (const m of memberships) {
      communityMap.set(m.community.id, m.community);
    }
    
    for (const c of ownedCommunities) {
      communityMap.set(c.id, c);
    }

    return Array.from(communityMap.values());
  }

  async getCommunityMembers(communityIdOrSlug: string) {
    const communityId = await this.resolveId(communityIdOrSlug);
    
    // Get the community
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    // Get all members with roles
    const memberships = await this.prisma.communityMember.findMany({
      where: { communityId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            profileImage: true,
            createdAt: true,
            lastActiveAt: true,
            showOnline: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // OWNER first, then MANAGER, then USER
        { joinedAt: 'desc' },
      ],
    });

    // Consider users "online" if they were active in the last 5 minutes AND showOnline is true
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    return memberships.map(m => ({
      ...m.user,
      joinedAt: m.joinedAt,
      role: m.role,
      isOwner: m.role === 'OWNER',
      isManager: m.role === 'MANAGER',
      isOnline: m.user.showOnline && m.user.lastActiveAt && new Date(m.user.lastActiveAt) > fiveMinutesAgo,
    }));
  }

  async getTopMembers(communityIdOrSlug: string, limit: number = 3) {
    const communityId = await this.resolveId(communityIdOrSlug);
    
    // Get the community to find the owner
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    // Get all member IDs (owner + members)
    const memberships = await this.prisma.communityMember.findMany({
      where: { communityId },
      select: { userId: true },
    });
    const memberIds = new Set([community.ownerId, ...memberships.map(m => m.userId)]);

    // Initialize all members with 0 points
    const pointsMap = new Map<string, number>();
    for (const memberId of memberIds) {
      pointsMap.set(memberId, 0);
    }

    // Get all posts in this community
    const posts = await this.prisma.post.findMany({
      where: { communityId },
      select: {
        authorId: true,
        likes: { select: { userId: true } },
        comments: { select: { userId: true } },
      },
    });

    // Calculate points: post=5, comment=3, like=1, course=20, event RSVP=10
    for (const post of posts) {
      // 5 points for creating a post (only if member)
      if (memberIds.has(post.authorId)) {
        const currentPostPoints = pointsMap.get(post.authorId) || 0;
        pointsMap.set(post.authorId, currentPostPoints + 5);
      }

      // 1 point for each like given (only if member)
      for (const like of post.likes) {
        if (memberIds.has(like.userId)) {
          const currentLikePoints = pointsMap.get(like.userId) || 0;
          pointsMap.set(like.userId, currentLikePoints + 1);
        }
      }

      // 3 points for each comment (only if member)
      for (const comment of post.comments) {
        if (memberIds.has(comment.userId)) {
          const currentCommentPoints = pointsMap.get(comment.userId) || 0;
          pointsMap.set(comment.userId, currentCommentPoints + 3);
        }
      }
    }

    // 5 points for starting a course, 15 additional points for completing
    const courseEnrollments = await this.prisma.courseEnrollment.findMany({
      where: {
        course: { communityId },
      },
      select: { userId: true, completedAt: true },
    });

    for (const enrollment of courseEnrollments) {
      if (memberIds.has(enrollment.userId)) {
        const currentPoints = pointsMap.get(enrollment.userId) || 0;
        // 5 points for enrolling (starting)
        let enrollmentPoints = 5;
        // Additional 15 points if completed
        if (enrollment.completedAt) {
          enrollmentPoints += 15;
        }
        pointsMap.set(enrollment.userId, currentPoints + enrollmentPoints);
      }
    }

    // 10 points for RSVP (GOING) to events in this community
    const eventRsvps = await this.prisma.eventRsvp.findMany({
      where: {
        status: 'GOING',
        event: { communityId },
      },
      select: { userId: true },
    });

    for (const rsvp of eventRsvps) {
      if (memberIds.has(rsvp.userId)) {
        const currentPoints = pointsMap.get(rsvp.userId) || 0;
        pointsMap.set(rsvp.userId, currentPoints + 10);
      }
    }

    // Sort all members by points and take top N
    const sortedMembers = Array.from(pointsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    // Fetch user details
    const userIds = sortedMembers.map(([userId]) => userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        email: true,
        profileImage: true,
      },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    return sortedMembers.map(([userId, points], index) => {
      const user = userMap.get(userId);
      return {
        rank: index + 1,
        userId,
        name: user?.name || 'Unknown',
        email: user?.email || '',
        profileImage: user?.profileImage || null,
        points,
      };
    });
  }

  async getBannedUsers(communityIdOrSlug: string, requesterId: string) {
    const communityId = await this.resolveId(communityIdOrSlug);
    
    // Check if requester is owner or manager
    const requesterMembership = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: requesterId, communityId } },
    });

    if (!requesterMembership || (requesterMembership.role !== 'OWNER' && requesterMembership.role !== 'MANAGER')) {
      throw new ForbiddenException('Only owners and managers can view banned users');
    }

    // Get all active bans
    const bans = await this.prisma.communityBan.findMany({
      where: { 
        communityId,
        expiresAt: { gt: new Date() }, // Only active bans
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImage: true,
          },
        },
      },
      orderBy: { bannedAt: 'desc' },
    });

    return bans.map(ban => ({
      id: ban.id,
      userId: ban.userId,
      user: ban.user,
      reason: ban.reason,
      bannedAt: ban.bannedAt,
      expiresAt: ban.expiresAt,
      daysLeft: Math.ceil((ban.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    }));
  }

  async liftBan(communityIdOrSlug: string, oderId: string, requesterId: string) {
    const communityId = await this.resolveId(communityIdOrSlug);
    
    // Check if requester is owner or manager
    const requesterMembership = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: requesterId, communityId } },
    });

    if (!requesterMembership || (requesterMembership.role !== 'OWNER' && requesterMembership.role !== 'MANAGER')) {
      throw new ForbiddenException('Only owners and managers can lift bans');
    }

    // Find the ban
    const ban = await this.prisma.communityBan.findFirst({
      where: { id: oderId, communityId },
    });

    if (!ban) {
      throw new NotFoundException('Ban not found');
    }

    // Delete the ban
    await this.prisma.communityBan.delete({
      where: { id: oderId },
    });

    return { message: 'Ban lifted successfully' };
  }

  async getCommunityManagers(communityIdOrSlug: string) {
    const communityId = await this.resolveId(communityIdOrSlug);
    
    // Get the community
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    // Get owners and managers
    const memberships = await this.prisma.communityMember.findMany({
      where: { 
        communityId,
        role: { in: ['OWNER', 'MANAGER'] },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return memberships.map(m => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    }));
  }

  async getOnlineMembersCount(communityIdOrSlug: string) {
    const communityId = await this.resolveId(communityIdOrSlug);
    
    // Consider users "online" if they were active in the last 5 minutes AND showOnline is true
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Count members of this community who have been active recently and want to show online
    const onlineCount = await this.prisma.communityMember.count({
      where: {
        communityId,
        user: {
          showOnline: true,
          lastActiveAt: {
            gte: fiveMinutesAgo,
          },
        },
      },
    });

    return { onlineCount };
  }

  async updateRules(communityIdOrSlug: string, userId: string, rules: string[]) {
    try {
      const communityId = await this.resolveId(communityIdOrSlug);
      
      const community = await this.prisma.community.findUnique({
        where: { id: communityId },
      });

      if (!community) {
        throw new NotFoundException('Community not found');
      }

      // Check if user has permission (owner or manager)
      const membership = await this.prisma.communityMember.findUnique({
        where: { userId_communityId: { userId, communityId } },
      });

      if (!membership || (membership.role !== 'OWNER' && membership.role !== 'MANAGER')) {
        throw new ForbiddenException('Only owners and managers can update community rules');
      }

      return await this.prisma.community.update({
        where: { id: communityId },
        data: { rules },
      });
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof ForbiddenException) {
        throw err;
      }
      console.error('Failed to update community rules:', err);
      throw new InternalServerErrorException('Could not update community rules');
    }
  }

  async getRules(communityIdOrSlug: string) {
    const communityId = await this.resolveId(communityIdOrSlug);
    
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { rules: true },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    return { rules: community.rules || [] };
  }

  // Resolve slug or ID to community ID
  async resolveId(idOrSlug: string): Promise<string> {
    // First try to find by ID (cuid format)
    const byId = await this.prisma.community.findUnique({
      where: { id: idOrSlug },
      select: { id: true },
    });

    if (byId) {
      return byId.id;
    }

    // Then try by slug
    const bySlug = await this.prisma.community.findUnique({
      where: { slug: idOrSlug },
      select: { id: true },
    });

    if (bySlug) {
      return bySlug.id;
    }

    throw new NotFoundException('Community not found');
  }

  // Check if a slug is available
  async isSlugAvailable(slug: string, excludeCommunityId?: string): Promise<boolean> {
    const existing = await this.prisma.community.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) {
      return true;
    }

    // If we're checking for an update, exclude the current community
    if (excludeCommunityId && existing.id === excludeCommunityId) {
      return true;
    }

    return false;
  }

  // Update community slug
  async updateSlug(communityIdOrSlug: string, slug: string | null) {
    const communityId = await this.resolveId(communityIdOrSlug);

    // If slug is null, clear it
    if (slug === null) {
      return await this.prisma.community.update({
        where: { id: communityId },
        data: { slug: null },
      });
    }

    // Validate slug format (only lowercase letters, numbers, hyphens)
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      throw new ForbiddenException('Slug can only contain lowercase letters, numbers, and hyphens');
    }

    if (slug.length < 3 || slug.length > 50) {
      throw new ForbiddenException('Slug must be between 3 and 50 characters');
    }

    // Check if slug is available
    const isAvailable = await this.isSlugAvailable(slug, communityId);
    if (!isAvailable) {
      throw new ForbiddenException('This slug is already taken');
    }

    return await this.prisma.community.update({
      where: { id: communityId },
      data: { slug },
    });
  }
}