import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/client.js';
import { calls, tenants, users } from '../src/db/schema.js';
import { CallsService } from '../src/modules/calls/calls.service.js';
import type { TenantContext } from '../src/lib/tenant.js';
import { setupDb, TEST_DB } from './helpers.js';

describe.skipIf(!TEST_DB)('جداسازی tenant', () => {
  let db: Db;
  let end: () => Promise<void>;
  let ctxA: TenantContext;
  let callB: string;

  beforeAll(async () => {
    const s = await setupDb();
    db = s.db;
    end = () => s.pool.end();
    const [a] = await db.insert(tenants).values({ slug: 'uni-a', name: 'دانشگاه الف' }).returning();
    const [b] = await db.insert(tenants).values({ slug: 'uni-b', name: 'دانشگاه ب' }).returning();
    const [ua] = await db.insert(users).values({ tenantId: a.id, mobile: '09121111111' }).returning();
    const now = new Date();
    const later = new Date(now.getTime() + 86400000);
    await db.insert(calls).values({ tenantId: a.id, title: 'فراخوان الف', opensAt: now, closesAt: later });
    const [cb] = await db.insert(calls).values({ tenantId: b.id, title: 'فراخوان ب', opensAt: now, closesAt: later }).returning();
    callB = cb.id;
    ctxA = { tenantId: a.id, userId: ua.id, roles: ['university_admin'], permissions: ['calls.manage'] };
  });
  afterAll(async () => end());

  it('کاربر دانشگاه A فقط فراخوان‌های A را می‌بیند', async () => {
    const svc = new CallsService(db);
    const list = await svc.list(ctxA);
    expect(list.map((c) => c.title)).toEqual(['فراخوان الف']);
    expect(list.every((c) => c.tenantId === ctxA.tenantId)).toBe(true);
  });

  it('دسترسی مستقیم با شناسهٔ رکورد B ممکن نیست', async () => {
    await expect(new CallsService(db).get(ctxA, callB)).rejects.toMatchObject({ status: 404 });
  });

  it('رکوردی که A می‌سازد به tenant A تعلق می‌گیرد', async () => {
    const c = await new CallsService(db).create(ctxA, { title: 'جدید', opensAt: new Date(), closesAt: new Date() });
    expect(c.tenantId).toBe(ctxA.tenantId);
  });
});
