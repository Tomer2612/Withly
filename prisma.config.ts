// Prisma CLI config (migrate, generate, studio). Prisma 7 no longer reads the
// connection URL from schema.prisma or loads .env by itself, so both happen
// here. The running app connects separately, in src/common/prisma.service.ts.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
