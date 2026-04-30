import { seedTestUser } from './seed-test-user';

export default async function globalSetup() {
  await seedTestUser();
}
