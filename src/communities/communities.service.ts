import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, BadRequestException, ConflictException, HttpException, Logger } from '@nestjs/common';
import { Prisma, CommunityStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { canManageCommunity, getEffectiveRole } from '../common/community-roles.helper';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { HypService } from '../payments/hyp.service';
import { TransactionsService } from '../transactions/transactions.service';

// Hebrew dd.M.yyyy format used in lifecycle emails (matches the user's
// spec mockups — e.g., "1.7.2026"). Locale-formatted via he-IL would
// produce "1.7.2026" too but locale settings are environment-dependent;
// this is explicit.
function formatHebrewDate(d: Date): string {
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

@Injectable()
export class CommunitiesService {
  private readonly logger = new Logger(CommunitiesService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
    private hypService: HypService,
    private transactionsService: TransactionsService,
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
    } catch (err) {
      // Re-throw HttpExceptions so the global filter returns the
      // intended status (e.g. a 409 conflict on duplicate slug becomes
      // a 409, not a generic 500). See Phase 6.2 for rationale.
      if (err instanceof HttpException) throw err;
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
    } catch (err) {
      // Re-throw HttpExceptions (see Phase 6.2 rationale on posts.service).
      if (err instanceof HttpException) throw err;
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
        // Phase 6.3: expose the bound payment method's card display fields
        // here instead of denormalized cardLastFour/cardBrand columns on
        // Community (which are being dropped). Frontend reads
        // community.paymentMethod?.cardLastFour for the manage-page display.
        paymentMethod: {
          select: { cardLastFour: true, cardBrand: true },
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
      // Surface the real error before re-wrapping — otherwise the catch-all
      // swallows it and the client just sees "Could not fetch community"
      // with no idea what actually failed.
      this.logger.error(
        `findById(${idOrSlug}) failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw new InternalServerErrorException('Could not fetch community');
    }
  }

  private async canViewDraft(
    communityId: string,
    ownerId: string | null,
    viewerUserId: string,
  ): Promise<boolean> {
    // Owner via Community.ownerId — reliable even for older communities that
    // predate the OWNER row in community_members. NULL ownerId means the
    // owner deleted their account (Phase 5 Mission 4 wind-down); no viewer
    // can match a deleted owner, so the manager check below is authoritative.
    if (ownerId && ownerId === viewerUserId) return true;

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
        // Defense-in-depth: block DRAFT → PUBLIC/PRIVATE when no card is
        // bound. Phase 3.3's restructure makes the pricing flow incapable of
        // producing such a community (Community + paymentMethodId are
        // created in the same transaction), but this guard catches any
        // bypass attempt against legacy DRAFT rows or future flows we
        // haven't thought of. Every Withly community owner pays the
        // platform fee, so the rule is unconditional.
        if (
          (status === 'PUBLIC' || status === 'PRIVATE')
          && community.status === 'DRAFT'
          && !community.paymentMethodId
        ) {
          throw new ForbiddenException('PAYMENT_METHOD_REQUIRED');
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

    const updated = await this.prisma.community.update({
      where: { id },
      data: {
        pendingPrice: newPrice,
        pendingPriceEffectiveAt: effectiveAt,
        priceChangeAnnouncedAt: now,
        // Fresh announcement cycle — the 7-day reminder cron should
        // send again even if a prior reminder was sent for the
        // previous (now-superseded) price change.
        priceChangeReminderSentAt: null,
      },
    });

    // Notify every member by email + bell icon. Fire-and-forget — the
    // price change is already persisted, comms failures shouldn't roll
    // back the DB transition. Owner is not a CommunityMember row, so
    // the existing query naturally excludes them (which is right —
    // the owner is the one who just announced the change).
    void this.broadcastPriceChange(id, userId, updated.name, community.price ?? 0, newPrice, effectiveAt).catch((err) => {
      this.logger.error(`Price change broadcast failed for community ${id}: ${(err as Error).message}`);
    });

    return updated;
  }

  // Fan-out helper: email + notification to every member of a community
  // about a freshly-announced price change. Each per-recipient send is
  // independent — one failed email doesn't block the rest.
  private async broadcastPriceChange(
    communityId: string,
    ownerActorId: string,
    communityName: string,
    oldPrice: number,
    newPrice: number,
    effectiveAt: Date,
  ) {
    const members = await this.prisma.communityMember.findMany({
      where: { communityId },
      select: { userId: true, user: { select: { email: true, name: true } } },
    });
    const dateStr = formatHebrewDate(effectiveAt);
    await Promise.all(
      members.map(async (m) => {
        await this.notificationsService
          .notifyPriceChangeAnnounced(m.userId, ownerActorId, communityId)
          .catch(() => {});
        if (m.user?.email) {
          await this.emailService
            .sendPriceChangeAnnouncementEmail(
              m.user.email,
              m.user.name ?? m.user.email,
              communityName,
              oldPrice,
              newPrice,
              dateStr,
            )
            .catch((err) => {
              this.logger.warn(
                `Price change email failed (user=${m.userId}): ${(err as Error).message}`,
              );
            });
        }
      }),
    );
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
      subscriptionCancelledAt?: Date | null;
    },
  ) {
    try {
      const id = await this.resolveId(idOrSlug);

      const community = await this.prisma.community.findUnique({
        where: { id },
        select: { ownerId: true, subscriptionStatus: true, nextBillingDate: true },
      });

      if (!community) {
        throw new NotFoundException('Community not found');
      }

      if (community.ownerId !== userId) {
        throw new ForbiddenException('Only the community owner can update payment info');
      }

      const updateData: Prisma.CommunityUpdateInput = {};
      if (data.price !== undefined) updateData.price = data.price;

      // Owner-initiated cancel/uncancel. No rate limit — the popup ack is
      // already deduped per-recipient, and we sweep stale "scheduled for
      // suspension" bell notifications on uncancel so members never see a
      // warning for a cancellation that no longer exists.
      let firingScheduledForSuspension = false;
      let clearingScheduledNotifications = false;
      if (data.subscriptionCancelledAt !== undefined) {
        if (data.subscriptionCancelledAt !== null) {
          firingScheduledForSuspension = true;
          // Phase 5 Mission 3 — extend grace to honor paying members' periods.
          // The frontend sends owner.nextBillingDate as the cancellation date,
          // but if any paying member has a later currentPeriodEnd (e.g. they
          // joined just after the owner's last billing cycle), we owe them
          // that time. Take the max so members get what they paid for and
          // the community only fully closes after the last member's period
          // ends. CANCELLED member subs are excluded (Mission 4.5 handles
          // their per-member age-out independently).
          updateData.subscriptionCancelledAt = await this.computeCancellationEffectiveDate(
            id,
            data.subscriptionCancelledAt,
            community.nextBillingDate,
          );
        } else {
          clearingScheduledNotifications = true;
          updateData.subscriptionCancelledAt = null;
        }
        // Fresh cancel cycle (or full revoke) — let the 7-day reminder
        // cron re-evaluate from scratch instead of remembering an old
        // send for a now-superseded cancellation date.
        updateData.suspensionReminderSentAt = null;
      }

      // SUSPENDED→ACTIVE reactivation now lives in bindTokenizedPaymentMethod
      // (Phase 4 Mission 5) — a real SOFT charge against the new card is
      // what flips the status, NOT a card save here. The pre-HYP placeholder
      // that lived here is dropped in Phase 6.3.

      const updated = await this.prisma.community.update({
        where: { id },
        data: updateData,
      });

      // Side-effects after successful write. Fire-and-forget — failures here
      // shouldn't roll back the state change.
      if (firingScheduledForSuspension) {
        void this.notifyCommunityScheduledForSuspension(id, userId).catch(() => {});
        // Owner confirmation email (#8). Members get the popup +
        // notification separately. The owner gets the audit-trail email
        // here as their primary confirmation.
        // Use the persisted date (which may have been extended past
         // data.subscriptionCancelledAt by computeCancellationEffectiveDate
         // above) so the email shows the same date the cron will act on.
        if (updated.subscriptionCancelledAt) {
          void this.sendOwnerCancellationEmailSafely(
            id,
            userId,
            updated.name,
            updated.subscriptionCancelledAt,
          ).catch((err) => {
            this.logger.warn(
              `Owner cancellation email failed (community=${id}): ${(err as Error).message}`,
            );
          });
        }
      }
      if (clearingScheduledNotifications) {
        void this.clearScheduledSuspensionNotifications(id).catch(() => {});
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

  // Phase 5 Mission 4 — called from UsersService.deleteAccount BEFORE
  // the prisma.user.delete fires. For every community the user owns,
  // schedule a graceful wind-down: extend subscriptionCancelledAt to the
  // grace-end (max owner.nextBillingDate, max paying-member periodEnd) so
  // members get exactly the access they paid for; stamp ownerDeletedAt as
  // a terminal flag so the new hard-delete cron pass picks the community
  // up at grace-end (instead of leaving it SUSPENDED indefinitely as an
  // ownerless ghost). Member notifications fire alongside.
  //
  // After this method returns, the caller is expected to proceed with
  // prisma.user.delete; Community.ownerId then becomes NULL via SetNull
  // (the schema FK behavior added in Mission 4) and the community
  // survives in a wind-down state until the cron hard-deletes it.
  async windDownOwnedCommunitiesForUserDelete(userId: string): Promise<number> {
    const owned = await this.prisma.community.findMany({
      where: { ownerId: userId },
      select: { id: true, name: true, nextBillingDate: true, subscriptionCancelledAt: true },
    });
    if (owned.length === 0) return 0;
    const now = new Date();
    for (const c of owned) {
      try {
        // If the community was already in some prior cancellation state
        // (owner-cancelled before deciding to also delete their account),
        // honor the later of: existing scheduled date, the recomputed
        // grace-end. Never shorten what was already promised to members.
        const requested = c.subscriptionCancelledAt ?? now;
        const graceEnd = await this.computeCancellationEffectiveDate(
          c.id,
          requested,
          c.nextBillingDate,
        );
        await this.prisma.community.update({
          where: { id: c.id },
          data: {
            subscriptionCancelledAt: graceEnd,
            ownerDeletedAt: now,
            suspensionReminderSentAt: null,
          },
        });
        // Fan out the scheduled-suspension notification (same one
        // owner-cancel uses). Members don't need to know whether the
        // owner cancelled or deleted — both mean the community is
        // closing on the date in the popup.
        await this.notifyCommunityScheduledForSuspension(c.id, userId);
      } catch (err) {
        // Log and continue — one bad community shouldn't block account
        // deletion. The community stays in its previous state and the
        // user is still deleted; an orphan row is recoverable later.
        this.logger.error(
          `Failed to wind down community ${c.id} for owner-delete of ${userId}: ${(err as Error).message}`,
        );
      }
    }
    return owned.length;
  }

  // Phase 5 Mission 3 follow-on — public preview for the cancel modal.
  // Returns the same date the persist path would use, so the UI can show
  // the accurate grace-end before the owner confirms. Resolves a slug or
  // id; throws NotFoundException if the community doesn't exist. Open to
  // any authenticated user (the cancel modal is frontend-gated to owners).
  async getCancellationPreview(idOrSlug: string): Promise<{ effectiveDate: Date }> {
    const id = await this.resolveId(idOrSlug);
    const community = await this.prisma.community.findUnique({
      where: { id },
      select: { nextBillingDate: true },
    });
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    // Use NOW as the floor — at minimum, the cancellation effective date
    // can't be in the past. This mirrors what the frontend would pass as
    // requestedDate in the (unusual) case of a fully-past owner billing
    // date with no paying members.
    const effectiveDate = await this.computeCancellationEffectiveDate(
      id,
      new Date(),
      community.nextBillingDate,
    );
    return { effectiveDate };
  }

  // Phase 5 Mission 3 — compute the effective cancellation date for a
  // community. The community fully closes only after every paying member's
  // currentPeriodEnd has elapsed (so members get exactly the access they
  // paid for). The owner's own nextBillingDate is also considered — the
  // owner shouldn't be shortchanged on what they already paid us for.
  //
  // Inputs:
  //   - requestedDate: what the frontend sent (typically owner.nextBillingDate)
  //   - ownerNextBillingDate: from the Community row (may be null during trial
  //     setup; in that case we fall back to requestedDate as the floor)
  //
  // Returns the max of: requestedDate, ownerNextBillingDate (if set), and
  // every ACTIVE / PAST_DUE MemberSubscription's currentPeriodEnd. CANCELLED
  // member subs are excluded — Mission 4.5's cron handles their per-member
  // age-out separately and they're already counting down to their own end.
  private async computeCancellationEffectiveDate(
    communityId: string,
    requestedDate: Date,
    ownerNextBillingDate: Date | null,
  ): Promise<Date> {
    const memberMax = await this.prisma.memberSubscription.aggregate({
      where: {
        communityId,
        status: { in: ['ACTIVE', 'PAST_DUE'] },
      },
      _max: { currentPeriodEnd: true },
    });
    const candidates: Date[] = [requestedDate];
    if (ownerNextBillingDate) candidates.push(ownerNextBillingDate);
    if (memberMax._max.currentPeriodEnd) candidates.push(memberMax._max.currentPeriodEnd);
    return candidates.reduce((latest, d) => (d > latest ? d : latest));
  }

  // Phase 3.2 + Phase 4 Mission 5 — bind a UserPaymentMethod to a
  // community. The bind itself is always unconditional: even on charge
  // failure the new card stays bound (owner can retry without re-
  // entering details).
  //
  // Reactivation behavior:
  //   - Community ACTIVE  → just swap the card. No charge. Next monthly
  //     cron pass will use the new card.
  //   - Community SUSPENDED → attempt SOFT retry for plan.monthlyPriceILS.
  //     On success: flip ACTIVE, reset nextBillingDate to now+1 month
  //     (member-friendly: gives a clean 30-day window from reactivation,
  //     not from the original due date that may have been weeks ago).
  //     On failure: stay SUSPENDED, return chargeFailed=true so the
  //     caller surfaces a toast.
  async bindTokenizedPaymentMethod(
    communityId: string,
    userId: string,
    paymentMethod: { id: string },
  ) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      // Wider select than before — we need owner email/name/plan to
      // build the SOFT charge if a retry is warranted, plus community
      // name for the merchant-report Info line.
      select: {
        id: true, name: true, ownerId: true,
        subscriptionStatus: true, paymentMethodId: true,
        owner: {
          select: {
            email: true, name: true,
            plan: { select: { monthlyPriceILS: true } },
          },
        },
      },
    });
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    if (community.ownerId !== userId) {
      throw new ForbiddenException('Only the community owner can update payment info');
    }

    // Same card already bound? Caller surfaces a different toast.
    const wasAlreadyBound = community.paymentMethodId === paymentMethod.id;
    const wasSuspended = community.subscriptionStatus === 'SUSPENDED';

    const updateData: Prisma.CommunityUpdateInput = {
      paymentMethod: { connect: { id: paymentMethod.id } },
      // Phase 6.3: no more cardLastFour/cardBrand mirror. Card display
      // is sourced from the bound paymentMethod relation directly.
    };

    // Suspension-recovery SOFT retry (Mission 5). Only when the
    // community was SUSPENDED — an ACTIVE community swap is just a
    // card change, no charge. Needs the full payment-method row for
    // token + expiry; fetch it separately since the caller only hands
    // us id + display info.
    let chargeAttempted = false;
    let chargeOk = false;
    let chargeCCode: string | null = null;
    // Phase 6.4: surface the HYP transaction Id when the recovery SOFT
    // succeeds — the dunning callback persists it on the dunning row so
    // future refunds (zikoyAPI) can target the recovery charge specifically.
    let chargeHypTxnId: string | null = null;
    if (wasSuspended) {
      chargeAttempted = true;
      const pmRow = await this.prisma.userPaymentMethod.findUnique({
        where: { id: paymentMethod.id },
        select: { hypPaymentMethodId: true, cardExpMonth: true, cardExpYear: true },
      });
      const planPrice = community.owner?.plan?.monthlyPriceILS;
      if (
        !pmRow?.hypPaymentMethodId
        || pmRow.cardExpMonth == null
        || pmRow.cardExpYear == null
        || !planPrice
        || !community.owner?.email
      ) {
        // Missing data needed for SOFT — log + leave the community
        // SUSPENDED. Card is still bound; owner can try a different
        // card or retry once data is fixed.
        this.logger.warn(
          `Recovery SOFT not attempted for community ${communityId}: missing data ` +
          `(token=${!!pmRow?.hypPaymentMethodId} expM=${pmRow?.cardExpMonth} ` +
          `expY=${pmRow?.cardExpYear} planPrice=${planPrice} email=${community.owner?.email})`,
        );
        chargeOk = false;
      } else {
        try {
          const result = await this.hypService.softCharge({
            token: pmRow.hypPaymentMethodId,
            amount: planPrice,
            cardExpMonth: pmRow.cardExpMonth,
            cardExpYear: pmRow.cardExpYear,
            clientName: community.owner.name ?? community.owner.email,
            email: community.owner.email,
            order: `recovery-${communityId}-${Date.now()}`,
            info: `Suspension recovery for community "${community.name}"`,
          });
          chargeOk = result.ok;
          chargeCCode = result.ccode;
          chargeHypTxnId = result.body.Id ?? null;
        } catch (err) {
          this.logger.error(`Recovery SOFT threw for community ${communityId}: ${(err as Error).message}`);
          chargeOk = false;
        }
      }

      if (chargeOk) {
        // Reactivate + set a fresh 30-day window from reactivation.
        const now = new Date();
        const nextBillingDate = new Date(now);
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        updateData.subscriptionStatus = 'ACTIVE';
        updateData.suspendedAt = null;
        updateData.subscriptionCancelledAt = null;
        updateData.nextBillingDate = nextBillingDate;
        updateData.currentPeriodStart = now;
        updateData.currentPeriodEnd = nextBillingDate;
        // Ledger: recovery charge is the owner's platform fee, same as a
        // normal owner-monthly (100% Withly). planPrice is non-null here —
        // chargeOk can only be true when it was truthy above.
        await this.transactionsService.recordCharge({
          kind: 'OWNER_MONTHLY',
          grossAmount: planPrice!,
          communityId,
          ownerId: community.ownerId,
          payerId: userId,
          hypTxnId: chargeHypTxnId,
        });
      }
      // On charge failure: leave status=SUSPENDED. Card is still bound.
    }

    const updated = await this.prisma.community.update({
      where: { id: communityId },
      data: updateData,
    });

    const wasReactivated = chargeAttempted && chargeOk;
    if (wasReactivated) {
      void this.notifyCommunityReactivated(communityId, userId).catch(() => {});
    }

    return {
      community: updated,
      wasAlreadyBound,
      wasReactivated,
      // Mission 5 additions — null when no charge was attempted (active
      // community card swap), false when attempted but rejected, true
      // when attempted and succeeded.
      chargeAttempted,
      chargeFailed: chargeAttempted && !chargeOk,
      chargeCCode,
      // Phase 6.4 — HYP transaction Id of the successful recovery SOFT
      // (null on failure or when no charge was attempted). Dunning
      // callback stores this on the PaymentDunningRequest row.
      chargeHypTxnId,
    };
  }

  // Phase 6.4 — member dunning recovery. Called by the /payments/payment-
  // success dunning dispatch when a member who failed their monthly SOFT
  // comes back via the pay-now link and successfully tokenizes a new card.
  //
  // Flow: get the PAST_DUE MemberSubscription, run a fresh SOFT against
  // the new token, on success flip ACTIVE + advance dates + swap the
  // payment method + persist the new hypSubscriptionId (used for future
  // refunds). On failure, leave PAST_DUE and return chargeFailed so the
  // caller can surface the right toast + leave the dunning row open.
  //
  // Idempotency: if the sub is already ACTIVE (somehow paid by another
  // path), no charge, returns ok=true with no txn id.
  //
  // Member is NOT removed from CommunityMember at PAST_DUE today (Phase 5
  // leaves the row intact), so this method doesn't need to re-create it.
  // If that ever changes, add the create here.
  async recoverMemberFromDunning(
    userId: string,
    communityId: string,
    paymentMethod: {
      id: string;
      hypPaymentMethodId: string;
      cardExpMonth: number;
      cardExpYear: number;
    },
  ): Promise<{
    ok: boolean;
    ccode: string | null;
    hypTxnId: string | null;
    alreadyActive: boolean;
  }> {
    const sub = await this.prisma.memberSubscription.findFirst({
      where: { userId, communityId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub) {
      throw new NotFoundException('No member subscription to recover');
    }
    if (sub.status === 'ACTIVE') {
      return { ok: true, ccode: null, hypTxnId: null, alreadyActive: true };
    }

    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: {
        name: true,
        ownerId: true,
        owner: { select: { plan: { select: { commissionBasisPoints: true } } } },
      },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (!community || !user?.email) {
      throw new NotFoundException('Community or user not found');
    }

    const amount = Math.round(sub.priceAtJoin);
    let chargeResult;
    try {
      chargeResult = await this.hypService.softCharge({
        token: paymentMethod.hypPaymentMethodId,
        amount,
        cardExpMonth: paymentMethod.cardExpMonth,
        cardExpYear: paymentMethod.cardExpYear,
        clientName: user.name ?? user.email,
        email: user.email,
        order: `dunningmember-${communityId}-${userId}-${Date.now()}`,
        info: `Member dunning recovery for "${community.name}"`,
      });
    } catch (err) {
      this.logger.error(
        `Member dunning SOFT threw: user=${userId} community=${communityId}: ${(err as Error).message}`,
      );
      return { ok: false, ccode: null, hypTxnId: null, alreadyActive: false };
    }

    if (!chargeResult.ok) {
      return { ok: false, ccode: chargeResult.ccode, hypTxnId: null, alreadyActive: false };
    }

    const now = new Date();
    const nextBillingDate = new Date(now);
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    await this.prisma.memberSubscription.update({
      where: { id: sub.id },
      data: {
        status: 'ACTIVE',
        paymentMethodId: paymentMethod.id,
        // Replace the failed hypSubscriptionId with the fresh charge's
        // txn id — that's the one Mission 5 refunds (CancelTrans / zikoyAPI)
        // would target if the member later gets kicked.
        hypSubscriptionId: chargeResult.body.Id ?? sub.hypSubscriptionId,
        nextBillingDate,
        currentPeriodStart: now,
        currentPeriodEnd: nextBillingDate,
      },
    });

    // Ledger: member recovery charge — same split as a normal member-monthly.
    await this.transactionsService.recordCharge({
      kind: 'MEMBER_MONTHLY',
      grossAmount: amount,
      commissionBasisPoints: community.owner?.plan?.commissionBasisPoints,
      communityId,
      ownerId: community.ownerId,
      payerId: userId,
      memberSubscriptionId: sub.id,
      hypTxnId: chargeResult.body.Id ?? null,
    });

    return {
      ok: true,
      ccode: '0',
      hypTxnId: chargeResult.body.Id ?? null,
      alreadyActive: false,
    };
  }

  // Phase 3.3 — pricing checkout staging. The pricing page collects community
  // details, calls this, opens the HYP tokenize iframe with the returned
  // pendingId in the Order field. On tokenize success the
  // payments controller calls finalizeCommunityFromPending to atomically
  // create the real Community row + bind the card + delete this staging row.
  //
  // One pending per user (enforced by @unique on userId): upserting means
  // re-filling the form / retrying replaces the existing row, never duplicates.
  async beginCheckout(
    userId: string,
    fields: {
      name: string;
      description: string;
      topic?: string | null;
      youtubeUrl?: string | null;
      whatsappUrl?: string | null;
      facebookUrl?: string | null;
      instagramUrl?: string | null;
    },
  ) {
    const data = {
      name: fields.name,
      description: fields.description,
      topic: fields.topic ?? null,
      youtubeUrl: fields.youtubeUrl ?? null,
      whatsappUrl: fields.whatsappUrl ?? null,
      facebookUrl: fields.facebookUrl ?? null,
      instagramUrl: fields.instagramUrl ?? null,
    };
    const pending = await this.prisma.pendingCommunityCreation.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      select: { id: true },
    });
    return { pendingId: pending.id };
  }

  // Frontend resume hook: returns the user's pending checkout (if any) so
  // the pricing page can pre-fill the form on re-entry. Null when nothing
  // is in flight.
  async getPendingForUser(userId: string) {
    return this.prisma.pendingCommunityCreation.findUnique({
      where: { userId },
    });
  }

  // Saved-card variant of bindTokenizedPaymentMethod. The user picked an
  // existing UserPaymentMethod from their wallet via the picker UI rather
  // than tokenizing a new card through HYP. Verifies ownership and that
  // the card isn't expired, then delegates to the same bind logic the
  // tokenize-redirect path uses — same SUSPENDED→ACTIVE flip, same
  // wasAlreadyBound semantics, same emails.
  async bindExistingCardToCommunity(
    communityId: string,
    userId: string,
    paymentMethodId: string,
  ) {
    const pm = await this.prisma.userPaymentMethod.findUnique({
      where: { id: paymentMethodId },
      select: {
        id: true, userId: true, cardLastFour: true, cardBrand: true,
        cardExpMonth: true, cardExpYear: true,
      },
    });
    if (!pm || pm.userId !== userId) {
      throw new NotFoundException('Payment method not found');
    }
    if (this.isExpired(pm.cardExpMonth, pm.cardExpYear)) {
      throw new BadRequestException('CARD_EXPIRED');
    }
    return this.bindTokenizedPaymentMethod(communityId, userId, { id: pm.id });
  }

  // Saved-card variant of the new-community finalize path. The user picked
  // an existing card from their wallet on the Screen 1 confirm popup
  // instead of opening the HYP iframe. Creates the Community atomically
  // with the chosen card bound, deletes the pending row. Same atomicity
  // guarantee as finalizeCommunityFromPending — community + card binding
  // happen together or not at all.
  async finalizeCommunityWithExistingCard(
    pendingId: string,
    userId: string,
    paymentMethodId: string,
  ) {
    const pm = await this.prisma.userPaymentMethod.findUnique({
      where: { id: paymentMethodId },
      select: {
        id: true, userId: true, cardLastFour: true, cardBrand: true,
        cardExpMonth: true, cardExpYear: true,
      },
    });
    if (!pm || pm.userId !== userId) {
      throw new NotFoundException('Payment method not found');
    }
    if (this.isExpired(pm.cardExpMonth, pm.cardExpYear)) {
      throw new BadRequestException('CARD_EXPIRED');
    }
    return this.finalizeCommunityFromPending(pendingId, userId, { id: pm.id });
  }

  // Defense-in-depth expiry check. HYP would reject a SOFT charge on an
  // expired card anyway (Phase 4), but failing it here gives a clean
  // 400 with a typed error instead of a downstream charge failure.
  // NULL exp fields predate HYP wiring (Phase 6.1 backfill) — treat as
  // unexpired so legacy rows don't get blocked.
  private isExpired(expMonth: number | null, expYear: number | null): boolean {
    if (expMonth == null || expYear == null) return false;
    const now = new Date();
    const nowYM = now.getFullYear() * 100 + (now.getMonth() + 1);
    const cardYM = expYear * 100 + expMonth;
    return cardYM < nowYM;
  }

  // Atomic finalization after tokenize success. Creates the Community row
  // from the staged fields, binds the freshly-tokenized payment method,
  // and deletes the pending row — all in one transaction so we can never
  // end up with a community that has no card (the whole point of the
  // restructure). Returns the created Community.
  async finalizeCommunityFromPending(
    pendingId: string,
    userId: string,
    paymentMethod: { id: string },
  ) {
    const pending = await this.prisma.pendingCommunityCreation.findUnique({
      where: { id: pendingId },
    });
    if (!pending) {
      throw new NotFoundException('Pending checkout not found');
    }
    if (pending.userId !== userId) {
      throw new ForbiddenException('Pending checkout belongs to a different user');
    }

    // Seed nextBillingDate = trialStart + plan.trialLengthMonths so the
    // Phase 4 cron has a clean trigger when the trial ends. Falls back to
    // 1 month if the user has no plan (shouldn't happen post-restructure
    // but defensive).
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: { select: { trialLengthMonths: true } } },
    });
    const trialLengthMonths = owner?.plan?.trialLengthMonths ?? 1;
    const trialStartDate = new Date();
    const nextBillingDate = new Date(trialStartDate);
    nextBillingDate.setMonth(nextBillingDate.getMonth() + trialLengthMonths);

    const community = await this.prisma.$transaction(async (tx) => {
      const created = await tx.community.create({
        data: {
          name: pending.name,
          description: pending.description,
          ownerId: userId,
          topic: pending.topic,
          image: pending.image,
          logo: pending.logo,
          price: pending.price ?? 0,
          youtubeUrl: pending.youtubeUrl,
          whatsappUrl: pending.whatsappUrl,
          facebookUrl: pending.facebookUrl,
          instagramUrl: pending.instagramUrl,
          galleryImages: pending.galleryImages,
          galleryVideos: pending.galleryVideos,
          showOnlineMembers: pending.showOnlineMembers,
          trialStartDate,
          // First SOFT charge fires when nextBillingDate <= now. Cron
          // picks it up; success advances by 1 month; failure suspends.
          nextBillingDate,
          // Bind card immediately — atomicity is the whole point. Use the
          // scalar FK column directly so we can keep ownerId as a scalar
          // too (Prisma forbids mixing nested-connect with scalar FKs in
          // the same create input).
          // Phase 6.3: no more cardLastFour/cardBrand mirror.
          paymentMethodId: paymentMethod.id,
        },
      });
      await tx.pendingCommunityCreation.delete({ where: { id: pendingId } });
      return created;
    });

    // Owner welcome email — fire-and-forget. Includes the trial-end
    // date so the owner knows when the first SOFT charge (Phase 4)
    // will hit. Falls back to 1-month trial if plan join failed.
    void this.sendOwnerWelcomeEmailSafely(userId, community.id, community.trialStartDate).catch((err) => {
      this.logger.warn(`Welcome email failed (community=${community.id}): ${(err as Error).message}`);
    });

    return community;
  }

  // Owner welcome (#4). Looks up the user + their plan to compute the
  // trial-end date. Plan lookup falls back gracefully — Phase 3.3
  // restructure guarantees user.plan is non-null post-launch, but the
  // default 1-month value matches the seed.
  private async sendOwnerWelcomeEmailSafely(
    userId: string,
    communityId: string,
    trialStartDate: Date | null,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, plan: { select: { trialLengthMonths: true } } },
    });
    if (!user?.email) return;
    const trialMonths = user.plan?.trialLengthMonths ?? 1;
    const start = trialStartDate ?? new Date();
    const trialEnd = new Date(start);
    trialEnd.setMonth(trialEnd.getMonth() + trialMonths);
    await this.emailService.sendOwnerCommunityWelcomeEmail(
      user.email,
      user.name ?? user.email,
      communityId,
      formatHebrewDate(trialEnd),
    );
  }

  // Phase 4 Mission 3 — paid-member-join with existing card on file.
  // Member already has a tokenized payment method; just resolve it,
  // validate, and route through the shared executor. The HYP iframe
  // is bypassed entirely (no tokenize step needed).
  async joinPaidCommunityWithExistingCard(
    communityId: string,
    userId: string,
    paymentMethodId: string,
  ) {
    const pm = await this.prisma.userPaymentMethod.findUnique({
      where: { id: paymentMethodId },
      select: {
        id: true, userId: true, cardLastFour: true, cardBrand: true,
        hypPaymentMethodId: true, cardExpMonth: true, cardExpYear: true,
      },
    });
    if (!pm || pm.userId !== userId) {
      throw new NotFoundException('Payment method not found');
    }
    if (!pm.hypPaymentMethodId) {
      // Pre-Phase-3 row without a HYP token. Member needs to re-tokenize.
      throw new BadRequestException('TOKEN_MISSING');
    }
    if (this.isExpired(pm.cardExpMonth, pm.cardExpYear)) {
      throw new BadRequestException('CARD_EXPIRED');
    }
    return this.executePaidJoin(communityId, userId, {
      id: pm.id,
      hypPaymentMethodId: pm.hypPaymentMethodId,
      cardExpMonth: pm.cardExpMonth!,
      cardExpYear: pm.cardExpYear!,
      cardLastFour: pm.cardLastFour,
      cardBrand: pm.cardBrand,
    });
  }

  // Phase 4 Mission 3 — same join logic, called from the payments-
  // controller dispatch after a fresh tokenize through the HYP iframe.
  // The caller has already minted the token + stored the
  // UserPaymentMethod via UsersService.addTokenizedPaymentMethod; we
  // just run the join + first SOFT.
  async finalizePaidJoinFromTokenize(
    communityId: string,
    userId: string,
    paymentMethod: {
      id: string;
      hypPaymentMethodId: string;
      cardExpMonth: number;
      cardExpYear: number;
      cardLastFour: string;
      cardBrand: string;
    },
  ) {
    return this.executePaidJoin(communityId, userId, paymentMethod);
  }

  // Atomic execution: validate community + membership state, create
  // CommunityMember + MemberSubscription, fire the first SOFT charge.
  // Wraps the writes + the SOFT call in a Prisma transaction so a
  // CCode != 0 (or thrown error) rolls back the rows — no orphan
  // memberships if the charge fails. Edge case (charge succeeds but
  // tx throws after) is unavoidable without idempotency keys; accept
  // for MVP and reconcile manually if it ever happens.
  private async executePaidJoin(
    communityId: string,
    userId: string,
    paymentMethod: {
      id: string;
      hypPaymentMethodId: string;
      cardExpMonth: number;
      cardExpYear: number;
      cardLastFour: string;
      cardBrand: string;
    },
  ) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: {
        id: true, name: true, ownerId: true, status: true,
        price: true, pendingPrice: true,
        subscriptionStatus: true, subscriptionCancelledAt: true,
        owner: { select: { plan: { select: { commissionBasisPoints: true } } } },
      },
    });
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    if (community.status === 'DRAFT') {
      throw new ForbiddenException('Community is not published');
    }
    if (community.subscriptionStatus === 'SUSPENDED') {
      throw new ForbiddenException('COMMUNITY_SUSPENDED');
    }
    if (community.ownerId === userId) {
      throw new ForbiddenException('Owner cannot join own community');
    }
    // Effective join price = pendingPrice when one is scheduled (so new
    // joiners pay the announced new price during the notice period;
    // existing members stay locked at their priceAtJoin). Mirrors the
    // frontend joinPrice() helper. Falls back to community.price when
    // no pending change is in flight.
    const effectivePrice = community.pendingPrice ?? community.price;
    if (!effectivePrice || effectivePrice <= 0) {
      // Free community — use the regular join endpoint, not this one.
      throw new BadRequestException('Community is free');
    }

    const existingMember = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });
    if (existingMember) {
      throw new ConflictException('Already a member');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (!user?.email) {
      throw new NotFoundException('User not found');
    }

    const now = new Date();
    const nextBillingDate = new Date(now);
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    // HYP rejects non-integer amounts; price fields are Float but in
    // practice always whole shekels. Round to be safe.
    const amount = Math.round(effectivePrice);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // First SOFT charge BEFORE the DB writes so we can store the
        // real HYP transaction Id on the sub (Phase 5 Mission 5 needs
        // it for refunds). Within-tx network call is slow (~1.5s) but
        // acceptable for Withly's volume. Throws on non-zero CCode →
        // tx rolls back (no DB writes happened yet anyway).
        const chargeResult = await this.hypService.softCharge({
          token: paymentMethod.hypPaymentMethodId,
          amount,
          cardExpMonth: paymentMethod.cardExpMonth,
          cardExpYear: paymentMethod.cardExpYear,
          clientName: user.name ?? user.email,
          email: user.email,
          order: `memberjoin-${communityId}-${userId}-${Date.now()}`,
          info: `Join "${community.name}"`,
        });
        if (!chargeResult.ok) {
          throw new BadRequestException(`CHARGE_FAILED:${chargeResult.ccode}`);
        }
        // Defensive — HYP should always return Id alongside CCode=0,
        // but if for any reason it's missing we can't store a refund
        // anchor. Fail loudly rather than silently lose refundability.
        const hypTxnId = chargeResult.body.Id;
        if (!hypTxnId) {
          throw new InternalServerErrorException(
            `HYP returned CCode=0 but no Id — order=${chargeResult.body.Order ?? '?'}`,
          );
        }

        await tx.communityMember.create({
          data: { userId, communityId, role: 'USER' },
        });
        const subscription = await tx.memberSubscription.create({
          data: {
            userId,
            communityId,
            paymentMethodId: paymentMethod.id,
            // The real HYP transaction Id from the first SOFT charge.
            // Phase 5 Mission 5 uses this as the TransId for refunds
            // (CancelTrans + zikoyAPI both reference it).
            hypSubscriptionId: hypTxnId,
            // Non-null narrowed by the effectivePrice > 0 guard above.
            // Locks the joiner at the price they actually paid today —
            // when pendingPrice was in effect, that's the new price,
            // not the soon-to-be-obsolete community.price.
            priceAtJoin: effectivePrice,
            nextBillingDate,
            currentPeriodStart: now,
            currentPeriodEnd: nextBillingDate,
            status: 'ACTIVE',
          },
        });

        return { subscription, hypId: hypTxnId };
      });

      // Ledger: first member charge → same split as recurring member-monthly.
      // Outside the tx (fail-soft) so a recording hiccup can't roll back a
      // paid join that already moved money.
      await this.transactionsService.recordCharge({
        kind: 'MEMBER_MONTHLY',
        grossAmount: amount,
        commissionBasisPoints: community.owner?.plan?.commissionBasisPoints,
        communityId: community.id,
        ownerId: community.ownerId,
        payerId: userId,
        memberSubscriptionId: result.subscription.id,
        hypTxnId: result.hypId,
      });

      // Post-success side effects (outside tx, fire-and-forget).
      void this.emailService
        .sendPaidMemberJoinedEmail(
          user.email,
          user.name ?? user.email,
          community.name,
          community.id,
          amount,
          formatHebrewDate(nextBillingDate),
        )
        .catch((err) => {
          this.logger.warn(`Paid-joined email failed (user=${userId}): ${(err as Error).message}`);
        });
      // Owner gets the bell-icon notification — existing
      // notifyCommunityJoin handles the per-type prefs (owner can
      // opt-in/out via the join notification toggle). Skipped if the
      // owner deleted their account (Phase 5 Mission 4 wind-down).
      if (community.ownerId) {
        void this.notificationsService
          .notifyCommunityJoin(community.ownerId, userId, community.id)
          .catch(() => {});
      }

      this.logger.log(
        `Paid join: user=${userId} community=${communityId} amount=${amount} hypId=${result.hypId}`,
      );
      return {
        community,
        memberSubscription: result.subscription,
      };
    } catch (err) {
      // Re-throw NestJS exceptions as-is (they have HTTP status info).
      // Pure database errors bubble up as 500s, which is fine — they
      // indicate an unexpected bug.
      throw err;
    }
  }

  // Phase 4 Mission 4.5 — member's view of their membership in a
  // community. Resolves whether they're a member at all, whether their
  // subscription is paid, and the cancellation/billing state. Used by
  // the about page + settings to decide which leave/cancel modal to
  // show: paid-active → CancelPaidMembershipModal; free or already-
  // cancelled → LeaveCommunityModal.
  async getMyMembership(communityIdOrSlug: string, userId: string) {
    const communityId = await this.resolveId(communityIdOrSlug);
    const member = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
      select: { role: true, joinedAt: true },
    });
    if (!member) {
      return { isMember: false, hasPaidSubscription: false, subscription: null };
    }
    // Find the most recent paid subscription if any. The cron's period-end
    // pass deletes CommunityMember rows but KEEPS MemberSubscription rows
    // (historical record), so an old CANCELLED sub doesn't imply current
    // membership. We pair the CommunityMember check (current member) with
    // the most recent sub (for status if any).
    const sub = await this.prisma.memberSubscription.findFirst({
      where: { userId, communityId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        cancelledAt: true,
        currentPeriodEnd: true,
        priceAtJoin: true,
      },
    });
    return {
      isMember: true,
      role: member.role,
      hasPaidSubscription: !!sub && (sub.status === 'ACTIVE' || sub.status === 'PAST_DUE'),
      subscription: sub,
    };
  }

  // Phase 4 Mission 4.5 — member-initiated paid-subscription cancel.
  // Sets MemberSubscription.cancelledAt but does NOT immediately end
  // access; the cron's applyMemberCancellationsAtPeriodEnd pass
  // handles the period-end transition (status → CANCELLED + delete
  // CommunityMember). Idempotent: re-cancelling returns the existing
  // cancelledAt without changing anything. Industry standard: no
  // prorated refund — the member keeps the rest of their already-paid
  // period.
  async cancelPaidMembership(communityIdOrSlug: string, userId: string) {
    const communityId = await this.resolveId(communityIdOrSlug);
    const sub = await this.prisma.memberSubscription.findFirst({
      where: { userId, communityId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        cancelledAt: true,
        currentPeriodEnd: true,
        priceAtJoin: true,
        community: { select: { name: true } },
      },
    });
    if (!sub) {
      throw new NotFoundException('No active paid membership found');
    }

    if (!sub.cancelledAt) {
      await this.prisma.memberSubscription.update({
        where: { id: sub.id },
        data: { cancelledAt: new Date() },
      });
    }

    // Fire-and-forget confirmation email. Lookup user once.
    void (async () => {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });
        if (!user?.email) return;
        await this.emailService.sendMemberCancellationConfirmationEmail(
          user.email,
          user.name ?? user.email,
          sub.community.name,
          formatHebrewDate(sub.currentPeriodEnd),
        );
      } catch (err) {
        this.logger.warn(
          `Member-cancellation email failed (user=${userId} sub=${sub.id}): ${(err as Error).message}`,
        );
      }
    })();

    return {
      ok: true,
      subscriptionId: sub.id,
      effectiveEndDate: sub.currentPeriodEnd,
    };
  }

  // Owner cancellation confirmation email (#8). Looks up the owner's
  // email + name, sends. Effective date is when the community will
  // actually flip to SUSPENDED (community.subscriptionCancelledAt).
  private async sendOwnerCancellationEmailSafely(
    communityId: string,
    ownerId: string,
    communityName: string,
    effectiveDate: Date,
  ): Promise<void> {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { email: true, name: true },
    });
    if (!owner?.email) return;
    await this.emailService.sendOwnerCancellationConfirmationEmail(
      owner.email,
      owner.name ?? owner.email,
      communityName,
      formatHebrewDate(effectiveDate),
    );
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

    // Phase 5 Mission 5 — if the kicked member has an active paid
    // subscription with unused period, attempt a prorated refund BEFORE
    // we delete their CommunityMember row. The kick proceeds regardless
    // (refund failure stamps refundAmountOwed on the sub for the
    // retryOwedRefunds cron). Skipped for free / cancelled / past-due /
    // already-expired-period subs.
    await this.refundKickedMemberIfOwed(communityId, targetUserId);

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

  // Phase 5 Mission 5 — called from removeMember (and conceptually from
  // any future "ban with refund" entry points). Computes the unused-
  // period prorated refund, attempts CancelTrans first (free, same-day
  // void), falls back to zikoyAPI. On HYP rejection, stamps
  // refundAmountOwed on the sub so retryOwedRefunds picks it up. Always
  // sets sub.status = CANCELLED so the recurring-charge cron stops
  // charging the kicked member, regardless of refund outcome.
  //
  // Skip conditions (no refund, just terminate the sub):
  //   - No active sub (free community member)
  //   - Sub already cancelled (cancelledAt set — member-initiated cancel)
  //   - Sub status CANCELLED (already ended)
  //   - Sub status PAST_DUE (last charge failed — nothing to refund)
  //   - currentPeriodEnd in the past (period already used up)
  //   - Prorated amount rounds to 0 (negligible time left)
  private async refundKickedMemberIfOwed(
    communityId: string,
    kickedUserId: string,
  ): Promise<void> {
    const sub = await this.prisma.memberSubscription.findFirst({
      where: {
        userId: kickedUserId,
        communityId,
        status: 'ACTIVE',
        cancelledAt: null,
      },
      select: {
        id: true,
        hypSubscriptionId: true,
        priceAtJoin: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        createdAt: true,
        community: {
          select: {
            ownerId: true,
            owner: { select: { plan: { select: { commissionBasisPoints: true } } } },
          },
        },
      },
    });
    if (!sub) return;

    const now = new Date();
    if (sub.currentPeriodEnd <= now) {
      // Period already fully used. Just terminate the sub so cron stops.
      await this.prisma.memberSubscription.update({
        where: { id: sub.id },
        data: { status: 'CANCELLED', cancelledAt: now },
      });
      return;
    }

    // Prorated refund = priceAtJoin * (remaining / total). Round to whole
    // shekels — HYP rejects non-integer amounts. If the rounding zeroes
    // out (e.g., last day of the period on a ₪5 sub), skip the refund.
    const totalMs = sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime();
    const remainingMs = sub.currentPeriodEnd.getTime() - now.getTime();
    const refundAmount = Math.round(sub.priceAtJoin * (remainingMs / totalMs));
    if (refundAmount <= 0) {
      await this.prisma.memberSubscription.update({
        where: { id: sub.id },
        data: { status: 'CANCELLED', cancelledAt: now },
      });
      return;
    }

    // Same business day in IL? CancelTrans is free (no commission) and
    // returns the full amount regardless of refundAmount — for a same-
    // day kick of a member who joined hours ago, this is the right call.
    // Otherwise (different day), zikoyAPI with the prorated amount.
    const isSameDay =
      sub.createdAt.toDateString() === now.toDateString();

    let refundOk = false;
    let failureReason: string | null = null;
    try {
      if (isSameDay) {
        const result = await this.hypService.cancelTransaction(sub.hypSubscriptionId);
        refundOk = result.ok;
        if (!refundOk) failureReason = `CancelTrans CCode=${result.ccode}`;
      } else {
        const result = await this.hypService.refundTransaction({
          transId: sub.hypSubscriptionId,
          amount: refundAmount,
        });
        refundOk = result.ok;
        if (!refundOk) failureReason = `zikoyAPI CCode=${result.ccode}`;
      }
    } catch (err) {
      failureReason = `Exception: ${(err as Error).message}`;
    }

    if (refundOk) {
      await this.prisma.memberSubscription.update({
        where: { id: sub.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          refundAmountOwed: null,
          refundOwedAt: null,
          refundFailureReason: null,
        },
      });
      // Ledger: reverse the original member charge's split. CancelTrans
      // (same-day) voids the FULL original charge; zikoyAPI returns the
      // prorated amount.
      await this.transactionsService.recordCharge({
        kind: 'REFUND',
        grossAmount: isSameDay ? Math.round(sub.priceAtJoin) : refundAmount,
        commissionBasisPoints: sub.community.owner?.plan?.commissionBasisPoints,
        communityId,
        ownerId: sub.community.ownerId,
        payerId: kickedUserId,
        memberSubscriptionId: sub.id,
        // hypTxnId left null — the original charge already owns that id
        // (it's @unique); reference the reversed charge via hypOrderId.
        hypOrderId: `refund-of-${sub.hypSubscriptionId}`,
      });
      this.logger.log(
        `Kick refund OK: sub=${sub.id} amount=₪${refundAmount} method=${isSameDay ? 'CancelTrans' : 'zikoyAPI'}`,
      );
    } else {
      // Stamp owed-refund fields; cron retries. Kick still proceeds.
      await this.prisma.memberSubscription.update({
        where: { id: sub.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          refundAmountOwed: refundAmount,
          refundOwedAt: now,
          refundFailureReason: failureReason,
        },
      });
      this.logger.warn(
        `Kick refund FAILED, owed: sub=${sub.id} amount=₪${refundAmount} reason=${failureReason}`,
      );
    }
  }

  // Owner-only earnings summary for the manage-page revenue card. Returns
  // the owner's commission rate (so the client can show gross vs. net of
  // the "cut from owner") plus ledger-derived lifetime figures the client
  // can't compute on its own: net earned to date (member charges minus
  // commission minus refunds) and total refunded back to members.
  async getCommunityEarnings(communityId: string, userId: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: {
        ownerId: true,
        owner: { select: { plan: { select: { commissionBasisPoints: true } } } },
      },
    });
    if (!community) {
      throw new NotFoundException('Community not found');
    }
    if (community.ownerId !== userId) {
      throw new ForbiddenException('Only the community owner can view earnings');
    }

    const [earnedAgg, refundAgg] = await Promise.all([
      // Sum of ownerAmount across all kinds: MEMBER_MONTHLY is positive,
      // REFUND is negative, OWNER_MONTHLY is 0 — so the sum is net earnings.
      this.prisma.transaction.aggregate({
        where: { communityId },
        _sum: { ownerAmount: true },
      }),
      // REFUND grossAmount is stored negative; abs() gives total refunded.
      this.prisma.transaction.aggregate({
        where: { communityId, kind: 'REFUND' },
        _sum: { grossAmount: true },
      }),
    ]);

    return {
      commissionBasisPoints: community.owner?.plan?.commissionBasisPoints ?? 500,
      earnedToDateNet: Math.round(earnedAgg._sum.ownerAmount ?? 0),
      totalRefunds: Math.round(Math.abs(refundAgg._sum.grossAmount ?? 0)),
    };
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

    // Owner entry is omitted when the owner deleted their account (Phase 5
    // Mission 4 wind-down) — community.owner becomes null via SetNull and
    // the OWNER role no longer has a person attached. Members still appear.
    const ownerEntry = community.owner
      ? {
          ...community.owner,
          joinedAt: community.createdAt,
          role: 'OWNER' as const,
          isOwner: true,
          isManager: false,
          isOnline: isOnline(community.owner.lastActiveAt, community.owner.showOnline),
        }
      : null;

    const memberEntries = memberships.map(m => ({
      ...m.user,
      joinedAt: m.joinedAt,
      role: m.role,
      isOwner: false,
      isManager: m.role === 'MANAGER',
      isOnline: isOnline(m.user.lastActiveAt, m.user.showOnline),
    }));

    return ownerEntry ? [ownerEntry, ...memberEntries] : memberEntries;
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
    // ownerId is NULL when the owner deleted their account (Phase 5 Mission 4
    // wind-down); they're no longer a member and can't appear on the
    // leaderboard. Drop them from the candidate set.
    const memberIds = new Set<string>(
      community.ownerId
        ? [community.ownerId, ...memberships.map(m => m.userId)]
        : memberships.map(m => m.userId),
    );

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
    // Skip rows with NULL author/user — these are from deleted accounts
    // (Phase 5 Mission 2 anonymization). Their engagement doesn't count
    // toward any live member's points.
    for (const row of postCounts) {
      if (row.authorId && memberIds.has(row.authorId)) {
        pointsMap.set(row.authorId, (pointsMap.get(row.authorId) ?? 0) + row._count._all * 5);
      }
    }

    const addUserPoints = (
      rows: Array<{ userId: string | null; _count: { _all: number } }>,
      multiplier: number,
    ) => {
      for (const row of rows) {
        if (row.userId && memberIds.has(row.userId)) {
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

    // Owner row omitted when the owner deleted their account (Phase 5
    // Mission 4 wind-down) — no person to attribute the OWNER role to.
    const ownerRow = community.owner
      ? [{
          id: community.owner.id,
          name: community.owner.name,
          role: 'OWNER' as const,
        }]
      : [];
    return [
      ...ownerRow,
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