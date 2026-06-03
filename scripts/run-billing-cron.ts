// Phase 4 Mission 2 — one-off: manually invoke the daily billing cron
// without waiting for midnight Asia/Jerusalem. Useful for testing the
// SOFT charge happy path + failure path on prod against a backdated
// community. Bootstraps the full Nest application context (no HTTP
// server) so dependency injection wires everything (Prisma, HypService,
// EmailService, NotificationsService, StorageService).
//
// SAFETY: This runs the REAL cron — every community whose
// nextBillingDate <= now will be charged. Only backdate ONE community
// at a time when testing, and verify which communities are due first
// with the psql query in the comments below.
//
// USAGE (from project root, on prod or with prod DATABASE_URL):
//   npx tsx scripts/run-billing-cron.ts
//
// Pre-flight verification before running (recommended):
//   psql "$RDSHOST_CONN" -c "SELECT id, name, \"ownerId\", \"nextBillingDate\" FROM communities WHERE \"subscriptionStatus\"='ACTIVE' AND \"subscriptionCancelledAt\" IS NULL AND \"nextBillingDate\" <= NOW();"
//
// If that returns more than the row(s) you intended to test, STOP and
// adjust nextBillingDate before running this script.

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { CommunityBillingCronService } from '../src/communities/community-billing-cron.service';

async function main() {
  const logger = new Logger('run-billing-cron');

  logger.log('Bootstrapping Nest application context (no HTTP server)...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const cron = app.get(CommunityBillingCronService);
    logger.log('Calling handleDailyBillingTransitions() once...');
    const start = Date.now();
    await cron.handleDailyBillingTransitions();
    const elapsed = Date.now() - start;
    logger.log(`Done in ${elapsed}ms. Check pm2 logs for per-community lines.`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
