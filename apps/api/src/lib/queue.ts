import type { Db } from '../db/client.js';
import { jobs } from '../db/schema.js';

export type JobType = 'sms.otp' | 'sms.notify' | 'email.send' | 'reminder.deadline';

export async function enqueue(db: Db, type: JobType, payload: Record<string, unknown>, opts: { tenantId?: string | null; runAt?: Date } = {}) {
  await db.insert(jobs).values({ type, payload, tenantId: opts.tenantId ?? null, runAt: opts.runAt ?? new Date() });
}
