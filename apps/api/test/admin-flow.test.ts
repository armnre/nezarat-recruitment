import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { applications, jobs, roles, tenants, userRoles, users } from '../src/db/schema.js';
import { setupDb, TEST_DB, testConfig } from './helpers.js';

type S = { sid: string; csrf: string; userId: string };

describe.skipIf(!TEST_DB)('پنل مدیر دانشگاه', () => {
  let app: FastifyInstance; let db: Db; let end: () => Promise<void>; let tenantId = '';
  let admin: S, applicant: S;
  let callId = '';
  const call = (s: S, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as object, cookies: { sid: s.sid }, headers: { 'x-csrf-token': s.csrf } });
  async function login(mobile: string, role?: string): Promise<S> {
    await app.inject({ method: 'POST', url: '/api/v1/auth/otp/request', payload: { tenantSlug: 'shomal', mobile } });
    const j = (await db.select().from(jobs).where(eq(jobs.type, 'sms.otp'))).filter((x) => (x.payload as { mobile: string }).mobile === mobile).at(-1)!;
    const v = await app.inject({ method: 'POST', url: '/api/v1/auth/otp/verify', payload: { tenantSlug: 'shomal', mobile, code: (j.payload as { code: string }).code } });
    const [u] = await db.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.mobile, mobile)));
    if (role) { const [r] = await db.select().from(roles).where(eq(roles.key, role)); await db.insert(userRoles).values({ tenantId, userId: u.id, roleId: r.id }); }
    return { sid: v.cookies.find((x) => x.name === 'sid')!.value, csrf: v.json().csrfToken, userId: u.id };
  }
  const body = () => ({
    title: 'فراخوان جذب ۱۴۰۵', description: 'شرح', opensAt: new Date(Date.now() - 3600e3).toISOString(), closesAt: new Date(Date.now() + 86400e3).toISOString(),
    workflow: { interview: true, minReviewers: 2 },
    requiredDocuments: [{ key: 'cv', title: 'رزومه', mimeTypes: ['application/pdf'], maxSizeMb: 5, required: true }],
    criteria: [{ title: 'پژوهش', maxScore: 50, weight: 2 }, { title: 'آموزش', maxScore: 30, weight: 1 }],
  });

  beforeAll(async () => {
    const s = await setupDb(); db = s.db; end = () => s.pool.end();
    app = await buildApp(testConfig(), db);
    tenantId = (await db.select().from(tenants).where(eq(tenants.slug, 'shomal')))[0].id;
    admin = await login('09121110001', 'university_admin');
    applicant = await login('09121110002');
  });
  afterAll(async () => { await app.close(); await end(); });

  it('متقاضی به APIهای مدیریت دسترسی ندارد', async () => {
    expect((await call(applicant, 'GET', '/api/v1/admin/calls')).statusCode).toBe(403);
    expect((await call(applicant, 'POST', '/api/v1/admin/calls', body())).statusCode).toBe(403);
  });

  it('ساخت، اعتبارسنجی و انتشار فراخوان', async () => {
    expect((await call(admin, 'POST', '/api/v1/admin/calls', { ...body(), closesAt: new Date(Date.now() - 7200e3).toISOString() })).statusCode).toBe(400);
    const r = await call(admin, 'POST', '/api/v1/admin/calls', body());
    expect(r.statusCode).toBe(200);
    callId = r.json().id;
    expect(r.json().criteria).toHaveLength(2);
    expect((await call(admin, 'POST', `/api/v1/admin/calls/${callId}/status`, { status: 'published' })).statusCode).toBe(200);
    const pub = await app.inject({ method: 'GET', url: '/api/v1/public/shomal/calls' });
    expect(pub.json().map((c: { id: string }) => c.id)).toContain(callId);
  });

  it('پس از دریافت درخواست، ساختار فراخوان قفل می‌شود', async () => {
    await db.insert(applications).values({ tenantId, callId, applicantId: applicant.userId, status: 'submitted', submittedAt: new Date() });
    const r = await call(admin, 'PUT', `/api/v1/admin/calls/${callId}`, { ...body(), title: 'عنوان جدید', criteria: [] });
    expect(r.json().title).toBe('عنوان جدید');
    expect(r.json().criteria).toHaveLength(2);
    expect(r.json().structureLocked).toBe(true);
    expect((await call(admin, 'DELETE', `/api/v1/admin/calls/${callId}`)).statusCode).toBe(400);
  });

  it('افزودن عضو کمیته و غیرفعال‌سازی آن', async () => {
    const r = await call(admin, 'POST', '/api/v1/admin/members', { mobile: '۰۹۱۲۱۱۱۰۰۰۹', fullName: 'دکتر داور', role: 'committee_chair' });
    expect(r.statusCode).toBe(200);
    const list = (await call(admin, 'GET', '/api/v1/admin/members')).json();
    expect(list[0]).toMatchObject({ fullName: 'دکتر داور', isChair: true, active: true });
    await call(admin, 'PATCH', `/api/v1/admin/members/${list[0].id}`, { active: false });
    const after = (await call(admin, 'GET', '/api/v1/admin/members')).json();
    expect(after[0]).toMatchObject({ active: false, isChair: false });
  });

  it('ساختار سازمانی و خروجی CSV ایمن', async () => {
    const f = (await call(admin, 'POST', '/api/v1/admin/org', { name: 'دانشکده فنی' })).json();
    await call(admin, 'POST', '/api/v1/admin/org', { name: 'گروه کامپیوتر', facultyId: f.id });
    expect((await call(admin, 'GET', '/api/v1/org')).json()[0].departments).toHaveLength(1);
    await db.update(users).set({ fullName: '=HYPERLINK("x")' }).where(eq(users.id, applicant.userId));
    const csv = await call(admin, 'GET', '/api/v1/admin/reports/applications.csv');
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.body).toContain(`"'=HYPERLINK(""x"")"`);
    expect((await call(admin, 'GET', '/api/v1/admin/audit')).json().length).toBeGreaterThan(3);
  });
});
