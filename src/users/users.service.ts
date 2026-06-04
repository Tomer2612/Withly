import { Injectable, BadRequestException, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { EmailService } from '../email/email.service';
import { StorageService } from '../common/storage.service';
import * as bcrypt from 'bcrypt';
import { ERROR_MESSAGES } from '../common/messages';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private storageService: StorageService,
  ) {}

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
        coverImage: true,
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

    // Capture identity + personal R2 file URLs BEFORE the cascade — once
    // the row is deleted we can't look them up. Personal files only
    // (profile/cover images). Content the user authored (post images,
    // course videos, etc.) lives on with the post/course rows under the
    // SetNull anonymization (Phase 5 Mission 2) and keeps its files.
    const email = user.email;
    const displayName = user.name ?? user.email;
    const personalFiles = [user.profileImage, user.coverImage].filter(
      (f): f is string => typeof f === 'string' && f.length > 0,
    );

    // Delete user — cascade handles Cascade-marked relations (RefreshToken,
    // UserPaymentMethod, CommunityMember, CourseEnrollment, etc.); SetNull
    // relations (Post.authorId, Comment.userId, Like.userId, PollVote.userId,
    // Course.authorId, Notification.actorId) drop the FK so content survives
    // anonymized.
    await this.prisma.user.delete({
      where: { id: user.id },
    });

    // R2 cleanup — fire-and-forget. Best-effort: a single failed delete
    // shouldn't roll back the account deletion or surface to the caller.
    if (personalFiles.length > 0) {
      void Promise.allSettled(
        personalFiles.map((f) => this.storageService.deleteFile(f)),
      ).then((results) => {
        for (let i = 0; i < results.length; i++) {
          if (results[i].status === 'rejected') {
            this.logger.warn(
              `R2 deleteFile failed for ${personalFiles[i]} (userId=${userId}): ${
                (results[i] as PromiseRejectedResult).reason
              }`,
            );
          }
        }
      });
    }

    // #12 — fire-and-forget confirmation email. Delete already succeeded;
    // a Resend hiccup shouldn't make us bring the user "back" or alarm
    // the caller. Log and continue.
    void this.emailService
      .sendAccountDeletedEmail(email, displayName)
      .catch((err) => {
        this.logger.warn(
          `Account-deleted email failed (userId=${userId}): ${(err as Error).message}`,
        );
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

  // Visibility scopes for profile cards. The owner viewing their own profile
  // (or a member viewing their own joined-list) sees everything. An outside
  // viewer only sees PUBLIC + ACTIVE + non-cancellation-pending.
  private profileVisibilityFilter(isOwnProfile: boolean): Prisma.CommunityWhereInput {
    if (isOwnProfile) return {};
    return {
      status: 'PUBLIC',
      subscriptionStatus: 'ACTIVE',
      subscriptionCancelledAt: null,
    };
  }

  // Get communities created by user
  async getCreatedCommunities(userId: string, viewerUserId?: string) {
    const where: Prisma.CommunityWhereInput = {
      ownerId: userId,
      ...this.profileVisibilityFilter(viewerUserId === userId),
    };
    const communities = await this.prisma.community.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
        logo: true,
        price: true,
        // pendingPrice is what new joiners pay immediately on announcement.
        // Public-facing cards should display this when present.
        pendingPrice: true,
        pendingPriceEffectiveAt: true,
        topic: true,
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return communities.map(({ _count, ...c }) => ({ ...c, memberCount: _count.members + 1 }));
  }

  // Get communities user is a member of
  async getMemberCommunities(userId: string, viewerUserId?: string) {
    const memberships = await this.prisma.communityMember.findMany({
      where: {
        userId,
        community: this.profileVisibilityFilter(viewerUserId === userId),
      },
      include: {
        community: {
          select: {
            id: true,
            name: true,
            description: true,
            image: true,
            logo: true,
            price: true,
            // pendingPrice — what new joiners pay immediately. Public-facing
            // cards should display this when present.
            pendingPrice: true,
            pendingPriceEffectiveAt: true,
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

  // Returns the names of communities a given card is currently billing for
  // a user — both communities the user owns (their Withly subscription
  // billing card) and paid communities the user is a member of (their
  // MemberSubscription billing card).
  //
  // During the HYP transition period (Phase 1 → Phase 6.1), checks both
  // the new FK (`Community.paymentMethodId` / `MemberSubscription.paymentMethodId`)
  // AND the legacy `cardLastFour + cardBrand` strings on Community. The
  // legacy match goes away once Phase 6.1 backfill verifies every active
  // community has been re-tokenized.
  private async getCommunitiesUsingCard(
    userId: string,
    card: { id: string; cardLastFour: string; cardBrand: string },
  ): Promise<string[]> {
    const ownedActive = await this.prisma.community.findMany({
      where: {
        ownerId: userId,
        subscriptionStatus: 'ACTIVE',
        OR: [
          { paymentMethodId: card.id },
          { cardLastFour: card.cardLastFour, cardBrand: card.cardBrand },
        ],
      },
      select: { name: true },
    });

    const memberSubs = await this.prisma.memberSubscription.findMany({
      where: {
        userId,
        paymentMethodId: card.id,
        status: 'ACTIVE',
      },
      select: { community: { select: { name: true } } },
    });

    return [
      ...ownedActive.map((c) => c.name),
      ...memberSubs.map((m) => m.community.name),
    ];
  }

  // Payment Methods
  async getPaymentMethods(userId: string) {
    const methods = await this.prisma.userPaymentMethod.findMany({
      where: { userId },
      // Primary first, then by recency. Real createdAt is preserved now
      // (setPrimaryPaymentMethod no longer mutates it).
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });

    // Attach inUseCommunities per card so the UI can pre-empt the delete
    // confirmation when a card is the active billing card on any of the
    // user's communities (owned or paid-member).
    const enriched = await Promise.all(
      methods.map(async (m) => ({
        ...m,
        inUseCommunities: await this.getCommunitiesUsingCard(userId, m),
      })),
    );

    return enriched;
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

  // Phase 3 tokenization. Called after a successful J5=J2 validation (or any
  // successful pay) followed by getToken. Stores the HYP token + card expiry
  // + display fields.
  //
  // Dedup by physical-card identity (last4 + brand + expiry), NOT by token:
  // every fresh tokenization mints a new HYP token even for the same card,
  // so token-only dedup would create duplicate rows (verified empirically
  // 2026-06). On a match, UPDATE the existing row with the newer token —
  // newer tokens are functionally equivalent but represent the latest
  // tokenization HYP issued for this card, so we prefer them for future
  // SOFT charges.
  //
  // Returns `isNew` so callers can distinguish "user added a brand new card"
  // from "user re-added a card they already had" and surface different toasts.
  async addTokenizedPaymentMethod(
    userId: string,
    data: {
      token: string;
      expMonth: number;
      expYear: number;
      cardLastFour: string;
      cardBrand: string;
    },
  ) {
    const existing = await this.prisma.userPaymentMethod.findFirst({
      where: {
        userId,
        cardLastFour: data.cardLastFour,
        cardBrand: data.cardBrand,
        cardExpMonth: data.expMonth,
        cardExpYear: data.expYear,
      },
    });
    if (existing) {
      const updated = await this.prisma.userPaymentMethod.update({
        where: { id: existing.id },
        data: { hypPaymentMethodId: data.token },
      });
      return { paymentMethod: updated, isNew: false };
    }

    const hasAny = await this.prisma.userPaymentMethod.count({ where: { userId } });

    const created = await this.prisma.userPaymentMethod.create({
      data: {
        userId,
        hypPaymentMethodId: data.token,
        cardExpMonth: data.expMonth,
        cardExpYear: data.expYear,
        cardLastFour: data.cardLastFour,
        cardBrand: data.cardBrand,
        isPrimary: hasAny === 0,
      },
    });
    return { paymentMethod: created, isNew: true };
  }

  async deletePaymentMethod(userId: string, paymentMethodId: string) {
    // Check if user has more than one payment method
    const count = await this.prisma.userPaymentMethod.count({
      where: { userId },
    });

    if (count <= 1) {
      throw new BadRequestException(ERROR_MESSAGES.CANNOT_DELETE_LAST_PAYMENT_METHOD);
    }

    // Block deletion if this card is currently billing any of the user's
    // communities (owned or paid-member). Uses the shared helper so the
    // pre-delete check is identical to the inUseCommunities listing the
    // frontend already shows.
    const card = await this.prisma.userPaymentMethod.findFirst({
      where: { id: paymentMethodId, userId },
      select: { id: true, cardLastFour: true, cardBrand: true },
    });
    if (card) {
      const inUse = await this.getCommunitiesUsingCard(userId, card);
      if (inUse.length > 0) {
        throw new ConflictException({
          error: 'CARD_IN_USE',
          message: ERROR_MESSAGES.CARD_IN_USE,
          communities: inUse,
        });
      }
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

  // Owner billing math. Trial length + monthly fee both come off the
  // owner's Plan row now (one source of truth for plan-aware pricing).
  // The Plan table seeded the same values that used to be hardcoded
  // here, so behavior is identical for users on the default plan.
  private addMonths(d: Date, n: number): Date {
    const r = new Date(d);
    r.setMonth(r.getMonth() + n);
    return r;
  }
  private getNextBillingDate(trialStart: Date | null, trialLengthMonths: number): Date {
    const now = new Date();
    if (!trialStart) return this.addMonths(now, 1);
    let candidate = this.addMonths(trialStart, trialLengthMonths);
    while (candidate <= now) candidate = this.addMonths(candidate, 1);
    return candidate;
  }

  async getMemberships(userId: string) {
    // The owner's plan drives the trial length and the monthly fee shown
    // on owned-community rows. Fetched once per request so the per-row
    // map below doesn't re-query.
    const userWithPlan = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: { select: { monthlyPriceILS: true, trialLengthMonths: true } } },
    });
    // Plan should always exist post-migration (backfill set every user),
    // but defend against NULL planId on legacy rows or partial setups.
    // Cheapest active plan as the fallback — matches getDefault().
    const planMonthlyPrice = userWithPlan?.plan?.monthlyPriceILS ?? 99;
    const planTrialLengthMonths = userWithPlan?.plan?.trialLengthMonths ?? 1;

    // Communities the user is a member of (not as owner).
    const memberRows = await this.prisma.communityMember.findMany({
      where: { userId },
      include: {
        community: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            price: true,
            ownerId: true,
          },
        },
      },
    });

    // Communities the user owns.
    const owned = await this.prisma.community.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        price: true,
        subscriptionStatus: true,
        subscriptionCancelledAt: true,
        suspendedAt: true,
        trialStartDate: true,
        nextBillingDate: true,
        _count: { select: { members: true } },
      },
    });

    // Owner rows (computed billing).
    const ownerRows = owned.map((c) => {
      const isPaid = (c.price ?? 0) > 0;
      // "Paid members" excludes the owner; owner doesn't appear in
      // CommunityMember anyway, so memberCount is paying-member count.
      // Post-Mission-4.5: CommunityMember rows are deleted at period-end
      // when a member cancels, so _count.members reflects active paying
      // members accurately.
      const paidMembersCount = isPaid ? c._count.members : 0;
      return {
        communityId: c.id,
        name: c.name,
        slug: c.slug,
        logo: c.logo,
        role: 'OWNER' as const,
        isPaid,
        // Owner pays the Withly platform fee from their plan, NOT the
        // community's member-facing price. (community.price is what
        // members would pay.)
        price: planMonthlyPrice,
        joinedAt: null as Date | null,
        subscriptionStatus: c.subscriptionStatus,
        subscriptionCancelledAt: c.subscriptionCancelledAt,
        suspendedAt: c.suspendedAt,
        // Prefer the authoritative HYP-supplied date from DB; fall back to
        // the trial-cycle computation for pre-HYP communities (Phase 1.4
        // transition). Once Phase 6.3 cleanup runs and every community has
        // a real subscription, the fallback can be deleted.
        nextBillDate:
          c.subscriptionStatus === 'ACTIVE' && !c.subscriptionCancelledAt
            ? c.nextBillingDate ?? this.getNextBillingDate(c.trialStartDate, planTrialLengthMonths)
            : null,
        effectiveEndDate: c.subscriptionCancelledAt,
        paidMembersCount,
      };
    });

    // Member rows.
    const memberOnly = memberRows.filter((m) => m.community.ownerId !== userId);

    // Phase 4 Mission 4.5 — fetch active/past-due subs for paid memberships so
    // settings can show "cancelled in grace period" rows without a leave button.
    // One bulk query rather than N+1.
    const memberSubs = await this.prisma.memberSubscription.findMany({
      where: {
        userId,
        communityId: { in: memberOnly.map((m) => m.community.id) },
        status: { in: ['ACTIVE', 'PAST_DUE'] },
      },
      select: {
        communityId: true,
        status: true,
        cancelledAt: true,
        currentPeriodEnd: true,
      },
    });
    const subByCommunity = new Map(memberSubs.map((s) => [s.communityId, s]));

    const memberRowsOut = memberOnly.map((m) => {
      const sub = subByCommunity.get(m.community.id);
      return {
        communityId: m.community.id,
        name: m.community.name,
        slug: m.community.slug,
        logo: m.community.logo,
        role: m.role === 'MANAGER' ? ('MANAGER' as const) : ('MEMBER' as const),
        isPaid: (m.community.price ?? 0) > 0,
        price: m.community.price ?? 0,
        joinedAt: m.joinedAt,
        subscriptionStatus: sub?.status ?? null,
        subscriptionCancelledAt: sub?.cancelledAt ?? null,
        suspendedAt: null,
        // For paid+active members, the next charge date. Null when no sub
        // (free community) or sub is in grace period — settings infers from
        // subscriptionCancelledAt + effectiveEndDate in that case.
        nextBillDate: sub && !sub.cancelledAt ? sub.currentPeriodEnd : null,
        effectiveEndDate: sub?.cancelledAt ? sub.currentPeriodEnd : null,
        paidMembersCount: null,
      };
    });

    return [...ownerRows, ...memberRowsOut].sort((a, b) =>
      a.name.localeCompare(b.name, 'he'),
    );
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
