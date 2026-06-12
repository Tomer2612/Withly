/**
 * Records OwnerPayout rows after you've made the bank transfers, settling each
 * owner's outstanding balance to zero (audit trail + carry-over safety).
 *
 *   node scripts/payout-mark-paid.js --all          # settle every owner owed > 0
 *   node scripts/payout-mark-paid.js <ownerId>      # settle one owner
 *   node scripts/payout-mark-paid.js <ownerId> 950  # settle a specific amount
 *
 * Run AFTER the transfers are actually sent. Each row is status=PAID,
 * method=MANUAL_BANK_TRANSFER. Switching to MASAV later reuses the same table.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function outstandingFor(ownerId) {
  const [net, paid] = await Promise.all([
    prisma.transaction.aggregate({ where: { ownerId }, _sum: { ownerAmount: true } }),
    prisma.ownerPayout.aggregate({ where: { ownerId, status: { in: ['PENDING', 'PAID'] } }, _sum: { amount: true } }),
  ]);
  return Math.round((net._sum.ownerAmount || 0) - (paid._sum.amount || 0));
}

async function record(ownerId, amount) {
  await prisma.ownerPayout.create({
    data: { ownerId, amount, status: 'PAID', method: 'MANUAL_BANK_TRANSFER', paidAt: new Date(), notes: 'Manual bank transfer' },
  });
  console.log(`Recorded ₪${amount} payout for owner ${ownerId}`);
}

async function main() {
  const arg = process.argv[2];
  const explicitAmount = process.argv[3] ? parseInt(process.argv[3], 10) : null;
  if (!arg) {
    console.error('Usage: node scripts/payout-mark-paid.js --all | <ownerId> [amount]');
    process.exit(1);
  }

  let total = 0;
  let count = 0;
  if (arg === '--all') {
    const owners = await prisma.transaction.groupBy({ by: ['ownerId'], where: { ownerId: { not: null } }, _sum: { ownerAmount: true } });
    for (const o of owners) {
      const outstanding = await outstandingFor(o.ownerId);
      if (outstanding <= 0) continue;
      await record(o.ownerId, outstanding);
      total += outstanding;
      count++;
    }
  } else {
    const amount = explicitAmount ?? (await outstandingFor(arg));
    if (amount <= 0) { console.error(`Owner ${arg} has no outstanding balance.`); process.exit(0); }
    await record(arg, amount);
    total += amount;
    count++;
  }
  console.log(`\nDone: ${count} payout(s), ₪${total} total.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
