// Database connection options (Prisma 7 + node-postgres). Checked through
// node-postgres's own parser, so this is what it will actually connect with.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ConnectionParameters = require('pg/lib/connection-parameters');
const { dist } = require('./helpers');

const { pgOptions } = dist('common', 'prisma.service.js');
const ssl = (url) => new ConnectionParameters(pgOptions(url)).ssl;

test('database connection: TLS for remote hosts (RDS), plain for local', () => {
  // Prod's URL shape: remote host, no sslmode. RDS refuses plain text.
  assert.deepEqual(ssl('postgresql://u:p@withly-db.example.rds.amazonaws.com:5432/withly?schema=public'), { rejectUnauthorized: false });
  assert.equal(ssl('postgresql://u:p@localhost:5432/withly'), false);
  assert.equal(ssl('postgresql://u:p@127.0.0.1:5432/withly'), false);
  // An explicit sslmode in the URL wins over the default.
  assert.equal(ssl('postgresql://u:p@db.example.com:5432/withly?sslmode=disable'), false);
  assert.equal(pgOptions('postgresql://u:p@localhost/withly').connectionTimeoutMillis, 5000);
});
