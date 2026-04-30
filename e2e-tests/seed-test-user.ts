/**
 * Seed a known verified user for e2e tests. Idempotent — safe to run
 * before every test run. The credentials are hardcoded and committed
 * because they only target the dev DB; never use this user in prod.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export const TEST_USER = {
  email: 'e2e-test@withly.local',
  password: 'E2eTestPass123!',
  name: 'E2E Test User',
} as const;

export async function seedTestUser(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const hashed = await bcrypt.hash(TEST_USER.password, 10);
    // upsert so re-running tests doesn't fail on unique-email collision
    // and so a stale row from a prior run gets its password reset to a
    // known value.
    await prisma.user.upsert({
      where: { email: TEST_USER.email },
      update: {
        password: hashed,
        name: TEST_USER.name,
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
      create: {
        email: TEST_USER.email,
        password: hashed,
        name: TEST_USER.name,
        isEmailVerified: true,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

// Allow running directly: `npx ts-node e2e/seed-test-user.ts`
if (require.main === module) {
  seedTestUser()
    .then(() => {
      console.log(`Seeded test user: ${TEST_USER.email}`);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
