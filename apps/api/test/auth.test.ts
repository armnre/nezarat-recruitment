import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { jobs, roles, userRoles, users } from '../src/db/schema.js';
import type { Db } from '../src/db/client.js';
import { setupDb, TEST_DB, testConfig } from './helpers.js';

describe.skipIf(!TEST_DB)('احراز هویت و OTP (یکپارچه)', () => {
  let app: FastifyInstance;
  let db: Db;
  let end: () => Promise<void>;

  beforeAll(async () => {
    const s = await setupDb();
    db = s.db;
    end = () => s.pool.end();
    app = await buildApp(testConfig(), db);
  });
  afterAll(async () => { await app.close(); await end(); });

  const lastCode = async () => {
    const rows = await db.select().from(jobs).where(eq(jobs.type, 'sms.otp'));
    return (rows.at(-1)!.payload as { code: string }).code;
  };

  it('health', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/health' });
    expect(r.json()).toEqual({ status: 'ok' });
  });

  it('ورود با OTP، نشست httpOnly و CSRF', async () => {
    const mobile = '09120000001';
    const req = await app.inject({ method: 'POST', url: '/api/v1/auth/otp/request', payload: { tenantSlug: 'shomal', mobile } });
    expect(req.statusCode).toBe(200);

    const bad = await app.inject({ method: 'POST', url: '/api/v1/auth/otp/verify', payload: { tenantSlug: 'shomal', mobile, code: '000000' === (await lastCode()) ? '111111' : '000000' } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.message).toBe('کد تأیید نادرست است');

    const ok = await app.inject({ method: 'POST', url: '/api/v1/auth/otp/verify', payload: { tenantSlug: 'shomal', mobile, code: await lastCode() } });
    expect(ok.statusCode).toBe(200);
    const cookie = ok.cookies.find((c) => c.name === 'sid')!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Lax');
    expect(ok.json().user.roles).toContain('applicant');

    const noCsrf = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', cookies: { sid: cookie.value } });
    expect(noCsrf.statusCode).toBe(403);
    const withCsrf = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', cookies: { sid: cookie.value }, headers: { 'x-csrf-token': ok.json().csrfToken } });
    expect(withCsrf.statusCode).toBe(200);
  });

  it('قفل پس از ۵ تلاش ناموفق', async () => {
    const mobile = '09120000002';
    await app.inject({ method: 'POST', url: '/api/v1/auth/otp/request', payload: { tenantSlug: 'shomal', mobile } });
    const real = await lastCode();
    const wrong = real === '123456' ? '654321' : '123456';
    let last = 0;
    for (let i = 0; i < 5; i++) {
      last = (await app.inject({ method: 'POST', url: '/api/v1/auth/otp/verify', remoteAddress: `10.0.0.${i}`, payload: { tenantSlug: 'shomal', mobile, code: wrong } })).statusCode;
    }
    expect(last).toBe(429);
    const after = await app.inject({ method: 'POST', url: '/api/v1/auth/otp/verify', remoteAddress: '10.0.1.1', payload: { tenantSlug: 'shomal', mobile, code: real } });
    expect(after.statusCode).toBe(429);
  });

  it('محدودیت تعداد درخواست کد برای هر شماره', async () => {
    const mobile = '09120000003';
    const codes = [];
    for (let i = 0; i < 4; i++) {
      codes.push((await app.inject({ method: 'POST', url: '/api/v1/auth/otp/request', remoteAddress: `10.1.0.${i}`, payload: { tenantSlug: 'shomal', mobile } })).statusCode);
    }
    expect(codes).toEqual([200, 200, 200, 429]);
  });

  it('ورود ادمین با رمز argon2', async () => {
    const [u] = await db.insert(users).values({ email: 'root@example.com', fullName: 'ادمین', passwordHash: await argon2.hash('S3cure-pass!') }).returning();
    const [r] = await db.select().from(roles).where(eq(roles.key, 'super_admin'));
    await db.insert(userRoles).values({ userId: u.id, roleId: r.id });
    const bad = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'root@example.com', password: 'wrong-pass' } });
    expect(bad.statusCode).toBe(401);
    const ok = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: 'root@example.com', password: 'S3cure-pass!' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().user.roles).toEqual(['super_admin']);
  });
});
