import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { callRequiredDocuments, calls, jobs, tenants } from '../src/db/schema.js';
import { setupDb, TEST_DB, testConfig } from './helpers.js';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

function multipart(fields: Record<string, string>, file: { name: string; data: Buffer }) {
  const b = '----nezarat' + Date.now();
  const parts = Object.entries(fields).map(([k, v]) => `--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
  const head = `--${b}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
  return { payload: Buffer.concat([Buffer.from(parts.join('') + head), file.data, Buffer.from(`\r\n--${b}--\r\n`)]), contentType: `multipart/form-data; boundary=${b}` };
}

describe.skipIf(!TEST_DB)('گردش کامل متقاضی', () => {
  let app: FastifyInstance;
  let db: Db;
  let end: () => Promise<void>;
  let sid = '';
  let csrf = '';
  let callId = '';
  let reqDocId = '';

  const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as object, cookies: { sid }, headers: { 'x-csrf-token': csrf } });

  beforeAll(async () => {
    const s = await setupDb();
    db = s.db;
    end = () => s.pool.end();
    const cfg = { ...testConfig(), UPLOAD_DIR: await mkdtemp(path.join(tmpdir(), 'nz-')) };
    app = await buildApp(cfg, db);
    const [t] = await db.select().from(tenants).where(eq(tenants.slug, 'shomal'));
    const [c] = await db.insert(calls).values({
      tenantId: t.id, title: 'فراخوان هیئت علمی ۱۴۰۵', status: 'published',
      opensAt: new Date(Date.now() - 86400000), closesAt: new Date(Date.now() + 86400000),
    }).returning();
    callId = c.id;
    const [d] = await db.insert(callRequiredDocuments).values({ tenantId: t.id, callId, key: 'cv', title: 'رزومه', mimeTypes: ['application/pdf'] }).returning();
    reqDocId = d.id;

    const mobile = '09125550000';
    await app.inject({ method: 'POST', url: '/api/v1/auth/otp/request', payload: { tenantSlug: 'shomal', mobile } });
    const [j] = await db.select().from(jobs).where(eq(jobs.type, 'sms.otp'));
    const v = await app.inject({ method: 'POST', url: '/api/v1/auth/otp/verify', payload: { tenantSlug: 'shomal', mobile, code: (j.payload as { code: string }).code } });
    sid = v.cookies.find((x) => x.name === 'sid')!.value;
    csrf = v.json().csrfToken;
  });
  afterAll(async () => { await app.close(); await end(); });

  it('فراخوان فعال به‌صورت عمومی دیده می‌شود', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/v1/public/shomal/calls' });
    expect(r.json().map((c: { id: string }) => c.id)).toEqual([callId]);
  });

  it('کد ملی نامعتبر رد می‌شود', async () => {
    const r = await call('PUT', '/api/v1/profile/identity', { firstName: 'علی', lastName: 'رضایی', fatherName: 'حسن', nationalCode: '1234567890', birthDate: '1985-03-21', gender: 'male', province: 'مازندران', city: 'آمل', address: 'خیابان طالب آملی' });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.message).toBe('کد ملی معتبر نیست');
  });

  it('ارسال پیش از تکمیل پرونده و مدارک رد می‌شود؛ سپس موفق', async () => {
    const created = await call('POST', '/api/v1/applications', { callId });
    expect(created.statusCode).toBe(200);
    const appId = created.json().id;

    const early = await call('POST', `/api/v1/applications/${appId}/status`, { to: 'submitted' });
    expect(early.json().error.message).toContain('مراحل پرونده');

    expect((await call('PUT', '/api/v1/profile/identity', { firstName: 'علی', lastName: 'رضایی', fatherName: 'حسن', nationalCode: '۰۰۱۳۵۴۲۴۱۹', birthDate: '1985-03-21', gender: 'male', province: 'مازندران', city: 'آمل', address: 'خیابان طالب آملی' })).statusCode).toBe(200);
    expect((await call('POST', '/api/v1/profile/education-done')).statusCode).toBe(400);
    expect((await call('POST', '/api/v1/resume/education', { degree: 'phd', field: 'مهندسی کامپیوتر', university: 'دانشگاه تهران' })).statusCode).toBe(200);
    expect((await call('POST', '/api/v1/profile/education-done')).statusCode).toBe(200);
    expect((await call('PUT', '/api/v1/profile/family', { maritalStatus: 'married', childrenCount: 2 })).statusCode).toBe(200);

    const noDoc = await call('POST', `/api/v1/applications/${appId}/status`, { to: 'submitted' });
    expect(noDoc.json().error.message).toContain('رزومه');

    const fake = multipart({ applicationId: appId, requiredDocumentId: reqDocId }, { name: 'cv.pdf', data: Buffer.from('MZ not a pdf') });
    const bad = await app.inject({ method: 'POST', url: '/api/v1/documents', cookies: { sid }, headers: { 'x-csrf-token': csrf, 'content-type': fake.contentType }, payload: fake.payload });
    expect(bad.statusCode).toBe(400);

    const good = multipart({ applicationId: appId, requiredDocumentId: reqDocId }, { name: 'cv.pdf', data: PDF });
    const up = await app.inject({ method: 'POST', url: '/api/v1/documents', cookies: { sid }, headers: { 'x-csrf-token': csrf, 'content-type': good.contentType }, payload: good.payload });
    expect(up.statusCode).toBe(200);
    const dl = await call('GET', `/api/v1/documents/${up.json().id}`);
    expect(dl.headers['content-type']).toBe('application/pdf');

    const ok = await call('POST', `/api/v1/applications/${appId}/status`, { to: 'submitted' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().status).toBe('submitted');
    const hist = await call('GET', `/api/v1/applications/${appId}/history`);
    expect(hist.json().map((h: { toStatus: string }) => h.toStatus)).toEqual(['draft', 'submitted']);
    expect((await db.select().from(jobs).where(eq(jobs.type, 'sms.notify'))).length).toBe(1);

    const anon = await app.inject({ method: 'GET', url: `/api/v1/documents/${up.json().id}` });
    expect(anon.statusCode).toBe(401);
  });
});
