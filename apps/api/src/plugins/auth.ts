import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { RoleKey } from '@nezarat/shared';
import type { AuthService } from '../modules/auth/auth.service.js';
import type { Config } from '../config.js';
import { hmac, safeEqual } from '../lib/crypto.js';
import { Errors } from '../lib/errors.js';
import type { TenantContext } from '../lib/tenant.js';

export const SESSION_COOKIE = 'sid';

export interface AuthUser {
  id: string;
  tenantId: string | null;
  roles: RoleKey[];
  permissions: string[];
  csrfSecret: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser | null;
  }
}

export const csrfTokenFor = (cfg: Config, csrfSecret: string) => hmac(cfg.SESSION_SECRET, `csrf:${csrfSecret}`);

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT = [/^\/api\/v1\/webhooks\//, /^\/api\/v1\/auth\/(otp\/request|otp\/verify|login)$/];

export function registerAuth(app: FastifyInstance, auth: AuthService, cfg: Config) {
  app.decorateRequest('authUser', null);

  app.addHook('preHandler', async (req) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) {
      const s = await auth.resolveSession(token);
      if (s) {
        req.authUser = { id: s.user.id, tenantId: s.user.tenantId, roles: s.roles, permissions: s.permissions, csrfSecret: s.session.csrfSecret };
      }
    }
    const path = req.url.split('?')[0];
    if (!SAFE.has(req.method) && req.authUser && !CSRF_EXEMPT.some((r) => r.test(path))) {
      const header = req.headers['x-csrf-token'];
      if (typeof header !== 'string' || !safeEqual(header, csrfTokenFor(cfg, req.authUser.csrfSecret))) throw Errors.csrf();
    }
  });
}

export function setSessionCookie(reply: FastifyReply, cfg: Config, token: string, expiresAt: Date) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true, secure: cfg.COOKIE_SECURE, sameSite: 'lax', path: '/', expires: expiresAt,
  });
}

export function requireUser(req: FastifyRequest): AuthUser {
  if (!req.authUser) throw Errors.unauthorized();
  return req.authUser;
}

/** context لایهٔ service برای کاربران tenant؛ سوپرادمین اینجا مجاز نیست. */
export function tenantCtx(req: FastifyRequest, ...anyRole: RoleKey[]): TenantContext {
  const u = requireUser(req);
  if (!u.tenantId) throw Errors.forbidden();
  if (anyRole.length && !anyRole.some((r) => u.roles.includes(r))) throw Errors.forbidden();
  return { tenantId: u.tenantId, userId: u.id, roles: u.roles, permissions: u.permissions, ip: req.ip };
}

export function requireSuperAdmin(req: FastifyRequest): AuthUser {
  const u = requireUser(req);
  if (!u.roles.includes('super_admin') || u.tenantId) throw Errors.forbidden();
  return u;
}
