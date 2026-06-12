/**
 * Monthly payout report (manual model). Computes the outstanding balance owed
 * to each community owner from the ledger and prints a CSV with their bank
 * details. You run this, make the bank transfers, then run payout-mark-paid.js.
 *
 *   node scripts/payout-report.js > payouts.csv
 *
 * Outstanding = Σ Transaction.ownerAmount (lifetime net, after commission +
 * refunds) − Σ OwnerPayout.amount (PENDING + PAID). The ledger is the source
 * of truth; this is read-only.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const csv = (cells) => cells.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',');

async function main() {
  const [netByOwner, paidByOwner] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['ownerId'],
      where: { ownerId: { not: null } },
      _sum: { ownerAmount: true },
    }),
    prisma.ownerPayout.groupBy({
      by: ['ownerId'],
      where: { status: { in: ['PENDING', 'PAID'] } },
      _sum: { amount: true },
    }),
  ]);
  const paidMap = new Map(paidByOwner.map((p) => [p.ownerId, p._sum.amount || 0]));

  console.log(csv(['ownerId', 'name', 'email', 'bankCode', 'branch', 'account', 'idNumber', 'outstandingILS']));

  let owed = 0;
  let missingBank = 0;
  for (const n of netByOwner) {
    const outstanding = Math.round((n._sum.ownerAmount || 0) - (paidMap.get(n.ownerId) || 0));
    if (outstanding <= 0) continue;
    const owner = await prisma.user.findUnique({
      where: { id: n.ownerId },
      select: { name: true, email: true, bankAccount: true },
    });
    if (!owner) continue;
    const b = owner.bankAccount;
    if (!b) missingBank++;
    owed += outstanding;
    console.log(csv([n.ownerId, owner.name, owner.email, b?.bank, b?.branchNumber, b?.accountNumber, b?.idNumber, outstanding]));
  }

  console.error(`\nTotal owed: ₪${owed}.`);
  if (missingBank) console.error(`⚠️  ${missingBank} owner(s) owed money but MISSING bank details — cannot pay until they add one.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
