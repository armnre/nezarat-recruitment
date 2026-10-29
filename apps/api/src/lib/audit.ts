import type { Db } from '../db/client.js';
import { auditLogs } from '../db/schema.js';

export async function audit(
  db: Db,
  e: { tenantId: string | null; actorId: string | null; action: string; entity: string; entityId?: string; before?: unknown; after?: unknown; ip?: string },
) {
  await db.insert(auditLogs).values({
    tenantId: e.tenantId, actorId: e.actorId, action: e.action, entity: e.entity,
    entityId: e.entityId, before: e.before ?? null, after: e.after ?? null, ip: e.ip,
  });
}
