import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../common/storage.service';
import { EmailService } from '../email/email.service';
import { HypService } from '../payments/hyp.service';
import { DunningService } from '../payments/dunning.service';
import { TransactionsService } from '../transactions/transactions.service';

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
    private hypService: HypService,
    private dunningService: DunningService,
    private transactionsService: TransactionsService,
  ) {}

  // Midnight Israel time. Owns the time-based transitions that used to
  // be lazy-flipped on read in CommunitiesService.findById, plus the
  // Phase 4 recurring SOFT charges. Order matters slightly — we apply
  // cancellations and price changes BEFORE running monthly charges so
  // a community cancelled today doesn't get charged today.
  @Cron('0 0 * * *', { timeZone: 'Asia/Jerusalem' })
  async handleDailyBillingTransitions() {
    this.logger.log('Running daily community billing transitions');
    await this.applyDueOwnerCancellations();
    await this.applyDuePriceChanges();
    await this.cleanupAbandonedDraftCommunities();
    await this.cleanupAbandonedPendingCheckouts();
    await this.sendPriceChangeReminders();
    await this.sendSuspensionReminders();
    await this.sendTrialEndingReminders();
    await this.applyMonthlyOwnerCharges();
    await this.applyMemberCancellationsAtPeriodEnd();
    await this.applyMonthlyMemberCharges();
    await this.retryOwedRefunds();
    await this.hardDeleteWoundDownCommunities();
  }

  // Phase 4 Mission 4.5 — at currentPeriodEnd, ends paid memberships
  // that the member requested to cancel earlier. Sets MemberSubscription
  // status=CANCELLED (kept as a historical row) and deletes the
  // CommunityMember row (removes access). Runs BEFORE applyMonthly­
  // MemberCharges so a sub due to cancel today doesn't get charged
  // today.
  private async applyMemberCancellationsAtPeriodEnd() {
    const now = new Date();
    const due = await this.prisma.memberSubscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'PAST_DUE'] },
        cancelledAt: { not: null },
        currentPeriodEnd: { lte: now },
      },
      select: { id: true, userId: true, communityId: true },
    });

    if (due.length === 0) return;
    this.logger.log(`Applying ${due.length} due member cancellation(s) at period end`);

    for (const sub of due) {
      try {
        await this.prisma.$transaction([
          this.prisma.memberSubscription.update({
            where: { id: sub.id },
            data: { status: 'CANCELLED' },
          }),
          this.prisma.communityMember.deleteMany({
            where: { userId: sub.userId, communityId: sub.communityId },
          }),
        ]);
      } catch (err) {
        this.logger.error(
          `Failed to apply period-end cancellation for sub ${sub.id}: ${(err as Error).message}`,
        );
      }
    }
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

  // Phase 4 Mission 4.1a — 3-day pre-trial-end reminder for owners.
  // The pricing-page checkout copy already promises this email; this
  // pass delivers it. Same once-only pattern as the price-change and
  // suspension reminders (Community.trialEndReminderSentAt). 2-day
  // window (now+2d to now+4d) so a missed cron day still fires.
  // Only ACTIVE communities with no cancellation pending — there's no
  // point reminding about a charge that won't happen.
  private async sendTrialEndingReminders() {
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() + 2);
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + 4);

    const due = await this.prisma.community.findMany({
      where: {
        subscriptionStatus: 'ACTIVE',
        subscriptionCancelledAt: null,
        nextBillingDate: { gte: windowStart, lte: windowEnd },
        trialEndReminderSentAt: null,
      },
      select: {
        id: true,
        name: true,
        nextBillingDate: true,
        owner: {
          select: {
            email: true,
            name: true,
            plan: { select: { monthlyPriceILS: true } },
          },
        },
      },
    });

    for (const c of due) {
      if (!c.nextBillingDate || !c.owner?.email || !c.owner.plan?.monthlyPriceILS) continue;
      try {
        await this.emailService.sendTrialEndingReminderEmail(
          c.owner.email,
          c.owner.name ?? c.owner.email,
          c.name,
          c.owner.plan.monthlyPriceILS,
          formatHebrewDate(c.nextBillingDate),
        );
      } catch (err) {
        this.logger.warn(
          `Trial-ending reminder email failed (community=${c.id}): ${(err as Error).message}`,
        );
      }
      try {
        await this.prisma.community.update({
          where: { id: c.id },
          data: { trialEndReminderSentAt: now },
        });
      } catch (err) {
        this.logger.error(`Failed to stamp trialEndReminderSentAt for ${c.id}`, err as Error);
      }
    }

    if (due.length > 0) {
      this.logger.log(`Sent trial-ending reminders for ${due.length} community/communities`);
    }
  }

  // Phase 4 — recurring SOFT charges for owner-billed communities. Picks
  // up communities whose nextBillingDate has rolled over and runs
  // hypService.softCharge() with the owner's plan price. Success advances
  // the billing cycle by 1 month; failure suspends the community
  // immediately (per the simple "suspend-on-first-failure" design we
  // landed on — no auto-retry, owner re-binds card to reactivate via the
  // existing manage-card flow). Communities without paymentMethodId,
  // expiry, or token are skipped (logged) — they should never appear
  // here post-Phase-3.3 restructure, but defensive.
  private async applyMonthlyOwnerCharges() {
    const now = new Date();
    const due = await this.prisma.community.findMany({
      where: {
        subscriptionStatus: 'ACTIVE',
        subscriptionCancelledAt: null,
        nextBillingDate: { lte: now, not: null },
        paymentMethodId: { not: null },
        // Wind-down communities (owner deleted account, Phase 5 Mission 4)
        // have ownerId=NULL after the cascade — exclude defensively. The
        // subscriptionCancelledAt filter above already catches them
        // (wind-down sets it), but the not-null assertion keeps TS happy
        // and documents intent.
        ownerId: { not: null },
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        nextBillingDate: true,
        paymentMethod: {
          select: {
            hypPaymentMethodId: true,
            cardExpMonth: true,
            cardExpYear: true,
            cardLastFour: true,
          },
        },
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            plan: { select: { monthlyPriceILS: true } },
          },
        },
      },
    });

    for (const c of due) {
      await this.processOwnerCharge(c, now);
    }

    if (due.length > 0) {
      this.logger.log(`Processed ${due.length} owner monthly charge(s)`);
    }
  }

  // One iteration of the SOFT charge loop. Extracted so per-row failures
  // (validation, network, HYP rejection) don't break the whole batch.
  private async processOwnerCharge(
    c: {
      id: string;
      name: string;
      ownerId: string | null;
      nextBillingDate: Date | null;
      paymentMethod: {
        hypPaymentMethodId: string | null;
        cardExpMonth: number | null;
        cardExpYear: number | null;
        cardLastFour: string;
      } | null;
      owner: {
        id: string;
        email: string;
        name: string | null;
        plan: { monthlyPriceILS: number } | null;
      } | null;
    },
    now: Date,
  ) {
    // Defensive validations — these should never trip post-Phase 3.3.
    // ownerId NULL would mean the owner deleted their account (Phase 5
    // Mission 4 wind-down) and we shouldn't charge; the cron's findMany
    // filter already excludes these but assert here too for type safety.
    if (!c.ownerId) {
      this.logger.warn(`Community ${c.id}: ownerId NULL (wind-down) — skipping charge`);
      return;
    }
    if (
      !c.paymentMethod?.hypPaymentMethodId
      || c.paymentMethod.cardExpMonth == null
      || c.paymentMethod.cardExpYear == null
    ) {
      this.logger.error(`Community ${c.id}: missing token/expiry; skipping`);
      return;
    }
    if (!c.owner?.plan?.monthlyPriceILS) {
      this.logger.error(`Community ${c.id}: owner missing plan; skipping`);
      return;
    }
    if (!c.nextBillingDate) {
      this.logger.error(`Community ${c.id}: missing nextBillingDate; skipping`);
      return;
    }

    // Card expiry pre-check. HYP will reject anyway, but failing here gives
    // a clean log message and skips the network round-trip.
    const expYM = c.paymentMethod.cardExpYear * 100 + c.paymentMethod.cardExpMonth;
    const nowYM = now.getFullYear() * 100 + (now.getMonth() + 1);
    if (expYM < nowYM) {
      this.logger.warn(
        `Community ${c.id}: card expired ${c.paymentMethod.cardExpMonth}/${c.paymentMethod.cardExpYear}, suspending`,
      );
      await this.handleChargeFailure(c, 'CARD_EXPIRED', now, '36');
      return;
    }

    // Attempt the charge. Network errors bubble out as a thrown
    // InternalServerErrorException from HypService — we catch and log;
    // the community stays ACTIVE so next cron pass retries.
    let result: Awaited<ReturnType<HypService['softCharge']>>;
    try {
      result = await this.hypService.softCharge({
        token: c.paymentMethod.hypPaymentMethodId,
        amount: c.owner.plan.monthlyPriceILS,
        cardExpMonth: c.paymentMethod.cardExpMonth,
        cardExpYear: c.paymentMethod.cardExpYear,
        clientName: c.owner.name ?? c.owner.email,
        email: c.owner.email,
        order: `owner-monthly-${c.id}-${Date.now()}`,
        info: `Monthly charge for community "${c.name}"`,
      });
    } catch (err) {
      this.logger.error(
        `Community ${c.id}: SOFT charge threw (network/gateway?), leaving ACTIVE for next pass: ${(err as Error).message}`,
      );
      return;
    }

    if (result.ok) {
      // Success — advance the billing cycle by 1 month.
      const prevBillingDate = c.nextBillingDate;
      const nextBillingDate = new Date(prevBillingDate);
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      await this.prisma.community.update({
        where: { id: c.id },
        data: {
          nextBillingDate,
          currentPeriodStart: prevBillingDate,
          currentPeriodEnd: nextBillingDate,
        },
      });
      // Ledger: owner platform fee → 100% Withly revenue (no split).
      await this.transactionsService.recordCharge({
        kind: 'OWNER_MONTHLY',
        grossAmount: c.owner.plan.monthlyPriceILS,
        communityId: c.id,
        ownerId: c.ownerId,
        payerId: c.ownerId,
        hypTxnId: result.body.Id ?? null,
        hypOrderId: result.body.Order ?? null,
      });
      this.logger.log(
        `Charged owner ${c.owner.email} ₪${c.owner.plan.monthlyPriceILS} for community ${c.id} ` +
        `(${c.name}): hypId=${result.body.Id}, next=${nextBillingDate.toISOString()}`,
      );
    } else {
      await this.handleChargeFailure(c, `CCode=${result.ccode}`, now, result.ccode);
    }
  }

  // Common failure path: flip to SUSPENDED + bell-icon for owner + email
  // for owner + suspended notification for all members.
  private async handleChargeFailure(
    c: {
      id: string;
      name: string;
      // Caller (processOwnerCharge) already asserts non-null before calling,
      // but the type stays nullable to match the parent's narrower-than-
      // Prisma-knows shape. Treated as the actor on member notifications.
      ownerId: string | null;
      owner: {
        email: string;
        name: string | null;
        plan: { monthlyPriceILS: number } | null;
      } | null;
    },
    reason: string,
    now: Date,
    ccode?: string | null,
  ) {
    await this.prisma.community.update({
      where: { id: c.id },
      data: { subscriptionStatus: 'SUSPENDED', suspendedAt: now },
    });

    // Owner notification (bell + email). Fire-and-forget — DB state is
    // already correct; comm failures shouldn't roll back the suspension.
    // Skipped when ownerId is null (wind-down case — owner already gone,
    // no recipient).
    if (c.ownerId) {
      await this.notificationsService.notifyPaymentFailed(c.ownerId, c.id).catch(() => {});
    }
    if (c.owner?.email && c.owner.plan?.monthlyPriceILS && c.ownerId) {
      // Phase 6.4 — generate (or reuse) a dunning link before the email
      // so the "pay now" CTA can render. On HYP failures here we still
      // send the email without the link so the user at least learns the
      // charge failed; they can update card the legacy way.
      let dunningUrl: string | null = null;
      try {
        dunningUrl = await this.dunningService.createOrReuseDunningLink({
          userId: c.ownerId,
          user: { email: c.owner.email, name: c.owner.name },
          communityId: c.id,
          communityName: c.name,
          kind: 'OWNER_MONTHLY',
          amount: c.owner.plan.monthlyPriceILS,
        });
      } catch (err) {
        this.logger.warn(
          `Dunning link generation failed for ${c.id} (email will omit pay-now CTA): ${(err as Error).message}`,
        );
      }
      try {
        await this.emailService.sendPaymentFailedEmail(
          c.owner.email,
          c.owner.name ?? c.owner.email,
          c.name,
          c.id,
          c.owner.plan.monthlyPriceILS,
          ccode,
          dunningUrl,
        );
      } catch (err) {
        this.logger.warn(
          `Payment-failed email error for ${c.id}: ${(err as Error).message}`,
        );
      }
    }

    // Members get the existing COMMUNITY_SUSPENDED fan-out so their
    // access disappears with context (matches the manual-cancel path).
    await this.notifyMembersSuspended(c.id, c.ownerId).catch(() => {});

    this.logger.warn(`Suspended community ${c.id} due to charge failure (${reason})`);
  }

  // Phase 4 Mission 4 — recurring SOFT charges for paying members. Picks
  // up MemberSubscription rows whose nextBillingDate has rolled over and
  // runs softCharge against the member's stored token for priceAtJoin.
  // Success advances the period by 1 month; failure flips the sub to
  // PAST_DUE + emails/notifies the member. Unlike the owner-side path,
  // this does NOT suspend the whole community — just the one membership.
  // Community.subscriptionStatus and other members are unaffected.
  private async applyMonthlyMemberCharges() {
    const now = new Date();
    const due = await this.prisma.memberSubscription.findMany({
      where: {
        status: 'ACTIVE',
        nextBillingDate: { lte: now },
        paymentMethodId: { not: null },
        // Skip subs whose community is itself suspended — no point
        // charging if access is already gone. Cron will retry once the
        // community is reactivated (Mission 5).
        community: { subscriptionStatus: 'ACTIVE' },
      },
      select: {
        id: true,
        userId: true,
        communityId: true,
        priceAtJoin: true,
        nextBillingDate: true,
        paymentMethod: {
          select: {
            hypPaymentMethodId: true,
            cardExpMonth: true,
            cardExpYear: true,
            cardLastFour: true,
          },
        },
        community: {
          select: {
            name: true,
            ownerId: true,
            owner: { select: { plan: { select: { commissionBasisPoints: true } } } },
          },
        },
        user: { select: { email: true, name: true } },
      },
    });

    for (const sub of due) {
      await this.processMemberCharge(sub, now);
    }

    if (due.length > 0) {
      this.logger.log(`Processed ${due.length} member monthly charge(s)`);
    }
  }

  // Phase 5 Mission 5 — retry refunds that failed at kick-time. When
  // removeMember can't reach HYP (network blip, declined, whatever)
  // we still complete the kick and stamp refundAmountOwed on the sub;
  // this pass picks them up nightly and retries. CancelTrans is only
  // valid same-day so retries always use zikoyAPI. Best-effort: HYP
  // could keep rejecting indefinitely (e.g. original transaction void),
  // we don't escalate — just log and try again tomorrow.
  private async retryOwedRefunds() {
    const owed = await this.prisma.memberSubscription.findMany({
      where: { refundAmountOwed: { not: null } },
      select: {
        id: true,
        userId: true,
        communityId: true,
        hypSubscriptionId: true,
        refundAmountOwed: true,
        refundOwedAt: true,
        community: {
          select: {
            ownerId: true,
            owner: { select: { plan: { select: { commissionBasisPoints: true } } } },
          },
        },
      },
    });
    if (owed.length === 0) return;
    this.logger.log(`Retrying ${owed.length} owed refund(s)`);

    for (const sub of owed) {
      const amount = sub.refundAmountOwed!; // narrowed by where clause
      try {
        const result = await this.hypService.refundTransaction({
          transId: sub.hypSubscriptionId,
          amount,
        });
        if (result.ok) {
          await this.prisma.memberSubscription.update({
            where: { id: sub.id },
            data: {
              refundAmountOwed: null,
              refundOwedAt: null,
              refundFailureReason: null,
            },
          });
          // Ledger: reverse the original member charge's split (prorated).
          await this.transactionsService.recordCharge({
            kind: 'REFUND',
            grossAmount: amount,
            commissionBasisPoints: sub.community.owner?.plan?.commissionBasisPoints,
            communityId: sub.communityId,
            ownerId: sub.community.ownerId,
            payerId: sub.userId,
            memberSubscriptionId: sub.id,
            hypOrderId: `refund-of-${sub.hypSubscriptionId}`,
          });
          this.logger.log(`Owed refund settled: sub=${sub.id} amount=₪${amount}`);
        } else {
          await this.prisma.memberSubscription.update({
            where: { id: sub.id },
            data: { refundFailureReason: `Retry zikoyAPI CCode=${result.ccode}` },
          });
          this.logger.warn(`Owed refund retry FAILED: sub=${sub.id} CCode=${result.ccode}`);
        }
      } catch (err) {
        this.logger.error(
          `Owed refund retry exception: sub=${sub.id} ${(err as Error).message}`,
        );
      }
    }
  }

  // Phase 5 Mission 4 — terminal cleanup for communities whose owner
  // deleted their account. Runs LAST in the daily pass so:
  //   1. applyDueOwnerCancellations has already flipped the community
  //      to SUSPENDED at its grace-end date
  //   2. all per-member cancellations + charge attempts have settled
  // We pick up communities with both ownerDeletedAt set AND status
  // SUSPENDED, collect their R2 file URLs (community-owned + content-
  // owned: posts, courses), delete from R2 best-effort, then
  // prisma.community.delete which cascades the rest (posts, comments,
  // events, courses, member rows, etc.).
  private async hardDeleteWoundDownCommunities() {
    const due = await this.prisma.community.findMany({
      where: {
        ownerDeletedAt: { not: null },
        subscriptionStatus: 'SUSPENDED',
      },
      select: {
        id: true,
        name: true,
        logo: true,
        image: true,
        galleryImages: true,
        galleryVideos: true,
        posts: { select: { images: true, videos: true } },
        courses: {
          select: {
            image: true,
            chapters: {
              select: {
                lessons: {
                  select: { videoUrl: true, images: true, files: true },
                },
              },
            },
          },
        },
      },
    });

    if (due.length === 0) return;
    this.logger.log(`Hard-deleting ${due.length} wound-down community/communities`);

    for (const c of due) {
      // Build flat list of R2 URLs to delete. The Lesson.files column is
      // Json[]; each entry may be { url: string, ... } — best-effort
      // extraction. Anything we can't recognize is left for manual cleanup.
      const urls: string[] = [];
      if (c.logo) urls.push(c.logo);
      if (c.image) urls.push(c.image);
      urls.push(...c.galleryImages, ...c.galleryVideos);
      for (const p of c.posts) {
        urls.push(...p.images, ...p.videos);
      }
      for (const course of c.courses) {
        if (course.image) urls.push(course.image);
        for (const ch of course.chapters) {
          for (const l of ch.lessons) {
            if (l.videoUrl) urls.push(l.videoUrl);
            urls.push(...l.images);
            for (const f of l.files as unknown as Array<{ url?: string } | string>) {
              if (typeof f === 'string') urls.push(f);
              else if (f && typeof f.url === 'string') urls.push(f.url);
            }
          }
        }
      }

      const r2Results = await Promise.allSettled(
        urls.map((u) => this.storageService.deleteFile(u)),
      );
      const r2Failed = r2Results.filter((r) => r.status === 'rejected').length;
      if (r2Failed > 0) {
        this.logger.warn(
          `Community ${c.id} hard-delete: ${r2Failed}/${urls.length} R2 deletes failed (continuing with DB delete)`,
        );
      }

      try {
        await this.prisma.community.delete({ where: { id: c.id } });
        this.logger.log(`Hard-deleted community ${c.id} (${c.name}) — ${urls.length} R2 files attempted`);
      } catch (err) {
        this.logger.error(
          `Hard-delete failed for community ${c.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  // One iteration of the member-side SOFT loop. Same shape as the owner
  // version but operates on MemberSubscription rows and PAST_DUEs on
  // failure instead of SUSPENDing the community.
  private async processMemberCharge(
    sub: {
      id: string;
      userId: string;
      communityId: string;
      priceAtJoin: number;
      nextBillingDate: Date;
      paymentMethod: {
        hypPaymentMethodId: string | null;
        cardExpMonth: number | null;
        cardExpYear: number | null;
        cardLastFour: string;
      } | null;
      community: {
        name: string;
        ownerId: string | null;
        owner: { plan: { commissionBasisPoints: number } | null } | null;
      };
      user: { email: string; name: string | null };
    },
    now: Date,
  ) {
    if (
      !sub.paymentMethod?.hypPaymentMethodId
      || sub.paymentMethod.cardExpMonth == null
      || sub.paymentMethod.cardExpYear == null
    ) {
      this.logger.error(`MemberSubscription ${sub.id}: missing token/expiry; skipping`);
      return;
    }

    const expYM = sub.paymentMethod.cardExpYear * 100 + sub.paymentMethod.cardExpMonth;
    const nowYM = now.getFullYear() * 100 + (now.getMonth() + 1);
    if (expYM < nowYM) {
      this.logger.warn(
        `MemberSubscription ${sub.id}: card expired ${sub.paymentMethod.cardExpMonth}/${sub.paymentMethod.cardExpYear}, PAST_DUE`,
      );
      await this.handleMemberChargeFailure(sub, 'CARD_EXPIRED', now, '36');
      return;
    }

    const amount = Math.round(sub.priceAtJoin);
    let result: Awaited<ReturnType<HypService['softCharge']>>;
    try {
      result = await this.hypService.softCharge({
        token: sub.paymentMethod.hypPaymentMethodId,
        amount,
        cardExpMonth: sub.paymentMethod.cardExpMonth,
        cardExpYear: sub.paymentMethod.cardExpYear,
        clientName: sub.user.name ?? sub.user.email,
        email: sub.user.email,
        order: `member-monthly-${sub.id}-${Date.now()}`,
        info: `Monthly charge for membership in "${sub.community.name}"`,
      });
    } catch (err) {
      this.logger.error(
        `MemberSubscription ${sub.id}: SOFT charge threw, leaving ACTIVE for next pass: ${(err as Error).message}`,
      );
      return;
    }

    if (result.ok) {
      const prevBillingDate = sub.nextBillingDate;
      const nextBillingDate = new Date(prevBillingDate);
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      await this.prisma.memberSubscription.update({
        where: { id: sub.id },
        data: {
          nextBillingDate,
          currentPeriodStart: prevBillingDate,
          currentPeriodEnd: nextBillingDate,
        },
      });
      // Ledger: member pays full price; Withly keeps commission, owner
      // earns the remainder (split derived in recordCharge).
      await this.transactionsService.recordCharge({
        kind: 'MEMBER_MONTHLY',
        grossAmount: amount,
        commissionBasisPoints: sub.community.owner?.plan?.commissionBasisPoints,
        communityId: sub.communityId,
        ownerId: sub.community.ownerId,
        payerId: sub.userId,
        memberSubscriptionId: sub.id,
        hypTxnId: result.body.Id ?? null,
        hypOrderId: result.body.Order ?? null,
      });
      this.logger.log(
        `Charged member ${sub.user.email} ₪${amount} for membership ${sub.id} ` +
        `(community "${sub.community.name}"): hypId=${result.body.Id}, next=${nextBillingDate.toISOString()}`,
      );
    } else {
      await this.handleMemberChargeFailure(sub, `CCode=${result.ccode}`, now, result.ccode);
    }
  }

  // Member-side failure path: flip MemberSubscription to PAST_DUE +
  // bell-icon + email. Community stays ACTIVE — only this member is
  // affected. Member can rejoin (or reactivate via a future Mission)
  // by going through the payment update flow.
  private async handleMemberChargeFailure(
    sub: {
      id: string;
      userId: string;
      communityId: string;
      priceAtJoin: number;
      community: { name: string };
      user: { email: string; name: string | null };
    },
    reason: string,
    _now: Date,
    ccode?: string | null,
  ) {
    await this.prisma.memberSubscription.update({
      where: { id: sub.id },
      data: { status: 'PAST_DUE' },
    });

    await this.notificationsService.notifyPaymentFailed(sub.userId, sub.communityId).catch(() => {});
    // Phase 6.4 — dunning link generation; same fail-soft pattern as owner.
    let dunningUrl: string | null = null;
    try {
      dunningUrl = await this.dunningService.createOrReuseDunningLink({
        userId: sub.userId,
        user: { email: sub.user.email, name: sub.user.name },
        communityId: sub.communityId,
        communityName: sub.community.name,
        kind: 'MEMBER_MONTHLY',
        amount: sub.priceAtJoin,
      });
    } catch (err) {
      this.logger.warn(
        `Member dunning link generation failed for sub ${sub.id}: ${(err as Error).message}`,
      );
    }
    try {
      await this.emailService.sendMemberPaymentFailedEmail(
        sub.user.email,
        sub.user.name ?? sub.user.email,
        sub.community.name,
        Math.round(sub.priceAtJoin),
        ccode,
        dunningUrl,
      );
    } catch (err) {
      this.logger.warn(
        `Member payment-failed email error for sub ${sub.id}: ${(err as Error).message}`,
      );
    }

    this.logger.warn(`MemberSubscription ${sub.id} → PAST_DUE (${reason})`);
  }

  private async notifyMembersSuspended(communityId: string, ownerId: string | null) {
    const memberships = await this.prisma.communityMember.findMany({
      where: { communityId },
      select: { userId: true },
    });
    // ownerId is null when the owner deleted their account (Phase 5 Mission
    // 4 wind-down) — no "owner" filter to apply, and the notification's
    // actorId carries null (system-suspended). notifyCommunitySuspended
    // accepts the null actor; UI renders without an actor attribution.
    await Promise.all(
      memberships
        .filter(m => ownerId == null || m.userId !== ownerId)
        .map(m =>
          this.notificationsService
            .notifyCommunitySuspended(m.userId, ownerId, communityId)
            .catch(() => {}),
        ),
    );
  }
}
