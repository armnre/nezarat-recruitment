import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db/client.js';
import { seedRbac } from '../src/db/rbac-seed.js';

/** تست‌های یکپارچه روی دیتابیس جداگانه TEST_DATABASE_URL اجرا می‌شوند و آن را پاک می‌کنند. */
export const TEST_DB = process.env.TEST_DATABASE_URL;

export function testConfig() {
  return loadConfig({
    NODE_ENV: 'test', DATABASE_URL: TEST_DB ?? 'postgres://invalid', SESSION_SECRET: 'x'.repeat(48),
    COOKIE_SECURE: 'false', TRUST_PROXY: 'false', SMS_PROVIDER: 'mock',
  });
}

export async function setupDb() {
  const { db, pool } = createDb(TEST_DB!);
  await db.execute(sql`drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;`);
  const here = path.dirname(fileURLToPath(import.meta.url));
  await migrate(db, { migrationsFolder: path.resolve(here, '../drizzle') });
  await seedRbac(db);
  return { db, pool };
}
