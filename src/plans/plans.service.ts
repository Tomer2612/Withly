import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  // Active plans, ordered by price. Used by the (future) pricing-tiers
  // page to render the plan list. Pre-launch there's one row.
  async getActive() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPriceILS: 'asc' },
    });
  }

  // The single default plan that new signups land on. Exactly one row
  // should have isDefault=true; if for some reason none does (data bug),
  // fall back to the cheapest active plan so the system stays usable.
  async getDefault() {
    const explicit = await this.prisma.plan.findFirst({
      where: { isDefault: true, isActive: true },
    });
    if (explicit) return explicit;
    const fallback = await this.prisma.plan.findFirst({
      where: { isActive: true },
      orderBy: { monthlyPriceILS: 'asc' },
    });
    if (!fallback) {
      throw new InternalServerErrorException('No active plans configured');
    }
    return fallback;
  }
}
