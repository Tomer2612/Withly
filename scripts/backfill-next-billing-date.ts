// Phase 4 Mission 2 — one-off: set Community.nextBillingDate for every
// existing community where it's null. Computes trialStartDate +
// owner.plan.trialLengthMonths. Communities without trialStartDate or
// without an owner-with-plan are listed but not modified.
//
// Defaults to DRY-RUN (lists what would change, doesn't write). Pass
// --commit to actually update the DB.
//
// USAGE (from project root):
//   # Dry-run against local DB
//   npx tsx scripts/backfill-next-billing-date.ts
//
//   # Dry-run against prod (override DATABASE_URL)
//   DATABASE_URL="<prod>" npx tsx scripts/backfill-next-billing-date.ts
//
//   # Actually write on prod
//   DATABASE_URL="<prod>" npx tsx scripts/backfill-next-billing-date.ts --commit

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const commit = process.argv.includes('--commit');

  const communities = await prisma.community.findMany({
    where: { nextBillingDate: null },
    select: {
      id: true,
      name: true,
      trialStartDate: true,
      subscriptionStatus: true,
      owner: {
        select: {
          email: true,
          plan: { select: { trialLengthMonths: true } },
        },
      },
    },
  });

  console.log(`Found ${communities.length} communities with NULL nextBillingDate`);
  if (communities.length === 0) {
    return;
  }

  let toUpdate = 0;
  let skipped = 0;

  for (const c of communities) {
    if (!c.trialStartDate) {
      console.log(`  SKIP  ${c.id} "${c.name}" — no trialStartDate (pre-HYP community)`);
      skipped++;
      continue;
    }
    const trialLength = c.owner?.plan?.trialLengthMonths ?? 1;
    const next = new Date(c.trialStartDate);
    next.setMonth(next.getMonth() + trialLength);

    const verb = commit ? 'UPDATE' : 'WOULD UPDATE';
    console.log(
      `  ${verb}  ${c.id} "${c.name}" (status=${c.subscriptionStatus}, owner=${c.owner?.email ?? '?'}): ` +
      `trialStart=${c.trialStartDate.toISOString()} + ${trialLength}mo → nextBillingDate=${next.toISOString()}`,
    );
    if (commit) {
      await prisma.community.update({
        where: { id: c.id },
        data: { nextBillingDate: next },
      });
    }
    toUpdate++;
  }

  console.log('');
  console.log(`Summary: ${commit ? 'updated' : 'would update'} ${toUpdate}, skipped ${skipped}`);
  if (!commit) {
    console.log('Re-run with --commit to apply.');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
