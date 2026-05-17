import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommunityBillingCronService {
  private readonly logger = new Logger(CommunityBillingCronService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // Midnight Israel time. Owns the two time-based transitions that used to
  // be lazy-flipped on read in CommunitiesService.findById. HYP webhook still
  // owns the SUSPENDED → ACTIVE direction; this is only the forward edges.
  @Cron('0 0 * * *', { timeZone: 'Asia/Jerusalem' })
  async handleDailyBillingTransitions() {
    this.logger.log('Running daily community billing transitions');
    await this.applyDueOwnerCancellations();
    await this.applyDuePriceChanges();
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
