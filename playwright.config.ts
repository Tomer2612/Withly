/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';

/**
 * E2E test config. Tests assume both backend (localhost:4000) and frontend
 * (localhost:3000) are running locally — run `npm run start:dev` and
 * `cd frontend && npm run dev` in separate terminals before `npm run test:e2e`.
 *
 * The seed script creates a known verified test user via Prisma so tests
 * can log in deterministically. It runs once per test run via globalSetup.
 */
export default defineConfig({
  testDir: './e2e-tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',

  globalSetup: './e2e-tests/global-setup.ts',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
