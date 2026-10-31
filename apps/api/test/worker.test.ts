import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { jobs, smsLogs, tenants } from '../src/db/schema.js';
import { claimJobs, MAX_ATTEMPTS, processJob, runOnce } from '../src/jobs/processor.js';
import { MockMailer } from '../src/providers/email.js';
import { MockSmsProvider, type SmsProvider } from '../src/providers/sms/index.js';
import { enqueue } from '../src/lib/queue.js';
import { setupDb, TEST_DB, testConfig } from './helpers.js';

describe.skipIf(!TEST_DB)('worker صف jobs و webhook (یکپارچه)', () => {
  let db: Db;
  let end: () => Promise<void>;
  let app: FastifyInstance;
  let tenantId: string;

  beforeAll(async () => {
    const s = await setupDb();
    db = s.db;
    end = () => s.pool.end();
    const [t] = await db.insert(tenants).values({ slug: 'w-test', name: 'دانشگاه آزمون' }).returning();
    tenantId = t.id;
    app = await buildApp({ ...testConfig(), SMS_WEBHOOK_TOKEN: 'hook-token-for-tests' }, db);
  });
  afterAll(async () => { await app.close(); await end(); });
  beforeEach(async () => { await db.delete(jobs); await db.delete(smsLogs); });

  const deps = (sms: SmsProvider = new MockSmsProvider()) => ({ db, sms, mailer: new MockMailer() });

  it('sms.otp ارسال می‌شود و کد خام از payload حذف می‌شود', async () => {
    const sms = new MockSmsProvider();
    await enqueue(db, 'sms.otp', { mobile: '09120000009', code: '424242' }, { tenantId });
    expect(await runOnce(deps(sms), { batch: 10, staleMinutes: 10 })).toBe(1);
    expect(sms.sent[0]).toMatchObject({ kind: 'otp', body: '424242' });
    const [j] = await db.select().from(jobs);
    expect(j.status).toBe('done');
    expect(j.payload).toEqual({ mobile: '09120000009' });
    const [log] = await db.select().from(smsLogs);
    expect(log).toMatchObject({ status: 'sent', kind: 'otp', provider: 'mock' });
  });

  it('sms.notify با قالب پیش‌فرض و نام دانشگاه', async () => {
    const sms = new MockSmsProvider();
    const mailer = new MockMailer();
    await enqueue(db, 'sms.notify', { mobile: '0912', templateKey: 'status.accepted', params: { status: 'accepted' } }, { tenantId });
    await enqueue(db, 'email.send', { to: 'a@b.ir', templateKey: 'status.accepted', params: { status: 'accepted' } }, { tenantId });
    await runOnce({ db, sms, mailer }, { batch: 10, staleMinutes: 10 });
    expect(sms.sent[0].body).toContain('دانشگاه آزمون');
    expect(mailer.sent[0].to).toBe('a@b.ir');
  });

  it('شکست → retry با backoff، پس از ۵ بار failed و lastError', async () => {
    const failing: SmsProvider = { name: 'mock', sendOtp: async () => { throw new Error('provider down'); }, sendText: async () => { throw new Error('x'); } };
    await enqueue(db, 'sms.otp', { mobile: '0912', code: '111111' }, { tenantId });
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      await db.update(jobs).set({ runAt: new Date(Date.now() - 1000) });
      const [job] = await claimJobs(db, 1);
      expect(job.attempts).toBe(i);
      const r = await processJob(deps(failing), job);
      expect(r).toBe(i < MAX_ATTEMPTS ? 'retry' : 'failed');
    }
    const [j] = await db.select().from(jobs);
    expect(j.status).toBe('failed');
    expect(j.lastError).toContain('provider down');
    expect((j.payload as Record<string, unknown>).code).toBeUndefined();
  });

  it('backoff: job بعد از شکست تا زمان run_at برداشته نمی‌شود', async () => {
    const failing: SmsProvider = { name: 'mock', sendOtp: async () => { throw new Error('x'); }, sendText: async () => { throw new Error('x'); } };
    await enqueue(db, 'sms.otp', { mobile: '0912', code: '1' }, { tenantId });
    await runOnce(deps(failing), { batch: 10, staleMinutes: 10 });
    expect(await claimJobs(db, 10)).toHaveLength(0);
  });

  it('SKIP LOCKED: دو برداشت هم‌زمان job تکراری نمی‌گیرند', async () => {
    for (let i = 0; i < 6; i++) await enqueue(db, 'sms.notify', { mobile: '', templateKey: 'status' }, { tenantId });
    const [a, b] = await Promise.all([claimJobs(db, 4), claimJobs(db, 4)]);
    const ids = [...a, ...b].map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(6);
  });

  it('آزادسازی قفل jobهای گیرکرده', async () => {
    await enqueue(db, 'sms.notify', { mobile: '', templateKey: 'status' }, { tenantId });
    await db.update(jobs).set({ status: 'running', lockedAt: sql`now() - interval '1 hour'` });
    expect(await runOnce(deps(), { batch: 10, staleMinutes: 10 })).toBe(1);
    const [j] = await db.select().from(jobs);
    expect(j.status).toBe('done');
  });

  it('webhook گزارش تحویل: توکن اجباری و به‌روزرسانی sms_logs', async () => {
    await db.insert(smsLogs).values({ tenantId, mobile: '0912', kind: 'otp', provider: 'kavenegar', providerMessageId: '777', status: 'sent' });
    const bad = await app.inject({ method: 'POST', url: '/api/v1/webhooks/sms/kavenegar?token=wrong', payload: { messageid: '777', status: 10 } });
    expect(bad.statusCode).toBe(401);
    const ok = await app.inject({
      method: 'POST', url: '/api/v1/webhooks/sms/kavenegar?token=hook-token-for-tests',
      headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: 'messageid=777&status=10',
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ updated: 1 });
    const [log] = await db.select().from(smsLogs).where(eq(smsLogs.providerMessageId, '777'));
    expect(log.status).toBe('delivered');
  });
});
