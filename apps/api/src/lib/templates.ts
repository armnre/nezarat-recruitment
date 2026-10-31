import { and, eq } from 'drizzle-orm';
import { STATUS_LABELS_FA, type ApplicationStatus } from '@nezarat/shared';
import type { Db } from '../db/client.js';
import { notificationTemplates, tenants } from '../db/schema.js';

export type Channel = 'sms' | 'email';
export interface Rendered { subject: string; body: string }

/** قالب‌های پیش‌فرض؛ دانشگاه می‌تواند هر کلید را در notification_templates بازنویسی کند. */
export const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  status: { subject: 'تغییر وضعیت پرونده', body: '{{tenant}}: وضعیت پروندهٔ شما به «{{statusLabel}}» تغییر کرد.' },
  'committee.assigned': { subject: 'پرونده جدید برای ارزیابی', body: '{{tenant}}: یک پرونده برای ارزیابی به شما تخصیص داده شد.' },
  'committee.due': { subject: 'یادآوری مهلت ارزیابی', body: '{{tenant}}: مهلت ارزیابی پرونده تخصیص‌یافته فردا به پایان می‌رسد.' },
};

export function renderText(tpl: string, params: Record<string, unknown>) {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => (params[k] == null ? '' : String(params[k])));
}

export async function renderTemplate(db: Db, tenantId: string | null, key: string, channel: Channel, params: Record<string, unknown>): Promise<Rendered> {
  const p: Record<string, unknown> = { ...params };
  if (typeof p.status === 'string') p.statusLabel = STATUS_LABELS_FA[p.status as ApplicationStatus] ?? p.status;
  let custom: { subject: string | null; body: string } | undefined;
  if (tenantId) {
    const [t] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, tenantId));
    p.tenant ??= t?.name ?? '';
    [custom] = await db.select({ subject: notificationTemplates.subject, body: notificationTemplates.body }).from(notificationTemplates)
      .where(and(eq(notificationTemplates.tenantId, tenantId), eq(notificationTemplates.key, key), eq(notificationTemplates.channel, channel)));
  }
  const fallback = DEFAULT_TEMPLATES[key] ?? (key.startsWith('status.') ? DEFAULT_TEMPLATES.status : undefined);
  const tpl = custom ?? fallback;
  if (!tpl) throw new Error(`قالب «${key}» برای کانال ${channel} تعریف نشده است`);
  return { subject: renderText(tpl.subject ?? fallback?.subject ?? '', p), body: renderText(tpl.body, p) };
}
