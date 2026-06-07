import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DunningKind } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { HypService } from './hyp.service';

// Phase 6.4 — outgoing dunning links + callback fulfillment.
//
// Failure flow: cron's SOFT charge fails (owner monthly or member monthly)
// → handleChargeFailure / handleMemberChargeFailure calls
// createOrReuseDunningLink() to get a HYP-hosted pay URL → URL goes in the
// failure email + bell notification.
//
// User clicks → HYP page → enters card → HYP redirects to /payments/
// payment-success with our Order param echoed back. The existing
// paymentSuccess dispatcher matches the tokenize-dunning- prefix and calls
// findByOrderId() then routes to the right recovery (owner vs member).
@Injectable()
export class DunningService {
  private readonly logger = new Logger(DunningService.name);

  // 7-day cap per spec. Past this, the failure handler stops reusing the
  // row and generates a fresh one on the next cron failure.
  private static readonly TTL_MS = 7 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hypService: HypService,
  ) {}

  // Returns a HYP-hosted pay-page URL for the user to click. If a fresh
  // (unfulfilled + unexpired) record already exists for this
  // (user, community, kind) bucket, reuses it — satisfies the one-active-
  // link rule from the brief. Otherwise creates a new record + Order id.
  async createOrReuseDunningLink({
    userId,
    user,
    communityId,
    communityName,
    kind,
    amount,
  }: {
    userId: string;
    user: { email: string; name: string | null };
    communityId: string;
    communityName: string;
    kind: DunningKind;
    amount: number;
  }): Promise<string> {
    const existing = await this.prisma.paymentDunningRequest.findFirst({
      where: {
        userId,
        communityId,
        kind,
        fulfilledAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    let orderId: string;
    let payAmount: number;
    if (existing) {
      orderId = existing.hypOrderId;
      payAmount = existing.amount;
    } else {
      orderId = `tokenize-dunning-${randomUUID()}`;
      payAmount = amount;
      await this.prisma.paymentDunningRequest.create({
        data: {
          userId,
          communityId,
          kind,
          amount,
          hypOrderId: orderId,
          expiresAt: new Date(Date.now() + DunningService.TTL_MS),
        },
      });
    }

    // J5=J2 with showAmount=true → the HYP page tokenizes the card AND
    // displays the dunning amount, so the user understands they're about
    // to be charged. The actual SOFT charge runs in the callback against
    // the fresh token, matching the paid-member-join pattern.
    return this.hypService.signPayment({
      amount: payAmount,
      clientName: user.name ?? user.email,
      email: user.email,
      order: orderId,
      info:
        kind === 'OWNER_MONTHLY'
          ? `חידוש מנוי קהילה: ${communityName}`
          : `חידוש חברות בקהילה: ${communityName}`,
      j5: 'J2',
      showAmount: true,
    });
  }

  // Look up the dunning record by the Order field HYP echoes back on the
  // redirect callback. Caller (payments.controller dispatcher) then routes
  // to the right recovery path based on `kind`.
  async findByOrderId(orderId: string) {
    return this.prisma.paymentDunningRequest.findUnique({
      where: { hypOrderId: orderId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        community: {
          select: { id: true, name: true, ownerId: true, paymentMethodId: true },
        },
      },
    });
  }

  // Mark fulfilled after token + SOFT both succeeded + state recovery
  // applied. hypTxnId is the SOFT charge's transaction id (the same one
  // we'd use for a future refund via zikoyAPI).
  async markFulfilled(dunningId: string, hypTxnId: string) {
    return this.prisma.paymentDunningRequest.update({
      where: { id: dunningId },
      data: { fulfilledAt: new Date(), hypTxnId },
    });
  }
}
