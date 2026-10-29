import { and, eq, isNull, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { RoleKey } from '@nezarat/shared';
import { Errors } from './errors.js';

/** هر فراخوانی لایهٔ service این context را می‌گیرد؛ tenantId از نشست می‌آید، نه از ورودی کاربر. */
export interface TenantContext {
  tenantId: string;
  userId: string;
  roles: RoleKey[];
  permissions: string[];
  ip?: string;
}

/** شرط اجباری tenant (+ حذف نرم در صورت وجود) که باید در هر query لایهٔ service استفاده شود. */
export function scoped(
  ctx: TenantContext,
  table: { tenantId: PgColumn; deletedAt?: PgColumn },
  ...extra: (SQL | undefined)[]
): SQL {
  const conds: (SQL | undefined)[] = [eq(table.tenantId, ctx.tenantId), ...extra];
  if (table.deletedAt) conds.push(isNull(table.deletedAt));
  return and(...conds)!;
}

export function requirePermission(ctx: TenantContext, perm: string) {
  if (!ctx.permissions.includes(perm)) throw Errors.forbidden();
}
