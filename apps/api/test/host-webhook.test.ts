import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { smsLogs, tenants } from '../src/db/schema.js';
import { applyTenantHostname } from '../src/db/tenant-hostname.js';
import { normalizeHostname } from '../src/lib/host.js';
import { setupDb, TEST_DB, testConfig } from './helpers.js';

describe('normalizeHostname', () => {
  it('پورت و حروف بزرگ را حذف و مقادیر نامعتبر را رد می‌کند', () => {
    expect(normalizeHostname('Nezarat.Shomal.ac.ir:443')).toBe('nezarat.shomal.ac.ir');
    expect(normalizeHostname('evil.com/x')).toBeNull();
    expect(normalizeHostname('a b.com')).toBeNull();
    expect(normalizeHostname('')).toBeNull();
    expect(normalizeHostname("x'; drop table--")).toBeNull();
  });
});

describe.skipIf(!TEST_DB)('tenant از روی Host، seed hostname و توکن webhook (یکپارچه)', () => {
  let db: Db; let end: () => Promise<void>;
  const apps: FastifyInstance[] = [];
  const make = async (over: Record<string, unknown>) => {
    const a = await buildApp({ ...testConfig(), SMS_WEBHOOK_TOKEN: 'hook-token-xyz', ...over } as never, db);
    apps.push(a); return a;
  };
  const tenantReq = (a: FastifyInstance, headers: Record<string, string>, remoteAddress = '127.0.0.1') =>
    a.inject({ method: 'GET', url: '/api/v1/public/tenant', headers, remoteAddress });

  beforeAll(async () => {
    const s = await setupDb(); db = s.db; end = () => s.pool.end();
    await db.update(tenants).set({ hostname: 'nezarat.shomal.test' }).where(eq(tenants.slug, 'shomal'));
  });
  afterAll(async () => { for (const a of apps) await a.close(); await end(); });

  it('TRUST_PROXY=true: X-Forwarded-Host فقط از nginx محلی پذیرفته می‌شود', async () => {
    const a = await make({ TRUST_PROXY: true, TRUSTED_PROXY_IPS: ['127.0.0.1', '::1'] });
    const viaNginx = await tenantReq(a, { host: '127.0.0.1:3102', 'x-forwarded-host': 'nezarat.shomal.test' });
    expect(viaNginx.statusCode).toBe(200);
    expect(viaNginx.json().slug).toBe('shomal');
    // درخواست مستقیم از IP غیرمجاز: X-Forwarded-Host جعلی نادیده گرفته می‌شود و Host خودش ملاک است
    const spoof = await tenantReq(a, { host: 'unknown.test', 'x-forwarded-host': 'nezarat.shomal.test' }, '203.0.113.9');
    expect(spoof.statusCode).toBe(404);
    const directOk = await tenantReq(a, { host: 'nezarat.shomal.test' }, '203.0.113.9');
    expect(directOk.statusCode).toBe(200);
  });

  it('TRUST_PROXY=false: X-Forwarded-Host هرگز پذیرفته نمی‌شود؛ Host نامعتبر ۴۰۴', async () => {
    const a = await make({ TRUST_PROXY: false });
    expect((await tenantReq(a, { host: 'unknown.test', 'x-forwarded-host': 'nezarat.shomal.test' })).statusCode).toBe(404);
    expect((await tenantReq(a, { host: 'NEZARAT.shomal.test:8080' })).statusCode).toBe(200);
    expect((await tenantReq(a, { host: 'bad_host!' })).statusCode).toBe(404);
  });

  it('seed: TENANT_HOSTNAME روی tenant شمال اعمال و مقدار نامعتبر رد می‌شود', async () => {
    expect(await applyTenantHostname(db, 'shomal', 'Jazb.Shomal.test')).toBe('jazb.shomal.test');
    const [t] = await db.select().from(tenants).where(eq(tenants.slug, 'shomal'));
    expect(t.hostname).toBe('jazb.shomal.test');
    await expect(applyTenantHostname(db, 'shomal', 'not a host')).rejects.toThrow('TENANT_HOSTNAME');
  });

  it('webhook: هدر X-Webhook-Token بر query ترجیح دارد', async () => {
    const a = await make({});
    const [t] = await db.select().from(tenants).where(eq(tenants.slug, 'shomal'));
    await db.insert(smsLogs).values({ tenantId: t.id, mobile: '0912', kind: 'otp', provider: 'kavenegar', providerMessageId: '9001', status: 'sent' });
    const post = (url: string, headers: Record<string, string> = {}) => a.inject({
      method: 'POST', url, headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, payload: 'messageid=9001&status=10',
    });
    expect((await post('/api/v1/webhooks/sms/kavenegar', { 'x-webhook-token': 'hook-token-xyz' })).json()).toEqual({ updated: 1 });
    // هدر غلط + query درست → رد (هدر اولویت دارد)
    expect((await post('/api/v1/webhooks/sms/kavenegar?token=hook-token-xyz', { 'x-webhook-token': 'wrong' })).statusCode).toBe(401);
    expect((await post('/api/v1/webhooks/sms/kavenegar?token=hook-token-xyz')).statusCode).toBe(200);
    expect((await post('/api/v1/webhooks/sms/kavenegar')).statusCode).toBe(401);
  });
});
