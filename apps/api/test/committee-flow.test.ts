import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { applicantProfiles, applications, auditLogs, calls, committeeMembers, jobs, roles, scoringCriteria, tenants, userRoles, users } from '../src/db/schema.js';
import { setupDb, TEST_DB, testConfig } from './helpers.js';

type S = { sid: string; csrf: string; userId: string };

describe.skipIf(!TEST_DB)('پنل کمیته', () => {
  let app: FastifyInstance;
  let db: Db;
  let end: () => Promise<void>;
  let tenantId = '';
  let applicant: S, r1: S, r2: S, outsider: S, chair: S;
  let appId = '';
  let crit: { id: string; maxScore: number }[] = [];
  const asg: Record<string, string> = {};

  const call = (s: S, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as object, cookies: { sid: s.sid }, headers: { 'x-csrf-token': s.csrf } });

  async function login(mobile: string, role?: string): Promise<S> {
    await app.inject({ method: 'POST', url: '/api/v1/auth/otp/request', payload: { tenantSlug: 'shomal', mobile } });
    const js = await db.select().from(jobs).where(eq(jobs.type, 'sms.otp'));
    const j = js.filter((x) => (x.payload as { mobile: string }).mobile === mobile).at(-1)!;
    const v = await app.inject({ method: 'POST', url: '/api/v1/auth/otp/verify', payload: { tenantSlug: 'shomal', mobile, code: (j.payload as { code: string }).code } });
    const [u] = await db.select().from(users).where(and(eq(users.tenantId, tenantId), eq(users.mobile, mobile)));
    if (role) {
      const [r] = await db.select().from(roles).where(eq(roles.key, role));
      await db.insert(userRoles).values({ tenantId, userId: u.id, roleId: r.id });
      await db.update(users).set({ fullName: role + mobile.slice(-2) }).where(eq(users.id, u.id));
    }
    return { sid: v.cookies.find((x) => x.name === 'sid')!.value, csrf: v.json().csrfToken, userId: u.id };
  }

  beforeAll(async () => {
    const s = await setupDb();
    db = s.db;
    end = () => s.pool.end();
    app = await buildApp(testConfig(), db);
    tenantId = (await db.select().from(tenants).where(eq(tenants.slug, 'shomal')))[0].id;
    const [c] = await db.insert(calls).values({ tenantId, title: 'فراخوان', status: 'published', opensAt: new Date(Date.now() - 86400000), closesAt: new Date(Date.now() + 86400000), workflow: { interview: false, minReviewers: 2 } }).returning();
    crit = await db.insert(scoringCriteria).values([
      { tenantId, callId: c.id, title: 'پژوهش', maxScore: 40, weight: '2' },
      { tenantId, callId: c.id, title: 'آموزش', maxScore: 20, weight: '1' },
    ]).returning();
    applicant = await login('09120000001');
    r1 = await login('09120000002', 'committee_member');
    r2 = await login('09120000003', 'committee_member');
    outsider = await login('09120000004', 'committee_member');
    chair = await login('09120000005', 'committee_chair');
    for (const r of [r1, r2, outsider, chair]) await db.insert(committeeMembers).values({ tenantId, userId: r.userId });
    await db.insert(applicantProfiles).values({ tenantId, userId: applicant.userId, stepCompleted: 3 });
    const [a] = await db.insert(applications).values({ tenantId, callId: c.id, applicantId: applicant.userId, status: 'screening', submittedAt: new Date() }).returning();
    appId = a.id;
  });
  afterAll(async () => { await app.close(); await end(); });

  it('عضو عادی نمی‌تواند تخصیص دهد و پروندهٔ تخصیص‌نیافته را نمی‌بیند', async () => {
    const m = await db.select().from(committeeMembers);
    expect((await call(r1, 'POST', `/api/v1/committee/applications/${appId}/assignments`, { memberIds: [m[0].id] })).statusCode).toBe(403);
    expect((await call(r1, 'GET', `/api/v1/committee/applications/${appId}`)).statusCode).toBe(404);
    expect((await call(r1, 'GET', `/api/v1/applications/${appId}/documents`)).statusCode).toBe(404);
  });

  it('رئیس کمیته داور تخصیص می‌دهد و پرونده به بررسی کمیته می‌رود', async () => {
    const members = (await call(chair, 'GET', '/api/v1/committee/members')).json() as { id: string; userId: string }[];
    const ids = members.filter((m) => [r1.userId, r2.userId].includes(m.userId)).map((m) => m.id);
    const res = await call(chair, 'POST', `/api/v1/committee/applications/${appId}/assignments`, { memberIds: ids });
    expect(res.json()).toEqual({ assigned: 2 });
    const [a] = await db.select().from(applications).where(eq(applications.id, appId));
    expect(a.status).toBe('committee_review');
    for (const r of [r1, r2]) asg[r.userId] = ((await call(r, 'GET', '/api/v1/committee/assignments')).json() as { id: string }[])[0].id;
    expect((await call(outsider, 'GET', '/api/v1/committee/assignments')).json()).toEqual([]);
  });

  it('داور پرونده کامل را می‌بیند و امتیاز بیش از سقف رد می‌شود', async () => {
    const d = await call(r1, 'GET', `/api/v1/committee/applications/${appId}`);
    expect(d.statusCode).toBe(200);
    expect(d.json().criteria).toHaveLength(2);
    const bad = await call(r1, 'PUT', `/api/v1/committee/assignments/${asg[r1.userId]}/evaluation`, { scores: [{ criterionId: crit[0].id, score: 41 }] });
    expect(bad.statusCode).toBe(400);
    expect((await call(outsider, 'PUT', `/api/v1/committee/assignments/${asg[r1.userId]}/evaluation`, { scores: [] })).statusCode).toBe(404);
  });

  it('پیش‌نویس، ارسال، قفل شدن و ثبت audit برای هر امتیاز', async () => {
    const url = `/api/v1/committee/assignments/${asg[r1.userId]}/evaluation`;
    expect((await call(r1, 'PUT', url, { scores: [{ criterionId: crit[0].id, score: 30 }] })).statusCode).toBe(200);
    expect((await call(r1, 'PUT', url, { scores: [{ criterionId: crit[0].id, score: 30 }], submit: true, recommendation: 'accept' })).statusCode).toBe(400);
    const ok = await call(r1, 'PUT', url, { scores: [{ criterionId: crit[0].id, score: 40 }, { criterionId: crit[1].id, score: 10 }], comment: 'خوب', recommendation: 'accept', submit: true });
    expect(ok.statusCode).toBe(200);
    expect(Number(ok.json().totalScore)).toBeCloseTo(83.33, 1);
    expect((await call(r1, 'PUT', url, { scores: [] })).statusCode).toBe(409);
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'evaluation.score'));
    expect(logs).toHaveLength(3);
  });

  it('نهایی‌سازی پیش از حدنصاب رد و پس از آن انجام می‌شود', async () => {
    expect((await call(chair, 'POST', `/api/v1/committee/applications/${appId}/finalize`, {})).statusCode).toBe(400);
    expect((await call(r2, 'POST', `/api/v1/committee/applications/${appId}/finalize`, {})).statusCode).toBe(403);
    await call(r2, 'PUT', `/api/v1/committee/assignments/${asg[r2.userId]}/evaluation`, { scores: [{ criterionId: crit[0].id, score: 20 }, { criterionId: crit[1].id, score: 20 }], recommendation: 'reserve', submit: true });
    const s = (await call(chair, 'GET', `/api/v1/committee/applications/${appId}/summary`)).json();
    expect(s.submittedCount).toBe(2);
    const f = await call(chair, 'POST', `/api/v1/committee/applications/${appId}/finalize`, {});
    expect(f.statusCode).toBe(200);
    const [a] = await db.select().from(applications).where(eq(applications.id, appId));
    expect(a.status).toBe('scored');
    expect(Number(a.finalScore)).toBeCloseTo(75, 0);
  });
});
