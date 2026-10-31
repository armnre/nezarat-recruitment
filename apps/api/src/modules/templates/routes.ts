import { and, asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../../db/client.js';
import { notificationTemplates } from '../../db/schema.js';
import { audit } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';
import { DEFAULT_TEMPLATES, renderText } from '../../lib/templates.js';
import { tenantCtx } from '../../plugins/auth.js';

/** کلیدهای قابل تنظیم: وضعیت‌های پرونده + رویدادهای کمیته. */
export const TEMPLATE_KEYS = [
  'status.submitted', 'status.screening', 'status.incomplete', 'status.committee_review', 'status.interview',
  'status.scored', 'status.accepted', 'status.rejected', 'status.reserve', 'status.withdrawn',
  'committee.assigned', 'committee.due',
] as const;

const templateSchema = z.object({
  key: z.enum(TEMPLATE_KEYS, { message: 'کلید قالب نامعتبر است' }),
  channel: z.enum(['sms', 'email']),
  subject: z.string().trim().max(200).nullable().optional(),
  body: z.string().trim().min(1, 'متن قالب الزامی است').max(2000, 'متن قالب طولانی است'),
  providerTemplate: z.string().trim().max(100).nullable().optional(),
});

export function templateRoutes(app: FastifyInstance, { db }: { db: Db }) {
  const A = 'university_admin' as const;

  app.get('/api/v1/admin/templates', async (req) => {
    const ctx = tenantCtx(req, A);
    const custom = await db.select().from(notificationTemplates).where(eq(notificationTemplates.tenantId, ctx.tenantId)).orderBy(asc(notificationTemplates.key));
    const defaults = Object.fromEntries(TEMPLATE_KEYS.map((k) => [k, DEFAULT_TEMPLATES[k] ?? DEFAULT_TEMPLATES.status]));
    return { keys: TEMPLATE_KEYS, defaults, custom };
  });

  app.put('/api/v1/admin/templates', async (req) => {
    const ctx = tenantCtx(req, A);
    const b = templateSchema.parse(req.body);
    if (b.channel === 'email' && !b.subject) throw Errors.validation('موضوع ایمیل الزامی است');
    const [row] = await db.insert(notificationTemplates)
      .values({ tenantId: ctx.tenantId, key: b.key, channel: b.channel, subject: b.subject ?? null, body: b.body, providerTemplate: b.providerTemplate ?? null })
      .onConflictDoUpdate({ target: [notificationTemplates.tenantId, notificationTemplates.key, notificationTemplates.channel], set: { subject: b.subject ?? null, body: b.body, providerTemplate: b.providerTemplate ?? null, updatedAt: new Date() } })
      .returning();
    await audit(db, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'template.save', entity: 'notification_templates', entityId: row.id, after: b, ip: ctx.ip });
    return row;
  });

  app.delete('/api/v1/admin/templates/:id', async (req) => {
    const ctx = tenantCtx(req, A);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const [row] = await db.delete(notificationTemplates).where(and(eq(notificationTemplates.id, id), eq(notificationTemplates.tenantId, ctx.tenantId))).returning();
    if (!row) throw Errors.notFound('قالب');
    await audit(db, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'template.delete', entity: 'notification_templates', entityId: id, before: row, ip: ctx.ip });
    return { ok: true };
  });

  app.post('/api/v1/admin/templates/preview', async (req) => {
    tenantCtx(req, A);
    const { body } = z.object({ body: z.string().max(2000) }).parse(req.body);
    return { text: renderText(body, { tenant: 'دانشگاه نمونه', statusLabel: 'پذیرفته‌شده', status: 'accepted' }) };
  });
}
