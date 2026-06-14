/**
 * Plan seed — the two Withly platform plans (starter + pro).
 *
 * Plans are platform config, not user data, so they must be re-seeded after
 * any full DB reset/relaunch. Lives in scripts/ (tracked) rather than server/
 * (git-ignored) so it deploys via `git pull` and survives wipes.
 *
 * Idempotent: upserts by slug and deactivates any other plan so
 * GET /plans (active, price-asc) returns exactly [starter, pro]. Existing
 * user.planId references to a deactivated plan stay valid (the row remains,
 * just isActive=false) so their billing is unaffected.
 *
 * Run on the server (DATABASE_URL from .env):
 *   node scripts/seed-plans.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Retire anything that isn't one of our two plans so the pricing page
  // never renders a stale third card.
  await prisma.plan.updateMany({
    where: { slug: { notIn: ['starter', 'pro'] } },
    data: { isActive: false, isDefault: false },
  });

  await prisma.plan.upsert({
    where: { slug: 'starter' },
    update: { name: 'Starter', monthlyPriceILS: 54, commissionBasisPoints: 940, trialLengthMonths: 1, isActive: true, isDefault: true },
    create: { id: 'plan-starter', slug: 'starter', name: 'Starter', monthlyPriceILS: 54, commissionBasisPoints: 940, trialLengthMonths: 1, isActive: true, isDefault: true },
  });

  await prisma.plan.upsert({
    where: { slug: 'pro' },
    update: { name: 'Pro', monthlyPriceILS: 164, commissionBasisPoints: 290, trialLengthMonths: 1, isActive: true, isDefault: false },
    create: { id: 'plan-pro', slug: 'pro', name: 'Pro', monthlyPriceILS: 164, commissionBasisPoints: 290, trialLengthMonths: 1, isActive: true, isDefault: false },
  });

  const all = await prisma.plan.findMany({ orderBy: { monthlyPriceILS: 'asc' } });
  console.log('Plans now:', JSON.stringify(all, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
