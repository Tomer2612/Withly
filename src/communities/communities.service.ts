import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma, CommunityStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { canManageCommunity, getEffectiveRole } from '../common/community-roles.helper';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommunitiesService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // Throws ForbiddenException('COMMUNITY_SUSPENDED') if the community's
  // subscription is suspended. Used to gate writes against community-scoped
  // content (posts, comments, events, courses, joins). Reads stay open so the
  // frontend popup can render and the owner can navigate manage tabs.
  async assertActive(idOrSlug: string): Promise<void> {
    const id = await this.resolveId(idOrSlug);
    const community = await this.prisma.community.findUnique({
      where: { id },
      select: { subscriptionStatus: true },
    });
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    if (community.subscriptionStatus === 'SUSPENDED') {
      throw new ForbiddenException('COMMUNITY_SUSPENDED');
    }
  }

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
      // Create community
      const community = await this.prisma.community.create({
        data: {
          name,
          description,
          ownerId,
          image: image || null,
          logo: logo || null,
          topic: topic || null,
          price: price ?? 0,
          youtubeUrl: youtubeUrl || null,
          whatsappUrl: whatsappUrl || null,
          facebookUrl: facebookUrl || null,
          instagramUrl: instagramUrl || null,
          galleryImages: galleryImages || [],
          galleryVideos: galleryVideos || [],
          trialStartDate: new Date(),
        },
      });

      return community;
    } catch {
      throw new InternalServerErrorException('Could not create community');
    }
  }

  async findAll() {
    try {
      const communities = await this.prisma.community.findMany({
        where: {
          status: 'PUBLIC',
          // Mirror the DRAFT pattern — SUSPENDED *and* pending-cancellation
          // communities disappear from public discovery. They stay reachable
          // via direct URL (popup handles the experience) and the user's
          // personal lists (created/joined).
          subscriptionStatus: 'ACTIVE',
          subscriptionCancelledAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          _count: {
            select: { members: true }
          }
        }
      });
      
      // +1 includes the owner, who has no community_members row after D2.
      return communities.map(community => ({
        ...community,
        memberCount: community._count.members + 1,
      }));
    } catch {
      throw new InternalServerErrorException('Could not fetch communities');
    }
  }

  async findById(idOrSlug: string, viewerUserId?: string) {
    try {
      const include = {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImage: true,
          },
        },
        _count: { select: { members: true } },
      } as const;

      // First try to find by ID
      let community = await this.prisma.community.findUnique({
        where: { id: idOrSlug },
        include,
      });

      // If not found by ID, try by slug
      if (!community) {
        community = await this.prisma.community.findUnique({
          where: { slug: idOrSlug },
          include,
        });
      }

      if (!community) {
        throw new NotFoundException('Community not found');
      }

      // DRAFT communities are visible only to the owner and managers.
      // Use 404 (not 403) so we don't leak that the community exists.
      if (community.status === 'DRAFT') {
        const isPrivileged = viewerUserId
          && (await this.canViewDraft(community.id, community.ownerId, viewerUserId));
        if (!isPrivileged) {
          throw new NotFoundException('Community not found');
        }
      }

      // Surface a memberCount field derived from _count, keeping the same
      // wire shape callers expect after the column was dropped.
      return { ...community, memberCount: community._count.members + 1 };
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      throw new InternalServerErrorException('Could not fetch community');
    }
  }

  private async canViewDraft(
    communityId: string,
    ownerId: string,
    viewerUserId: string,
  ): Promise<boolean> {
    // Owner via Community.ownerId — reliable even for older communities that
    // predate the OWNER row in community_members.
    if (ownerId === viewerUserId) return true;

    // Manager role lives only in community_members.
    const membership = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: viewerUserId, communityId } },
      select: { role: true },
    });
    return membership?.role === 'MANAGER';
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
    cardLastFour?: string | null,
    cardBrand?: string | null,
    showOnlineMembers?: boolean,
    status?: string,
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
      if (!canManageCommunity(await getEffectiveRole(this.prisma, id, userId))) {
        throw new ForbiddenException('Only owners and managers can update the community');
      }

      // Block edits when SUSPENDED, except payment-only updates (renewal flow).
      // The dedicated PATCH /:id/payment endpoint is preferred; this branch
      // keeps legacy callers working until the frontend migrates.
      const hasNonPaymentChange =
        name !== undefined ||
        description !== undefined ||
        image !== undefined ||
        logo !== undefined ||
        topic !== undefined ||
        youtubeUrl !== undefined ||
        whatsappUrl !== undefined ||
        facebookUrl !== undefined ||
        instagramUrl !== undefined ||
        galleryImages !== undefined ||
        galleryVideos !== undefined ||
        showOnlineMembers !== undefined ||
        status !== undefined;
      if (hasNonPaymentChange) {
        await this.assertActive(id);
      }

      const updateData: Prisma.CommunityUpdateInput = {};
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
      if (cardLastFour !== undefined) {
        updateData.cardLastFour = cardLastFour;
      }
      if (cardBrand !== undefined) {
        updateData.cardBrand = cardBrand;
      }
      if (showOnlineMembers !== undefined) {
        updateData.showOnlineMembers = showOnlineMembers;
      }
      if (status !== undefined) {
        // Validate against the enum so bad input surfaces as 400 instead of
        // a Prisma type error at query time (proper DTO validation lands with S10).
        if (!Object.values(CommunityStatus).includes(status as CommunityStatus)) {
          throw new BadRequestException(`Invalid status: ${status}`);
        }
        // Block PUBLIC → DRAFT (or PRIVATE → DRAFT) when there are non-owner
        // members. Drafting a community with members would zombie them — they
        // can't see the community (canViewDraft excludes USER role) and the
        // app silently bounces them home. The owner's escape is to switch to
        // PRIVATE (members keep access) or cancel the subscription.
        if (status === 'DRAFT' && community.status !== 'DRAFT') {
          const memberCount = await this.prisma.communityMember.count({
            where: { communityId: id },
          });
          if (memberCount > 0) {
            throw new ForbiddenException('CANNOT_DRAFT_WITH_MEMBERS');
          }
        }
        updateData.status = status as CommunityStatus;
      }

      return await this.prisma.community.update({
        where: { id },
        data: updateData,
      });
    } catch (err) {
      if (
        err instanceof NotFoundException
        || err instanceof ForbiddenException
        || err instanceof BadRequestException
      ) {
        throw err;
      }
      throw new InternalServerErrorException('Could not update community');
    }
  }

  // Announce a community price change. Owner only. Stores the new price
  // as `pendingPrice` with an effective date 1 month out — existing members
  // keep paying `community.price` until then; new joiners pay the new price
  // (handled at billing time by HYP). One change per month: if either
  // `pendingPriceEffectiveAt` is still in the future OR the last
  // announcement was less than 1 month ago, the call is rejected.
  async announcePriceChange(idOrSlug: string, userId: string, newPrice: number) {
    if (!Number.isFinite(newPrice) || newPrice < 0 || newPrice > 1000) {
      throw new ForbiddenException('Invalid price');
    }
    const id = await this.resolveId(idOrSlug);
    const community = await this.prisma.community.findUnique({
      where: { id },
      select: {
        ownerId: true,
        price: true,
        pendingPriceEffectiveAt: true,
        priceChangeAnnouncedAt: true,
      },
    });
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    if (community.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can change the community price');
    }

    const now = new Date();
    const pendingStillActive =
      community.pendingPriceEffectiveAt && community.pendingPriceEffectiveAt > now;
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const announcedRecently =
      community.priceChangeAnnouncedAt && community.priceChangeAnnouncedAt > oneMonthAgo;

    if (pendingStillActive || announcedRecently) {
      throw new ForbiddenException('PRICE_CHANGE_RATE_LIMIT');
    }

    const effectiveAt = new Date(now);
    effectiveAt.setMonth(effectiveAt.getMonth() + 1);

    return this.prisma.community.update({
      where: { id },
      data: {
        pendingPrice: newPrice,
        pendingPriceEffectiveAt: effectiveAt,
        priceChangeAnnouncedAt: now,
      },
    });
  }

  // Member-side ack of the price-change popup. Sets the membership row's
  // priceChangeSeenForEffectiveAt to whatever the community currently has,
  // so the popup won't re-trigger for this member on the same announcement.
  async acknowledgePriceChange(idOrSlug: string, userId: string) {
    const communityId = await this.resolveId(idOrSlug);
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { pendingPriceEffectiveAt: true },
    });
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    await this.prisma.communityMember.updateMany({
      where: { userId, communityId },
      data: { priceChangeSeenForEffectiveAt: community.pendingPriceEffectiveAt },
    });
    return { ok: true };
  }

  // Owner-only payment update — separate endpoint so it works while the
  // community is SUSPENDED (renewal flow). The general update() asserts active.
  async updatePaymentInfo(
    idOrSlug: string,
    userId: string,
    data: {
      price?: number | null;
      cardLastFour?: string | null;
      cardBrand?: string | null;
      subscriptionCancelledAt?: Date | null;
    },
  ) {
    try {
      const id = await this.resolveId(idOrSlug);

      const community = await this.prisma.community.findUnique({
        where: { id },
        select: { ownerId: true, subscriptionStatus: true },
      });

      if (!community) {
        throw new NotFoundException('Community not found');
      }

      if (community.ownerId !== userId) {
        throw new ForbiddenException('Only the community owner can update payment info');
      }

      const updateData: Prisma.CommunityUpdateInput = {};
      if (data.price !== undefined) updateData.price = data.price;
      if (data.cardLastFour !== undefined) updateData.cardLastFour = data.cardLastFour;
      if (data.cardBrand !== undefined) updateData.cardBrand = data.cardBrand;

      // Owner-initiated cancel/uncancel. No rate limit — the popup ack is
      // already deduped per-recipient, and we sweep stale "scheduled for
      // suspension" bell notifications on uncancel so members never see a
      // warning for a cancellation that no longer exists.
      let firingScheduledForSuspension = false;
      let firingReactivated = false;
      let clearingScheduledNotifications = false;
      if (data.subscriptionCancelledAt !== undefined) {
        if (data.subscriptionCancelledAt !== null) {
          firingScheduledForSuspension = true;
        } else {
          clearingScheduledNotifications = true;
        }
        updateData.subscriptionCancelledAt = data.subscriptionCancelledAt;
      }

      // Pre-HYP placeholder: if the owner is saving a card while the community
      // is SUSPENDED, treat that as the renewal action and reactivate.
      // When HYP lands this branch is removed — only the successful charge
      // webhook flips SUSPENDED → ACTIVE.
      const savingCard = data.cardLastFour !== undefined || data.cardBrand !== undefined;
      if (savingCard && community.subscriptionStatus === 'SUSPENDED') {
        updateData.subscriptionStatus = 'ACTIVE';
        updateData.suspendedAt = null;
        updateData.subscriptionCancelledAt = null;
        firingReactivated = true;
      }

      const updated = await this.prisma.community.update({
        where: { id },
        data: updateData,
      });

      // Side-effects after successful write. Fire-and-forget — failures here
      // shouldn't roll back the state change.
      if (firingScheduledForSuspension) {
        void this.notifyCommunityScheduledForSuspension(id, userId).catch(() => {});
      }
      if (clearingScheduledNotifications) {
        void this.clearScheduledSuspensionNotifications(id).catch(() => {});
      }
      if (firingReactivated) {
        void this.notifyCommunityReactivated(id, userId).catch(() => {});
      }

      return updated;
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof ForbiddenException) {
        throw err;
      }
      throw new InternalServerErrorException('Could not update payment info');
    }
  }

  // Fanout helpers — notify every member (and manager) of the community,
  // skipping the owner who triggered the action.
  // For the scheduled-suspension fanout we also skip recipients who already
  // have an unread notification of the same type on this community, so a
  // toggle storm of cancel/uncancel doesn't pile up duplicates in the bell.
  private async notifyCommunityScheduledForSuspension(communityId: string, ownerId: string) {
    const [memberships, alreadyNotified] = await Promise.all([
      this.prisma.communityMember.findMany({
        where: { communityId },
        select: { userId: true },
      }),
      this.prisma.notification.findMany({
        where: {
          communityId,
          type: 'COMMUNITY_SCHEDULED_FOR_SUSPENSION',
          isRead: false,
        },
        select: { recipientId: true },
      }),
    ]);
    const skip = new Set([ownerId, ...alreadyNotified.map(n => n.recipientId)]);
    await Promise.all(
      memberships
        .filter(m => !skip.has(m.userId))
        .map(m => this.notificationsService.notifyCommunityScheduledForSuspension(m.userId, ownerId, communityId)),
    );
  }

  // When the owner uncancels, the prior "scheduled for suspension" warnings
  // in members' bells are no longer accurate — sweep them. Only unread ones,
  // so we don't rewrite history if a member already saw the original.
  private async clearScheduledSuspensionNotifications(communityId: string) {
    await this.prisma.notification.deleteMany({
      where: {
        communityId,
        type: 'COMMUNITY_SCHEDULED_FOR_SUSPENSION',
        isRead: false,
      },
    });
  }

  private async notifyCommunityReactivated(communityId: string, ownerId: string) {
    const memberships = await this.prisma.communityMember.findMany({
      where: { communityId },
      select: { userId: true },
    });
    await Promise.all(
      memberships
        .filter(m => m.userId !== ownerId)
        .map(m => this.notificationsService.notifyCommunityReactivated(m.userId, ownerId, communityId)),
    );
  }

  // Member-side ack of the scheduled-suspension popup.
  async acknowledgeSuspensionScheduled(idOrSlug: string, userId: string) {
    const communityId = await this.resolveId(idOrSlug);
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { subscriptionCancelledAt: true },
    });
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    await this.prisma.communityMember.updateMany({
      where: { userId, communityId },
      data: { suspensionScheduledSeenAt: community.subscriptionCancelledAt },
    });
    return { ok: true };
  }

  async joinCommunity(communityIdOrSlug: string, userId: string) {
    try {
      const communityId = await this.resolveId(communityIdOrSlug);

      // Block joins on DRAFT communities. Owners/managers are already members
      // by definition, so the early-return below catches them and they never
      // reach this check via the join flow.
      const community = await this.prisma.community.findUnique({
        where: { id: communityId },
        select: { status: true, subscriptionCancelledAt: true },
      });
      if (!community || community.status === 'DRAFT') {
        throw new NotFoundException('Community not found');
      }

      // Block joins on SUSPENDED communities — popup + redirect at the
      // frontend handles members; this is the API-side guard.
      await this.assertActive(communityId);

      // Block joins during pending-cancellation too. Existing members are
      // grandfathered until the suspension date; new joiners shouldn't sign
      // up just to get kicked next month.
      if (community.subscriptionCancelledAt && community.subscriptionCancelledAt > new Date()) {
        throw new ForbiddenException('COMMUNITY_PENDING_SUSPENSION');
      }

      // Check if user is banned from this community.
      // null expiresAt = indefinite ban; lifted only by liftBan deleting the row.
      // Time-limited bans (legacy) are auto-cleaned once expired.
      const activeBan = await this.prisma.communityBan.findUnique({
        where: { userId_communityId: { userId, communityId } },
      });

      if (activeBan) {
        const isIndefinite = activeBan.expiresAt === null;
        const isStillActive = isIndefinite || activeBan.expiresAt! > new Date();

        if (isStillActive) {
          if (isIndefinite) {
            throw new ForbiddenException('You are banned from this community.');
          }
          const daysLeft = Math.ceil((activeBan.expiresAt!.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          throw new ForbiddenException(`You are banned from this community. Ban expires in ${daysLeft} day(s).`);
        }

        // Expired time-limited ban — clean it up.
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

      return { message: 'Joined community', isMember: true, role: membership.role };
    } catch (err) {
      if (err instanceof ForbiddenException || err instanceof NotFoundException) {
        throw err;
      }
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
        throw new ForbiddenException('Owner cannot leave their own community');
      }

      // Remove membership
      await this.prisma.communityMember.deleteMany({
        where: { userId, communityId },
      });

      return { message: 'Left community', isMember: false };
    } catch (err) {
      if (err instanceof ForbiddenException) {
        throw err;
      }
      throw new InternalServerErrorException('Could not leave community');
    }
  }

  async checkMembership(communityIdOrSlug: string, userId: string) {
    const communityId = await this.resolveId(communityIdOrSlug);

    const [community, membership, ban] = await Promise.all([
      this.prisma.community.findUnique({
        where: { id: communityId },
        select: { ownerId: true },
      }),
      this.prisma.communityMember.findUnique({
        where: { userId_communityId: { userId, communityId } },
      }),
      // Surface ban state too — the frontend needs to know before showing
      // a Join / Payment flow that the user can't actually rejoin.
      this.prisma.communityBan.findUnique({
        where: { userId_communityId: { userId, communityId } },
        select: { expiresAt: true, reason: true },
      }),
    ]);

    const isBanned = !!ban && (ban.expiresAt === null || ban.expiresAt > new Date());
    const isOwner = !!community && community.ownerId === userId;

    if (isOwner) {
      return {
        isMember: true,
        role: 'OWNER' as const,
        isOwner: true,
        isManager: false,
        canEdit: true,
        canDelete: true,
        canManageRoles: true,
        isBanned: false,
        banReason: null,
      };
    }

    if (membership) {
      return {
        isMember: true,
        role: membership.role,
        isOwner: false,
        isManager: membership.role === 'MANAGER',
        canEdit: membership.role === 'MANAGER',
        canDelete: false,
        canManageRoles: false,
        isBanned: false,
        banReason: null,
        joinedAt: membership.joinedAt,
        priceChangeSeenForEffectiveAt: membership.priceChangeSeenForEffectiveAt,
        suspensionScheduledSeenAt: membership.suspensionScheduledSeenAt,
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
      isBanned,
      banReason: isBanned ? ban?.reason ?? null : null,
    };
  }

  async updateMemberRole(communityIdOrSlug: string, targetUserId: string, newRole: 'MANAGER' | 'USER', requesterId: string) {
    const communityId = await this.resolveId(communityIdOrSlug);

    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { ownerId: true },
    });
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    if (community.ownerId !== requesterId) {
      throw new ForbiddenException('Only owners can change member roles');
    }

    if (targetUserId === community.ownerId) {
      throw new ForbiddenException('Cannot change owner role');
    }

    await this.assertActive(communityId);

    // Check target membership exists
    const targetMembership = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: targetUserId, communityId } },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member not found');
    }

    // Update role
    const updated = await this.prisma.communityMember.update({
      where: { userId_communityId: { userId: targetUserId, communityId } },
      data: { role: newRole },
      include: {
        user: {
          select: { id: true, name: true, profileImage: true },
        },
      },
    });

    return { message: 'Role updated', member: updated };
  }

  // Remove a member and create an indefinite ban. The member can rejoin only
  // after an owner/manager calls liftBan (which deletes the ban row).
  async removeMember(communityIdOrSlug: string, targetUserId: string, requesterId: string) {
    const communityId = await this.resolveId(communityIdOrSlug);

    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { ownerId: true },
    });
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    // Cannot remove the owner — they're not a CommunityMember row at all,
    // but checking by id keeps the contract explicit.
    if (targetUserId === community.ownerId) {
      throw new ForbiddenException('Cannot remove the owner');
    }

    const requesterIsOwner = community.ownerId === requesterId;
    const requesterMembership = requesterIsOwner
      ? null
      : await this.prisma.communityMember.findUnique({
          where: { userId_communityId: { userId: requesterId, communityId } },
        });
    const requesterIsManager = !requesterIsOwner && requesterMembership?.role === 'MANAGER';

    if (!requesterIsOwner && !requesterIsManager) {
      throw new ForbiddenException('Only owners and managers can remove members');
    }

    await this.assertActive(communityId);

    // Check target membership exists
    const targetMembership = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: targetUserId, communityId } },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member not found');
    }

    // Managers cannot remove other managers
    if (requesterIsManager && targetMembership.role === 'MANAGER') {
      throw new ForbiddenException('Managers cannot remove other managers');
    }

    // Remove the member
    await this.prisma.communityMember.delete({
      where: { userId_communityId: { userId: targetUserId, communityId } },
    });

    // Create an indefinite ban (expiresAt: null). Lifted manually via liftBan.
    await this.prisma.communityBan.upsert({
      where: { userId_communityId: { userId: targetUserId, communityId } },
      create: {
        userId: targetUserId,
        communityId,
        expiresAt: null,
        reason: 'Removed by community management',
      },
      update: {
        bannedAt: new Date(),
        expiresAt: null,
        reason: 'Removed by community management',
      },
    });

    return { message: 'Member removed and banned' };
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

    // Owner is no longer a community_members row — fold them in from
    // Community.ownerId so the response shape stays the same.
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            createdAt: true,
            lastActiveAt: true,
            showOnline: true,
          },
        },
      },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const memberships = await this.prisma.communityMember.findMany({
      where: { communityId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            createdAt: true,
            lastActiveAt: true,
            showOnline: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // MANAGER first, then USER (enum order)
        { joinedAt: 'desc' },
      ],
    });

    // Consider users "online" if they were active in the last 5 minutes AND showOnline is true
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isOnline = (lastActiveAt: Date | null, showOnline: boolean) =>
      showOnline && !!lastActiveAt && new Date(lastActiveAt) > fiveMinutesAgo;

    const ownerEntry = {
      ...community.owner,
      joinedAt: community.createdAt,
      role: 'OWNER' as const,
      isOwner: true,
      isManager: false,
      isOnline: isOnline(community.owner.lastActiveAt, community.owner.showOnline),
    };

    const memberEntries = memberships.map(m => ({
      ...m.user,
      joinedAt: m.joinedAt,
      role: m.role,
      isOwner: false,
      isManager: m.role === 'MANAGER',
      isOnline: isOnline(m.user.lastActiveAt, m.user.showOnline),
    }));

    return [ownerEntry, ...memberEntries];
  }

  // Leaderboard. Point formula:
  //   post=5, like=1, comment=3, course-enrollment=5, course-completion=+15,
  //   event-RSVP-going=10.
  // Non-members are excluded (the original implementation iterated activity
  // and gated each row through a memberIds Set; this version delegates the
  // counting to the database via groupBy and applies the same Set filter
  // before scoring).
  async getTopMembers(communityIdOrSlug: string, limit: number = 3) {
    const communityId = await this.resolveId(communityIdOrSlug);

    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { ownerId: true },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const memberships = await this.prisma.communityMember.findMany({
      where: { communityId },
      select: { userId: true },
    });
    const memberIds = new Set<string>([community.ownerId, ...memberships.map(m => m.userId)]);

    // Six independent aggregations — fan out concurrently.
    const [
      postCounts,
      likeCounts,
      commentCounts,
      enrollmentCounts,
      completionCounts,
      rsvpCounts,
    ] = await Promise.all([
      this.prisma.post.groupBy({
        by: ['authorId'],
        where: { communityId },
        _count: { _all: true },
      }),
      this.prisma.like.groupBy({
        by: ['userId'],
        where: { post: { communityId } },
        _count: { _all: true },
      }),
      this.prisma.comment.groupBy({
        by: ['userId'],
        where: { post: { communityId } },
        _count: { _all: true },
      }),
      this.prisma.courseEnrollment.groupBy({
        by: ['userId'],
        where: { course: { communityId } },
        _count: { _all: true },
      }),
      this.prisma.courseEnrollment.groupBy({
        by: ['userId'],
        where: { course: { communityId }, completedAt: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.eventRsvp.groupBy({
        by: ['userId'],
        where: { status: 'GOING', event: { communityId } },
        _count: { _all: true },
      }),
    ]);

    const pointsMap = new Map<string, number>();
    for (const id of memberIds) pointsMap.set(id, 0);

    // Posts use authorId, the rest use userId.
    for (const row of postCounts) {
      if (memberIds.has(row.authorId)) {
        pointsMap.set(row.authorId, (pointsMap.get(row.authorId) ?? 0) + row._count._all * 5);
      }
    }

    const addUserPoints = (
      rows: Array<{ userId: string; _count: { _all: number } }>,
      multiplier: number,
    ) => {
      for (const row of rows) {
        if (memberIds.has(row.userId)) {
          pointsMap.set(row.userId, (pointsMap.get(row.userId) ?? 0) + row._count._all * multiplier);
        }
      }
    };

    addUserPoints(likeCounts, 1);
    addUserPoints(commentCounts, 3);
    addUserPoints(enrollmentCounts, 5);
    addUserPoints(completionCounts, 15);
    addUserPoints(rsvpCounts, 10);

    const sortedMembers = Array.from(pointsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const userIds = sortedMembers.map(([id]) => id);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, profileImage: true },
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

    if (!canManageCommunity(await getEffectiveRole(this.prisma, communityId, requesterId))) {
      throw new ForbiddenException('Only owners and managers can view banned users');
    }

    // Get all active bans — indefinite (expiresAt null) OR not-yet-expired.
    const bans = await this.prisma.communityBan.findMany({
      where: {
        communityId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
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
      daysLeft: ban.expiresAt
        ? Math.ceil((ban.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
    }));
  }

  async liftBan(communityIdOrSlug: string, banId: string, requesterId: string) {
    const communityId = await this.resolveId(communityIdOrSlug);

    if (!canManageCommunity(await getEffectiveRole(this.prisma, communityId, requesterId))) {
      throw new ForbiddenException('Only owners and managers can lift bans');
    }

    await this.assertActive(communityId);

    // Find the ban
    const ban = await this.prisma.communityBan.findFirst({
      where: { id: banId, communityId },
    });

    if (!ban) {
      throw new NotFoundException('Ban not found');
    }

    // Delete the ban
    await this.prisma.communityBan.delete({
      where: { id: banId },
    });

    // Return the unbanned userId so the caller can fire a notification.
    return { message: 'Ban lifted successfully', unbannedUserId: ban.userId, communityId };
  }

  async getCommunityManagers(communityIdOrSlug: string) {
    const communityId = await this.resolveId(communityIdOrSlug);

    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: {
        owner: {
          select: { id: true, name: true },
        },
      },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const managers = await this.prisma.communityMember.findMany({
      where: { communityId, role: 'MANAGER' },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    return [
      {
        id: community.owner.id,
        name: community.owner.name,
        role: 'OWNER' as const,
      },
      ...managers.map(m => ({
        id: m.user.id,
        name: m.user.name,
        role: m.role,
      })),
    ];
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
      if (!canManageCommunity(await getEffectiveRole(this.prisma, communityId, userId))) {
        throw new ForbiddenException('Only owners and managers can update community rules');
      }

      await this.assertActive(communityId);

      return await this.prisma.community.update({
        where: { id: communityId },
        data: { rules },
      });
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof ForbiddenException) {
        throw err;
      }
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