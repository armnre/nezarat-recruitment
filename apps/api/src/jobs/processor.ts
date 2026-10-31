import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { jobs, smsLogs } from '../db/schema.js';
import type { JobType } from '../lib/queue.js';
import { renderTemplate } from '../lib/templates.js';
import type { Mailer } from '../providers/email.js';
import type { SmsProvider } from '../providers/sms/index.js';

export const MAX_ATTEMPTS = 5;
export const BASE_BACKOFF_MS = 30_000;
export const MAX_BACKOFF_MS = 60 * 60_000;

export interface ClaimedJob { id: string; tenantId: string | null; type: JobType; payload: Record<string, unknown>; attempts: number }
export interface WorkerDeps { db: Db; sms: SmsProvider; mailer: Mailer; log?: (msg: string, data?: object) => void }

/** تأخیر تلاش بعدی پس از n تلاش ناموفق: 30s, 60s, 120s, 240s ... (حداکثر ۱ ساعت). */
export const backoffMs = (attempts: number) => Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);

/** برداشت اتمیک دسته‌ای از jobهای آماده؛ چند worker هم‌زمان هرگز job تکراری نمی‌گیرند. */
export async function claimJobs(db: Db, limit: number): Promise<ClaimedJob[]> {
  const res = await db.execute<{ id: string; tenant_id: string | null; type: JobType; payload: Record<string, unknown>; attempts: number }>(sql`
    UPDATE jobs SET status = 'running', locked_at = now(), attempts = attempts + 1, updated_at = now()
    WHERE id IN (
      SELECT id FROM jobs WHERE status = 'pending' AND run_at <= now()
      ORDER BY run_at FOR UPDATE SKIP LOCKED LIMIT ${limit}
    )
    RETURNING id, tenant_id, type, payload, attempts`);
  return res.rows.map((r) => ({ id: r.id, tenantId: r.tenant_id, type: r.type, payload: r.payload, attempts: r.attempts }));
}

/** jobهایی که worker در حین اجرا مرده و قفلشان مانده را به صف برمی‌گرداند. */
export async function releaseStale(db: Db, staleMinutes: number): Promise<number> {
  const res = await db.execute(sql`
    UPDATE jobs SET status = 'pending', locked_at = NULL, updated_at = now()
    WHERE status = 'running' AND locked_at < now() - make_interval(mins => ${staleMinutes})`);
  return res.rowCount ?? 0;
}

const stripSecrets = (job: ClaimedJob) => {
  if (job.type !== 'sms.otp') return job.payload;
  const { code: _code, ...rest } = job.payload;
  return rest;
};

async function logSms(deps: WorkerDeps, job: ClaimedJob, kind: string, run: () => Promise<{ messageId: string | null }>) {
  const mobile = String(job.payload.mobile ?? '');
  try {
    const r = await run();
    await deps.db.insert(smsLogs).values({ tenantId: job.tenantId, mobile, kind, provider: deps.sms.name, providerMessageId: r.messageId, status: 'sent' });
  } catch (e) {
    await deps.db.insert(smsLogs).values({ tenantId: job.tenantId, mobile, kind, provider: deps.sms.name, status: 'failed', error: (e as Error).message.slice(0, 500) });
    throw e;
  }
}

export async function handleJob(deps: WorkerDeps, job: ClaimedJob): Promise<void> {
  const p = job.payload;
  switch (job.type) {
    case 'sms.otp': {
      if (typeof p.code !== 'string' || typeof p.mobile !== 'string') throw new Error('payload نامعتبر برای sms.otp');
      const { mobile, code } = p;
      return logSms(deps, job, 'otp', () => deps.sms.sendOtp(mobile, code));
    }
    case 'sms.notify':
    case 'reminder.deadline': {
      if (typeof p.mobile !== 'string' || !p.mobile) return; // کاربر موبایل ندارد
      const { body } = await renderTemplate(deps.db, job.tenantId, String(p.templateKey), 'sms', (p.params as Record<string, unknown>) ?? {});
      const mobile = p.mobile;
      return logSms(deps, job, job.type === 'sms.notify' ? 'notify' : 'reminder', () => deps.sms.sendText(mobile, body));
    }
    case 'email.send': {
      if (typeof p.to !== 'string') throw new Error('payload نامعتبر برای email.send');
      const r = await renderTemplate(deps.db, job.tenantId, String(p.templateKey), 'email', (p.params as Record<string, unknown>) ?? {});
      await deps.mailer.send({ to: p.to, subject: r.subject, text: r.body });
      return;
    }
    default:
      throw new Error(`نوع job ناشناخته: ${String(job.type)}`);
  }
}

export async function processJob(deps: WorkerDeps, job: ClaimedJob, now: () => Date = () => new Date()) {
  try {
    await handleJob(deps, job);
    await deps.db.update(jobs).set({ status: 'done', lockedAt: null, lastError: null, payload: stripSecrets(job), updatedAt: now() }).where(eq(jobs.id, job.id));
    return 'done' as const;
  } catch (e) {
    const err = (e as Error).message.slice(0, 1000);
    const final = job.attempts >= MAX_ATTEMPTS;
    await deps.db.update(jobs).set(final
      ? { status: 'failed', lockedAt: null, lastError: err, payload: stripSecrets(job), updatedAt: now() }
      : { status: 'pending', lockedAt: null, lastError: err, runAt: new Date(now().getTime() + backoffMs(job.attempts)), updatedAt: now() },
    ).where(eq(jobs.id, job.id));
    deps.log?.('job failed', { id: job.id, type: job.type, attempts: job.attempts, final, err });
    return final ? ('failed' as const) : ('retry' as const);
  }
}

/** یک دور: آزادسازی قفل‌های مانده، برداشت دسته و پردازش. تعداد پردازش‌شده را برمی‌گرداند. */
export async function runOnce(deps: WorkerDeps, opts: { batch: number; staleMinutes: number }) {
  await releaseStale(deps.db, opts.staleMinutes);
  const batch = await claimJobs(deps.db, opts.batch);
  for (const job of batch) await processJob(deps, job);
  return batch.length;
}
