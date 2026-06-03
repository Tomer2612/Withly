import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../common/storage.service';
import { EmailService } from '../email/email.service';

// Hebrew dd.M.yyyy format — matches the format used in lifecycle email
// triggers in CommunitiesService. Kept local here to avoid a cross-module
// import for a one-liner.
function formatHebrewDate(d: Date): string {
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

@Injectable()
export class CommunityBillingCronService {
  private readonly logger = new Logger(CommunityBillingCronService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private storageService: StorageService,
    private emailService: EmailService,
  ) {}

  // Midnight Israel time. Owns the two time-based transitions that used to
  // be lazy-flipped on read in CommunitiesService.findById. HYP webhook still
  // owns the SUSPENDED → ACTIVE direction; this is only the forward edges.
  @Cron('0 0 * * *', { timeZone: 'Asia/Jerusalem' })
  async handleDailyBillingTransitions() {
    this.logger.log('Running daily community billing transitions');
    await this.applyDueOwnerCancellations();
    await this.applyDuePriceChanges();
    await this.cleanupAbandonedDraftCommunities();
    await this.cleanupAbandonedPendingCheckouts();
    await this.sendPriceChangeReminders();
    await this.sendSuspensionReminders();
  }

  private async applyDueOwnerCancellations() {
    const now = new Date();
    const due = await this.prisma.community.findMany({
      where: {
        subscriptionStatus: 'ACTIVE',
        subscriptionCancelledAt: { lte: now, not: null },
      },
      select: { id: true, ownerId: true },
    });

    for (const c of due) {
      try {
        await this.prisma.community.update({
          where: { id: c.id },
          data: { subscriptionStatus: 'SUSPENDED', suspendedAt: now },
        });
        await this.notifyMembersSuspended(c.id, c.ownerId);
      } catch (err) {
        this.logger.error(`Failed to suspend community ${c.id}`, err as Error);
      }
    }

    if (due.length > 0) {
      this.logger.log(`Suspended ${due.length} community/communities past cancellation date`);
    }
  }

  private async applyDuePriceChanges() {
    const now = new Date();
    const due = await this.prisma.community.findMany({
      where: {
        pendingPrice: { not: null },
        pendingPriceEffectiveAt: { lte: now, not: null },
      },
      select: { id: true, pendingPrice: true },
    });

    for (const c of due) {
      try {
        await this.prisma.community.update({
          where: { id: c.id },
          data: {
            price: c.pendingPrice,
            pendingPrice: null,
            pendingPriceEffectiveAt: null,
            priceChangeAnnouncedAt: null,
          },
        });
      } catch (err) {
        this.logger.error(`Failed to apply price change for community ${c.id}`, err as Error);
      }
    }

    if (due.length > 0) {
      this.logger.log(`Applied ${due.length} pending price change(s)`);
    }
  }

  // Pricing checkout (Phase 3.3) creates the community as DRAFT *before*
  // opening the HYP iframe so the iframe's Order field can carry the
  // communityId. If the user abandons the iframe, the DRAFT row persists
  // forever with paymentMethodId=null. After 24h we treat it as abandoned
  // and remove it — there's no "resume checkout" UI surfacing these to
  // the user, so a longer grace just keeps dead rows around. Published
  // communities (status != DRAFT) and drafts that already have a card
  // bound are never touched.
  private async cleanupAbandonedDraftCommunities() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const orphans = await this.prisma.community.findMany({
      where: {
        status: 'DRAFT',
        paymentMethodId: null,
        createdAt: { lt: cutoff },
      },
      select: { id: true },
    });

    for (const c of orphans) {
      try {
        await this.prisma.community.delete({ where: { id: c.id } });
      } catch (err) {
        this.logger.error(`Failed to delete abandoned draft community ${c.id}`, err as Error);
      }
    }

    if (orphans.length > 0) {
      this.logger.log(`Deleted ${orphans.length} abandoned draft community/communities`);
    }
  }

  // Pricing-checkout pending rows (Phase 3.3): created when the user
  // submits the new-community form, deleted on tokenize success. Anything
  // older than 24h is an abandoned checkout — sweep the row and any R2
  // files it referenced. Per-file R2 errors are logged but don't block
  // the row delete, since DB consistency matters more than perfect R2
  // cleanup (orphan R2 files can be reconciled later; orphan DB rows
  // pollute the pending-resume query).
  private async cleanupAbandonedPendingCheckouts() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const orphans = await this.prisma.pendingCommunityCreation.findMany({
      where: { createdAt: { lt: cutoff } },
      select: {
        id: true,
        image: true,
        logo: true,
        galleryImages: true,
        galleryVideos: true,
      },
    });

    for (const p of orphans) {
      const urls = [
        p.image,
        p.logo,
        ...(p.galleryImages ?? []),
        ...(p.galleryVideos ?? []),
      ].filter((u): u is string => !!u);

      for (const url of urls) {
        try {
          await this.storageService.deleteFile(url);
        } catch (err) {
          this.logger.warn(
            `R2 delete failed during pending-checkout cleanup (pendingId=${p.id} url=${url}): ${(err as Error).message}`,
          );
        }
      }

      try {
        await this.prisma.pendingCommunityCreation.delete({ where: { id: p.id } });
      } catch (err) {
        this.logger.error(`Failed to delete abandoned pending checkout ${p.id}`, err as Error);
      }
    }

    if (orphans.length > 0) {
      this.logger.log(`Deleted ${orphans.length} abandoned pending checkout(s)`);
    }
  }

  // 7-day reminder before a pending price change takes effect. Fires
  // once per scheduled price change (tracked via
  // Community.priceChangeReminderSentAt). Owner sets a new price →
  // announcePriceChange clears the timestamp → cron sends the reminder
  // when we're inside the [eff - 8d, eff - 6d] window.
  // 2-day window (not exactly 7d) is intentional: if the cron skips a
  // day (server restart, deploy, etc.) the reminder still fires on the
  // next run instead of being missed entirely.
  private async sendPriceChangeReminders() {
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() + 6);
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + 8);

    const due = await this.prisma.community.findMany({
      where: {
        pendingPrice: { not: null },
        pendingPriceEffectiveAt: { gte: windowStart, lte: windowEnd },
        priceChangeReminderSentAt: null,
      },
      select: {
        id: true,
        name: true,
        pendingPrice: true,
        pendingPriceEffectiveAt: true,
      },
    });

    for (const c of due) {
      if (c.pendingPrice == null || !c.pendingPriceEffectiveAt) continue;
      const members = await this.prisma.communityMember.findMany({
        where: { communityId: c.id },
        select: { user: { select: { email: true, name: true } } },
      });
      const dateStr = formatHebrewDate(c.pendingPriceEffectiveAt);
      for (const m of members) {
        if (!m.user?.email) continue;
        try {
          await this.emailService.sendPriceChangeReminderEmail(
            m.user.email,
            m.user.name ?? m.user.email,
            c.name,
            c.pendingPrice,
            dateStr,
          );
        } catch (err) {
          this.logger.warn(
            `Price-change reminder email failed (community=${c.id} email=${m.user.email}): ${(err as Error).message}`,
          );
        }
      }
      try {
        await this.prisma.community.update({
          where: { id: c.id },
          data: { priceChangeReminderSentAt: now },
        });
      } catch (err) {
        this.logger.error(`Failed to stamp priceChangeReminderSentAt for ${c.id}`, err as Error);
      }
    }

    if (due.length > 0) {
      this.logger.log(`Sent price-change reminders for ${due.length} community/communities`);
    }
  }

  // 7-day reminder before an owner-scheduled subscription cancellation
  // takes effect (community will be SUSPENDED on that date). Goes to the
  // owner only — members get the existing scheduled-for-suspension
  // popup + notification at announce time. Same dedup pattern as the
  // price-change reminder (suspensionReminderSentAt + 2-day window).
  private async sendSuspensionReminders() {
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() + 6);
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + 8);

    const due = await this.prisma.community.findMany({
      where: {
        subscriptionCancelledAt: { gte: windowStart, lte: windowEnd },
        suspensionReminderSentAt: null,
        subscriptionStatus: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        subscriptionCancelledAt: true,
        owner: { select: { email: true, name: true } },
      },
    });

    for (const c of due) {
      if (!c.subscriptionCancelledAt || !c.owner?.email) continue;
      try {
        await this.emailService.sendSuspensionReminderEmail(
          c.owner.email,
          c.owner.name ?? c.owner.email,
          c.name,
          c.id,
          formatHebrewDate(c.subscriptionCancelledAt),
        );
      } catch (err) {
        this.logger.warn(
          `Suspension reminder email failed (community=${c.id}): ${(err as Error).message}`,
        );
      }
      try {
        await this.prisma.community.update({
          where: { id: c.id },
          data: { suspensionReminderSentAt: now },
        });
      } catch (err) {
        this.logger.error(`Failed to stamp suspensionReminderSentAt for ${c.id}`, err as Error);
      }
    }

    if (due.length > 0) {
      this.logger.log(`Sent suspension reminders for ${due.length} community/communities`);
    }
  }

  private async notifyMembersSuspended(communityId: string, ownerId: string) {
    const memberships = await this.prisma.communityMember.findMany({
      where: { communityId },
      select: { userId: true },
    });
    await Promise.all(
      memberships
        .filter(m => m.userId !== ownerId)
        .map(m =>
          this.notificationsService
            .notifyCommunitySuspended(m.userId, ownerId, communityId)
            .catch(() => {}),
        ),
    );
  }
}
