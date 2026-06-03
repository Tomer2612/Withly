// Phase 4 Mission 1 — manual SOFT-charge dry-run + send test.
//
// Standalone: no NestJS bootstrap, no controller. Connects directly to
// the database to fetch a tokenized UserPaymentMethod, then makes one
// raw fetch() to HYP. Designed for one-off use; delete after Mission 1
// passes.
//
// SAFETY: Defaults to dry-run. Prints every param being sent + the
// resolved card data. To actually charge, pass --send. Default amount
// is ₪1; refuses to send >₪10 without --confirm-large.
//
// USAGE (from project root):
//   # Dry-run — prints params, does NOT call HYP
//   npx tsx scripts/test-soft-charge.ts --email tomer@withly.co.il
//
//   # Actually charge ₪1
//   npx tsx scripts/test-soft-charge.ts --email tomer@withly.co.il --send
//
//   # Actually charge a custom amount up to ₪10
//   npx tsx scripts/test-soft-charge.ts --email tomer@withly.co.il --amount 2 --send
//
// REQUIRED ENV (locally, in process.env — read from .env via dotenv):
//   DATABASE_URL          — points to the DB containing the token row
//                            (use prod's URL to charge prod's stored token)
//   HYP_KEY               — shared with the existing pay-terminal creds
//   HYP_MASOF             — original pay terminal (becomes tOwner in SOFT)
//   HYP_MASOF_TOKEN       — token terminal (where the SOFT call runs)
//   HYP_PASSP_TOKEN       — token-terminal PassP

import { PrismaClient } from '@prisma/client';
import * as readline from 'node:readline/promises';

const HYP_BASE = 'https://pay.hyp.co.il/p3/';

interface Args {
  email: string;
  amount: number;
  send: boolean;
  confirmLarge: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { email: '', amount: 1, send: false, confirmLarge: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--send') args.send = true;
    else if (arg === '--confirm-large') args.confirmLarge = true;
    else if (arg === '--email') args.email = argv[++i];
    else if (arg === '--amount') args.amount = parseInt(argv[++i], 10);
    else {
      console.error(`Unknown arg: ${arg}`);
      process.exit(1);
    }
  }
  if (!args.email) {
    console.error('Missing --email <user-email>. Use the email of the user whose card we charge.');
    process.exit(1);
  }
  if (!Number.isInteger(args.amount) || args.amount < 1) {
    console.error(`Invalid --amount ${args.amount} (must be positive integer)`);
    process.exit(1);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  // Env validation up front — better to fail before opening the DB.
  const env = process.env;
  const missing = ['HYP_KEY', 'HYP_MASOF', 'HYP_MASOF_TOKEN', 'HYP_PASSP_TOKEN'].filter((k) => !env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (args.send && args.amount > 10 && !args.confirmLarge) {
    console.error(`Refusing to send ₪${args.amount} without --confirm-large flag.`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email: args.email },
      select: { id: true, name: true, email: true },
    });
    if (!user) {
      console.error(`No user with email ${args.email}`);
      process.exit(1);
    }

    // Use the primary tokenized payment method on this user. If they have
    // multiple, --pm-id could pick one; for Mission 1 we use the primary.
    const pm = await prisma.userPaymentMethod.findFirst({
      where: {
        userId: user.id,
        hypPaymentMethodId: { not: null },
        cardExpMonth: { not: null },
        cardExpYear: { not: null },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
    if (!pm || !pm.hypPaymentMethodId || pm.cardExpMonth == null || pm.cardExpYear == null) {
      console.error(`No tokenized payment method for ${args.email}`);
      process.exit(1);
    }

    const now = new Date();
    const nowYM = now.getFullYear() * 100 + (now.getMonth() + 1);
    const expYM = pm.cardExpYear * 100 + pm.cardExpMonth;
    if (expYM < nowYM) {
      console.error(`Card is expired (${pm.cardExpMonth}/${pm.cardExpYear}); aborting.`);
      process.exit(1);
    }

    const order = `mission1-soft-${user.id}-${Date.now()}`;
    const params = new URLSearchParams({
      action: 'soft',
      Token: 'True',
      Masof: env.HYP_MASOF_TOKEN!,
      KEY: env.HYP_KEY!,
      PassP: env.HYP_PASSP_TOKEN!,
      tOwner: env.HYP_MASOF!,
      CC: pm.hypPaymentMethodId,
      Tmonth: String(pm.cardExpMonth).padStart(2, '0'),
      Tyear: String(pm.cardExpYear),
      Amount: String(args.amount),
      Coin: '1',
      UserId: '000000000',
      ClientName: user.name ?? user.email,
      email: user.email,
      Order: order,
      Info: 'Phase 4 Mission 1 SOFT dry-run',
      SendHesh: 'True',
      UTF8: 'True',
      UTF8out: 'True',
    });

    console.log('=== Mission 1 SOFT charge ===');
    console.log(`User:    ${user.email}  (${user.id})`);
    console.log(`Card:    ${pm.cardBrand} •••• ${pm.cardLastFour}  exp ${pm.cardExpMonth}/${pm.cardExpYear}`);
    console.log(`Token:   ${pm.hypPaymentMethodId.slice(0, 4)}...${pm.hypPaymentMethodId.slice(-4)} (19 digits, redacted)`);
    console.log(`Amount:  ₪${args.amount}`);
    console.log(`Order:   ${order}`);
    console.log(`Masof:   ${env.HYP_MASOF_TOKEN} (token terminal)`);
    console.log(`tOwner:  ${env.HYP_MASOF} (pay terminal)`);
    console.log(`URL:     ${HYP_BASE}`);
    console.log('');
    console.log('--- Full params being sent ---');
    for (const [k, v] of params.entries()) {
      const display = k === 'CC' ? `${v.slice(0, 4)}...${v.slice(-4)}` : v;
      console.log(`  ${k}=${display}`);
    }
    console.log('');

    if (!args.send) {
      console.log('DRY-RUN MODE. Add --send to actually charge.');
      return;
    }

    // Last-mile confirmation prompt — even with --send, force one more
    // human acknowledgement. Avoids fat-finger production charges.
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`\nAbout to charge ₪${args.amount} to ${user.email}'s card ${pm.cardLastFour}. Type "charge" to confirm: `);
    rl.close();
    if (answer.trim() !== 'charge') {
      console.log('Aborted (did not type "charge").');
      return;
    }

    console.log('\nSending SOFT charge to HYP...');
    const t0 = Date.now();
    const res = await fetch(HYP_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const elapsed = Date.now() - t0;
    const text = await res.text();
    console.log(`HTTP ${res.status} (${elapsed}ms)`);
    console.log('--- Response body ---');
    console.log(text);
    console.log('');
    const responseParams: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(text).entries()) {
      responseParams[k] = v.trim();
    }
    console.log('--- Parsed ---');
    for (const [k, v] of Object.entries(responseParams)) {
      console.log(`  ${k}=${v}`);
    }
    const ccode = responseParams.CCode;
    console.log('');
    if (ccode === '0') {
      console.log(`✅ SUCCESS — CCode=0, Id=${responseParams.Id ?? '?'}, Amount=${responseParams.Amount ?? '?'}`);
      console.log('Next: check the card statement, EasyCount inbox, and HYP merchant console.');
    } else {
      console.log(`❌ FAILED — CCode=${ccode ?? 'missing'}`);
      console.log('Diagnose: lookup CCode in HYP docs, paste full response into the chat.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
