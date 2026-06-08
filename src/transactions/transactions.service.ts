import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TransactionKind } from '@prisma/client';

// Fallback commission rate, used only when a member's community owner has
// no plan row (legacy/partial data). Mirrors Plan.commissionBasisPoints'
// own default so the split stays consistent with newly-seeded plans.
const DEFAULT_COMMISSION_BPS = 500;

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(private prisma: PrismaService) {}

  // Records one immutable ledger row for a SUCCESSFUL charge. Fail-soft by
  // design: recording must NEVER throw into a billing flow where money has
  // already moved — a logged-but-unrecorded charge beats a crashed cron or
  // a rolled-back membership. The split is derived from `kind`, so the
  // invariant grossAmount = platformAmount + ownerAmount holds at every
  // call site without each caller repeating the math.
  async recordCharge(input: {
    kind: TransactionKind;
    grossAmount: number;
    // Owner's plan commission rate (bps). Ignored for OWNER_MONTHLY (that's
    // 100% Withly revenue). Falls back to DEFAULT_COMMISSION_BPS when null
    // on a member charge.
    commissionBasisPoints?: number | null;
    communityId: string | null;
    ownerId: string | null;
    payerId: string | null;
    memberSubscriptionId?: string | null;
    hypTxnId?: string | null;
    hypOrderId?: string | null;
  }): Promise<void> {
    try {
      // Round to whole shekels — this is what actually hit the card (HYP
      // rejects non-integer amounts) and keeps the split integer-clean.
      // Callers pass a positive magnitude; sign is applied per-kind below.
      const absGross = Math.round(Math.abs(input.grossAmount));

      // OWNER_MONTHLY: the owner pays Withly its platform fee — no split,
      // the whole amount is Withly's. MEMBER_MONTHLY: Withly keeps the
      // commission, the owner earns the remainder. REFUND: a member charge
      // is reversed — every amount is negative and the commission is clawed
      // back from Withly and the owner in the same proportion as the
      // original split, so grossAmount = platformAmount + ownerAmount holds.
      let bps = 0;
      let grossAmount = absGross;
      let platformAmount = absGross;
      let ownerAmount = 0;
      if (input.kind === 'MEMBER_MONTHLY') {
        bps = input.commissionBasisPoints ?? DEFAULT_COMMISSION_BPS;
        platformAmount = Math.round((absGross * bps) / 10000);
        ownerAmount = absGross - platformAmount;
      } else if (input.kind === 'REFUND') {
        bps = input.commissionBasisPoints ?? DEFAULT_COMMISSION_BPS;
        const platformPortion = Math.round((absGross * bps) / 10000);
        grossAmount = -absGross;
        platformAmount = -platformPortion;
        ownerAmount = -(absGross - platformPortion);
      }

      await this.prisma.transaction.create({
        data: {
          kind: input.kind,
          grossAmount,
          commissionBasisPoints: bps,
          platformAmount,
          ownerAmount,
          communityId: input.communityId,
          ownerId: input.ownerId,
          payerId: input.payerId,
          memberSubscriptionId: input.memberSubscriptionId ?? null,
          hypTxnId: input.hypTxnId ?? null,
          hypOrderId: input.hypOrderId ?? null,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to record ${input.kind} transaction ` +
        `(gross=${input.grossAmount}, community=${input.communityId}, ` +
        `hypTxn=${input.hypTxnId}): ${(err as Error).message}`,
      );
    }
  }
}
