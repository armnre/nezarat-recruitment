import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import ExcelJS from 'exceljs';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { applications, calls, jobs, roles, tenants, userRoles, users } from '../src/db/schema.js';
import { renderTemplate } from '../src/lib/templates.js';
import { setupDb, TEST_DB, testConfig } from './helpers.js';

type S = { sid: string; csrf: string; userId: string };

describe.skipIf(!TEST_DB)('سوپرادمین، سقف اشتراک، قالب‌ها و خروجی‌ها', () => {
  let app: FastifyInstance; let db: Db; let end: () => Promise<void>;
  let shomalId = '';
  let superS: S, adminA: S;
  const pw = randomBytes(18).toString('base64url'); // رمز تصادفی فقط برای همین اجرا

  const call = (s: S | null, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: unknown, headers: Record<string, string> = {}) =>
    app.inject({ method, url, payload: payload as object, cookies: s ? { sid: s.sid } : {}, headers: s ? { 'x-csrf-token': s.csrf, ...headers } : headers });

  async function otpLogin(slug: string, tenantId: string, mobile: string, role?: string): Promise<S> {
    await app.inject({ method: 'POST', url: '/api/v1/auth/otp/request', payload: { tenantSlug: slug, mobile } });
    const j = (await db.select().from(jobs).where(eq(jobs.type, 'sms.otp'))).filter((x) => (x.payload as { mobile: string }).mobile === mobile).at(-1)!;
    const v = await app.inject({ method: 'POST', url: '/api/v1/auth/otp/verify', payload: { tenantSlug: slug, mobile, code: (j.payload as { code: string }).code } });
    const [u] = await db.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.mobile, mobile)));
    if (role) { const [r] = await db.select().from(roles).where(eq(roles.key, role)); await db.insert(userRoles).values({ tenantId, userId: u.id, roleId: r.id }); }
    return { sid: v.cookies.find((x) => x.name === 'sid')!.value, csrf: v.json().csrfToken, userId: u.id };
  }
  async function pwLogin(email: string, tenantSlug?: string): Promise<S> {
    const v = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password: pw, tenantSlug } });
    expect(v.statusCode).toBe(200);
    const [u] = await db.select().from(users).where(eq(users.email, email));
    return { sid: v.cookies.find((x) => x.name === 'sid')!.value, csrf: v.json().csrfToken, userId: u.id };
  }
  const callBody = (title = 'فراخوان') => ({
    title, description: 'شرح', opensAt: new Date(Date.now() - 3600e3).toISOString(), closesAt: new Date(Date.now() + 86400e3).toISOString(),
    workflow: { interview: false, minReviewers: 1 }, requiredDocuments: [], criteria: [{ title: 'پژوهش', maxScore: 10, weight: 1 }],
  });

  beforeAll(async () => {
    const s = await setupDb(); db = s.db; end = () => s.pool.end();
    app = await buildApp(testConfig(), db);
    shomalId = (await db.select().from(tenants).where(eq(tenants.slug, 'shomal')))[0].id;
    const [su] = await db.insert(users).values({ email: 'root@platform.test', fullName: 'مدیر پلتفرم', passwordHash: await argon2.hash(pw, { type: argon2.argon2id }) }).returning();
    const [r] = await db.select().from(roles).where(eq(roles.key, 'super_admin'));
    await db.insert(userRoles).values({ userId: su.id, roleId: r.id });
    superS = await pwLogin('root@platform.test');
    adminA = await otpLogin('shomal', shomalId, '09130000001', 'university_admin');
  });
  afterAll(async () => { await app.close(); await end(); });

  it('فقط سوپرادمین به /platform دسترسی دارد', async () => {
    expect((await call(adminA, 'GET', '/api/v1/platform/tenants')).statusCode).toBe(403);
    expect((await call(null, 'GET', '/api/v1/platform/tenants')).statusCode).toBe(401);
    expect((await call(superS, 'GET', '/api/v1/platform/tenants')).statusCode).toBe(200);
  });

  let bId = '';
  it('ساخت دانشگاه جدید بدون تغییر کد + مدیر آن + تعیین tenant از hostname', async () => {
    const r = await call(superS, 'POST', '/api/v1/platform/tenants', { slug: 'gilan', name: 'دانشگاه گیلان', hostname: 'jazb.gilan.test', plan: 'pro', maxApplicants: 1, maxCalls: 1 });
    expect(r.statusCode).toBe(200);
    bId = r.json().id;
    expect((await call(superS, 'POST', '/api/v1/platform/tenants', { slug: 'gilan', name: 'تکراری', maxApplicants: 1, maxCalls: 1 })).statusCode).toBe(409);
    const host = await app.inject({ method: 'GET', url: '/api/v1/public/tenant', headers: { host: 'jazb.gilan.test' } });
    expect(host.json()).toMatchObject({ slug: 'gilan', name: 'دانشگاه گیلان' });
    expect((await app.inject({ method: 'GET', url: '/api/v1/public/tenant', headers: { host: 'unknown.test' } })).statusCode).toBe(404);
    const a = await call(superS, 'POST', `/api/v1/platform/tenants/${bId}/admins`, { email: 'admin@gilan.test', fullName: 'مدیر گیلان', password: pw });
    expect(a.statusCode).toBe(200);
  });

  it('سقف maxCalls و maxApplicants و پایان اشتراک در API اعمال می‌شود', async () => {
    const adminB = await pwLogin('admin@gilan.test', 'gilan');
    const c1 = await call(adminB, 'POST', '/api/v1/admin/calls', callBody('اول'));
    expect(c1.statusCode).toBe(200);
    const c2 = await call(adminB, 'POST', '/api/v1/admin/calls', callBody('دوم'));
    expect(c2.statusCode).toBe(403);
    expect(c2.json().error.code).toBe('SUBSCRIPTION_LIMIT');
    await call(adminB, 'POST', `/api/v1/admin/calls/${c1.json().id}/status`, { status: 'published' });

    const ap1 = await otpLogin('gilan', bId, '09140000001');
    const ap2 = await otpLogin('gilan', bId, '09140000002');
    expect((await call(ap1, 'POST', '/api/v1/applications', { callId: c1.json().id })).statusCode).toBe(200);
    const blocked = await call(ap2, 'POST', '/api/v1/applications', { callId: c1.json().id });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error.message).toContain('ظرفیت');

    await call(superS, 'PUT', `/api/v1/platform/tenants/${bId}`, { slug: 'gilan', name: 'دانشگاه گیلان', hostname: 'jazb.gilan.test', maxApplicants: 100, maxCalls: 100, subscriptionEndsAt: new Date(Date.now() - 86400e3).toISOString() });
    const expired = await call(adminB, 'POST', '/api/v1/admin/calls', callBody('سوم'));
    expect(expired.statusCode).toBe(403);
    expect(expired.json().error.message).toContain('اشتراک');
  });

  it('مدیریت کاربران و گزارش عملکرد همهٔ دانشگاه‌ها', async () => {
    const list = (await call(superS, 'GET', `/api/v1/platform/users?tenantId=${bId}`)).json();
    expect(list.every((u: { tenantId: string }) => u.tenantId === bId)).toBe(true);
    const target = list.find((u: { mobile: string | null }) => u.mobile === '09140000002');
    expect((await call(superS, 'PATCH', `/api/v1/platform/users/${target.id}`, { status: 'suspended' })).statusCode).toBe(200);
    const [u] = await db.select().from(users).where(eq(users.id, target.id));
    expect(u.status).toBe('suspended');
    const perf = (await call(superS, 'GET', '/api/v1/platform/reports/performance')).json();
    expect(perf.map((p: { name: string }) => p.name)).toEqual(expect.arrayContaining(['دانشگاه شمال', 'دانشگاه گیلان']));
    expect(perf.find((p: { name: string }) => p.name === 'دانشگاه گیلان').applicants).toBe(1);
  });

  it('قالب‌ها: ذخیره، استفاده در رندر و جداسازی tenant', async () => {
    const r = await call(adminA, 'PUT', '/api/v1/admin/templates', { key: 'status.accepted', channel: 'sms', body: '{{tenant}}: تبریک! {{statusLabel}}' });
    expect(r.statusCode).toBe(200);
    expect((await call(adminA, 'PUT', '/api/v1/admin/templates', { key: 'bad.key', channel: 'sms', body: 'x' })).statusCode).toBe(400);
    const out = await renderTemplate(db, shomalId, 'status.accepted', 'sms', { status: 'accepted' });
    expect(out.body.startsWith('دانشگاه شمال: تبریک!')).toBe(true);
    const adminB = await pwLogin('admin@gilan.test', 'gilan');
    const bList = (await call(adminB, 'GET', '/api/v1/admin/templates')).json();
    expect(bList.custom).toHaveLength(0);
    expect((await call(adminB, 'DELETE', `/api/v1/admin/templates/${r.json().id}`)).statusCode).toBe(404);
  });

  it('خروجی Excel و PDF و CSV با BOM', async () => {
    const [c] = await db.insert(calls).values({ tenantId: shomalId, title: 'فراخوان گزارش', description: '', opensAt: new Date(), closesAt: new Date(Date.now() + 1e8), status: 'published' }).returning();
    const ap = await otpLogin('shomal', shomalId, '09130000009');
    await db.update(users).set({ fullName: 'دکتر سارا رضایی' }).where(eq(users.id, ap.userId));
    await db.insert(applications).values({ tenantId: shomalId, callId: c.id, applicantId: ap.userId, status: 'accepted', submittedAt: new Date(), finalScore: '87.5' });

    const csv = await call(adminA, 'GET', '/api/v1/admin/reports/applications.csv');
    expect(csv.body.charCodeAt(0)).toBe(0xfeff);
    const x = await call(adminA, 'GET', '/api/v1/admin/reports/applications.xlsx');
    expect(x.statusCode).toBe(200);
    expect(x.headers['content-type']).toContain('spreadsheetml');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(x.rawPayload as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    expect(ws.views[0].rightToLeft).toBe(true);
    expect(ws.getRow(2).getCell(2).value).toBe('نام متقاضی');
    expect(ws.getRow(3).getCell(2).value).toBe('دکتر سارا رضایی');
    const p = await call(adminA, 'GET', '/api/v1/admin/reports/applications.pdf');
    expect(p.statusCode).toBe(200);
    expect(p.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
    expect(p.rawPayload.includes(Buffer.from('Vazirmatn'))).toBe(true);
    expect((await call(adminA, 'GET', '/api/v1/admin/reports/applications.doc')).statusCode).toBe(400);
  });
});
