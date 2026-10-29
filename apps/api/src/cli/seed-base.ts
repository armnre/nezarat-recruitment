import 'dotenv/config';
import { createDb } from '../db/client.js';
import { seedRbac } from '../db/rbac-seed.js';

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
await seedRbac(db);
await pool.end();
console.log('base data seeded (roles, permissions, tenant "shomal")');
