import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Config } from '../../config.js';
import type { Db } from '../../db/client.js';
import { smsLogs } from '../../db/schema.js';
import { safeEqual } from '../../lib/crypto.js';
import { deliveryParsers } from '../../providers/sms/index.js';

export function webhookRoutes(app: FastifyInstance, deps: { cfg: Config; db: Db }) {
  app.post<{ Params: { provider: string }; Querystring: { token?: string } }>('/api/v1/webhooks/sms/:provider', async (req, reply) => {
    const expected = deps.cfg.SMS_WEBHOOK_TOKEN;
    const given = req.query.token ?? String(req.headers['x-webhook-token'] ?? '');
    if (!expected || !given || !safeEqual(given, expected)) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'توکن webhook نامعتبر است' } });
    }
    const parse = deliveryParsers[req.params.provider];
    if (!parse) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'ارائه‌دهندهٔ پیامک ناشناخته است' } });
    const provider = req.params.provider === 'farapayamak' ? 'melipayamak' : req.params.provider;
    const raw = req.body;
    const items = (Array.isArray(raw) ? raw : [raw ?? {}]) as Record<string, unknown>[];
    let updated = 0;
    for (const item of items) {
      for (const r of parse(item)) {
        const res = await deps.db.update(smsLogs).set({ status: r.status, error: r.error ?? null, updatedAt: new Date() })
          .where(and(eq(smsLogs.provider, provider), eq(smsLogs.providerMessageId, r.messageId)));
        updated += res.rowCount ?? 0;
      }
    }
    return { updated };
  });
}
