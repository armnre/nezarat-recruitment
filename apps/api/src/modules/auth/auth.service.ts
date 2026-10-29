import argon2 from 'argon2';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { MeResponse, RoleKey } from '@nezarat/shared';
import type { Db } from '../../db/client.js';
import { permissions, rolePermissions, roles, sessions, tenants, userRoles, users } from '../../db/schema.js';
import type { Config } from '../../config.js';
import { randomToken, sha256 } from '../../lib/crypto.js';
import { Errors } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';

export class AuthService {
  constructor(private db: Db, private cfg: Config) {}

  async tenantBySlug(slug: string) {
    const [t] = await this.db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
    if (!t || t.status !== 'active') throw Errors.notFound('دانشگاه');
    return t;
  }

  /** پس از تأیید OTP: یافتن یا ساخت کاربر متقاضی در همان tenant. */
  async findOrCreateApplicant(tenantId: string, mobile: string) {
    const [existing] = await this.db.select().from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.mobile, mobile), isNull(users.deletedAt))).limit(1);
    if (existing) return existing;
    const [u] = await this.db.insert(users).values({ tenantId, mobile }).returning();
    const [role] = await this.db.select().from(roles).where(eq(roles.key, 'applicant')).limit(1);
    if (role) await this.db.insert(userRoles).values({ tenantId, userId: u.id, roleId: role.id });
    await audit(this.db, { tenantId, actorId: u.id, action: 'user.register', entity: 'users', entityId: u.id });
    return u;
  }

  async passwordLogin(email: string, password: string, tenantSlug?: string) {
    const tenantId = tenantSlug ? (await this.tenantBySlug(tenantSlug)).id : null;
    const [u] = await this.db.select().from(users)
      .where(and(eq(users.email, email.toLowerCase()), tenantId ? eq(users.tenantId, tenantId) : isNull(users.tenantId), isNull(users.deletedAt)))
      .limit(1);
    // در صورت نبود کاربر هم argon2 اجرا می‌شود تا زمان پاسخ افشاگر نباشد
    const ok = await argon2.verify(u?.passwordHash ?? '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG', password).catch(() => false);
    if (!u || !u.passwordHash || !ok || u.status !== 'active') throw new (await import('../../lib/errors.js')).AppError(401, 'BAD_CREDENTIALS', 'ایمیل یا رمز عبور نادرست است');
    return u;
  }

  async createSession(userId: string, ip?: string, userAgent?: string) {
    const token = randomToken();
    const csrfSecret = randomToken(24);
    const expiresAt = new Date(Date.now() + this.cfg.SESSION_TTL_HOURS * 3600_000);
    await this.db.insert(sessions).values({ userId, tokenHash: sha256(token), csrfSecret, expiresAt, ip, userAgent });
    await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
    return { token, csrfSecret, expiresAt };
  }

  async resolveSession(token: string) {
    const [row] = await this.db.select({ session: sessions, user: users }).from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date()), isNull(users.deletedAt)))
      .limit(1);
    if (!row || row.user.status !== 'active') return null;
    const access = await this.loadAccess(row.user.id);
    return { ...row, ...access };
  }

  async destroySession(token: string) {
    await this.db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }

  async loadAccess(userId: string) {
    const rows = await this.db.select({ role: roles.key, perm: permissions.key }).from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(userRoles.userId, userId));
    return {
      roles: [...new Set(rows.map((r) => r.role as RoleKey))],
      permissions: [...new Set(rows.map((r) => r.perm).filter((p): p is string => !!p))],
    };
  }

  async me(userId: string): Promise<MeResponse> {
    const [row] = await this.db.select({ u: users, t: tenants }).from(users)
      .leftJoin(tenants, eq(tenants.id, users.tenantId)).where(eq(users.id, userId)).limit(1);
    const access = await this.loadAccess(userId);
    return {
      id: row.u.id, fullName: row.u.fullName, mobile: row.u.mobile, email: row.u.email,
      tenant: row.t ? { id: row.t.id, slug: row.t.slug, name: row.t.name } : null, ...access,
    };
  }
}
