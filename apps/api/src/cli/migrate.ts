import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '../db/client.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL تنظیم نشده است');
const { db, pool } = createDb(url);
const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');
await migrate(db, { migrationsFolder });
await pool.end();
console.log('migrations applied');
