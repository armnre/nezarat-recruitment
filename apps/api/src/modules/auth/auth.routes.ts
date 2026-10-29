import type { FastifyInstance } from 'fastify';
import { otpRequestSchema, otpVerifySchema, passwordLoginSchema } from '@nezarat/shared';
import type { Config } from '../../config.js';
import type { AuthService } from './auth.service.js';
import type { OtpService } from './otp.service.js';
import { csrfTokenFor, requireUser, SESSION_COOKIE, setSessionCookie } from '../../plugins/auth.js';

export function authRoutes(app: FastifyInstance, deps: { cfg: Config; auth: AuthService; otp: OtpService }) {
  const { cfg, auth, otp } = deps;
  const otpLimit = { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } };

  app.get('/api/v1/auth/csrf', async (req) => {
    // CSRF token is bound to the session; pre-login endpoints are exempt (no session to ride, SameSite + JSON-only).
    return { csrfToken: req.authUser ? csrfTokenFor(cfg, req.authUser.csrfSecret) : null };
  });

  app.post('/api/v1/auth/otp/request', otpLimit, async (req) => {
    const body = otpRequestSchema.parse(req.body);
    const tenant = await auth.tenantBySlug(body.tenantSlug);
    const { expiresIn, code } = await otp.request(tenant.id, body.mobile, req.ip);
    if (cfg.SMS_PROVIDER === 'mock' && cfg.NODE_ENV !== 'production') req.log.warn({ mobile: body.mobile, code }, 'MOCK OTP');
    return { expiresIn };
  });

  app.post('/api/v1/auth/otp/verify', otpLimit, async (req, reply) => {
    const body = otpVerifySchema.parse(req.body);
    const tenant = await auth.tenantBySlug(body.tenantSlug);
    await otp.verify(tenant.id, body.mobile, body.code);
    const user = await auth.findOrCreateApplicant(tenant.id, body.mobile);
    const s = await auth.createSession(user.id, req.ip, req.headers['user-agent']);
    setSessionCookie(reply, cfg, s.token, s.expiresAt);
    return { user: await auth.me(user.id), csrfToken: csrfTokenFor(cfg, s.csrfSecret) };
  });

  app.post('/api/v1/auth/login', { config: { rateLimit: { max: 10, timeWindow: '5 minutes' } } }, async (req, reply) => {
    const body = passwordLoginSchema.parse(req.body);
    const user = await auth.passwordLogin(body.email, body.password, body.tenantSlug);
    const s = await auth.createSession(user.id, req.ip, req.headers['user-agent']);
    setSessionCookie(reply, cfg, s.token, s.expiresAt);
    return { user: await auth.me(user.id), csrfToken: csrfTokenFor(cfg, s.csrfSecret) };
  });

  app.post('/api/v1/auth/logout', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await auth.destroySession(token);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/v1/auth/me', async (req) => auth.me(requireUser(req).id));

  app.get('/api/v1/public/tenants/:slug', async (req) => {
    const t = await auth.tenantBySlug((req.params as { slug: string }).slug);
    return { id: t.id, slug: t.slug, name: t.name };
  });
}
