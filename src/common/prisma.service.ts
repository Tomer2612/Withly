import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// node-postgres options for a DATABASE_URL. Prisma 6 encrypted the
// connection whenever the server supported it (sslmode=prefer, no
// certificate check); node-postgres connects in plain text unless told
// otherwise, and AWS RDS refuses plain-text connections. So: TLS for any
// non-local host, matching Prisma 6. An sslmode in the URL still wins,
// because node-postgres applies the URL's options on top of these.
/** @public (exported for test/database.test.js) */
export function pgOptions(url: string | undefined) {
  let host = '';
  try {
    host = new URL(url ?? '').hostname;
  } catch {
    // Unparseable URL: leave it to node-postgres to report.
  }
  return {
    connectionString: url,
    // Prisma 6 gave up on a connection after 5s; node-postgres waits forever.
    connectionTimeoutMillis: 5_000,
    ...(LOCAL_HOSTS.has(host) ? {} : { ssl: { rejectUnauthorized: false } }),
  };
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // Prisma 7 connects through a driver adapter (node-postgres) instead of
    // its own query engine. DATABASE_URL is already in process.env here:
    // ConfigModule.forRoot() loads .env before any provider is created.
    super({ adapter: new PrismaPg(pgOptions(process.env.DATABASE_URL)) });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
