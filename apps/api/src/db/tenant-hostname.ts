import { eq } from 'drizzle-orm';
import type { Db } from './client.js';
import { tenants } from './schema.js';
import { normalizeHostname } from '../lib/host.js';

/** تنظیم hostname یک tenant از env (برای seed-base). مقدار نامعتبر خطا می‌دهد. */
export async function applyTenantHostname(db: Db, slug: string, raw: string): Promise<string> {
  const hostname = normalizeHostname(raw);
  if (!hostname) throw new Error(`TENANT_HOSTNAME نامعتبر است: ${raw}`);
  await db.update(tenants).set({ hostname }).where(eq(tenants.slug, slug));
  return hostname;
}
