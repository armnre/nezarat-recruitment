import 'dotenv/config';
import { createDb } from '../db/client.js';
import { seedRbac } from '../db/rbac-seed.js';
import { applyTenantHostname } from '../db/tenant-hostname.js';

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
try {
  await seedRbac(db);
  if (process.env.TENANT_HOSTNAME) {
    const h = await applyTenantHostname(db, 'shomal', process.env.TENANT_HOSTNAME);
    console.log(`hostname دانشگاه شمال = ${h}`);
  }
  console.log('base data seeded (roles, permissions, tenant "shomal")');
} finally {
  await pool.end();
}
