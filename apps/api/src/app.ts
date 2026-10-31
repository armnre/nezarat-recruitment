import { AdminService } from './modules/admin/service.js';
import { adminRoutes } from './modules/admin/routes.js';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { ZodError } from 'zod';
import type { Config } from './config.js';
import type { Db } from './db/client.js';
import { AppError } from './lib/errors.js';
import { registerAuth } from './plugins/auth.js';
import { AuthService } from './modules/auth/auth.service.js';
import { OtpService } from './modules/auth/otp.service.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { ApplicationService } from './modules/applications/service.js';
import { applicationRoutes } from './modules/applications/routes.js';
import { ProfileService } from './modules/profile/service.js';
import { profileRoutes } from './modules/profile/routes.js';
import { CallsService } from './modules/calls/calls.service.js';
import { callRoutes } from './modules/calls/routes.js';
import { DocumentService } from './modules/documents/service.js';
import { documentRoutes } from './modules/documents/routes.js';
import { CommitteeService } from './modules/committee/service.js';
import { committeeRoutes } from './modules/committee/routes.js';
import { webhookRoutes } from './modules/webhooks/routes.js';
import { PlatformService } from './modules/platform/service.js';
import { platformRoutes } from './modules/platform/routes.js';
import { templateRoutes } from './modules/templates/routes.js';

export async function buildApp(cfg: Config, db: Db, opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false, trustProxy: cfg.TRUST_PROXY ? cfg.TRUSTED_PROXY_IPS : false, bodyLimit: 1_048_576 });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'], fontSrc: ["'self'"], connectSrc: ["'self'"],
      },
    },
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(multipart, { limits: { fileSize: cfg.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 5 } });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: { code: 'VALIDATION', message: err.issues[0]?.message ?? 'اطلاعات ورودی نامعتبر است' } });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 429) return reply.status(429).send({ error: { code: 'RATE_LIMIT', message: 'تعداد درخواست‌ها بیش از حد مجاز است؛ کمی بعد تلاش کنید' } });
    if (status && status < 500) return reply.status(status).send({ error: { code: 'BAD_REQUEST', message: 'درخواست نامعتبر است' } });
    req.log.error(err);
    return reply.status(500).send({ error: { code: 'INTERNAL', message: 'خطای داخلی سرور؛ لطفاً بعداً تلاش کنید' } });
  });

  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => {
    done(null, Object.fromEntries(new URLSearchParams(String(body))));
  });

  app.get('/api/health', async () => ({ status: 'ok' }));
  webhookRoutes(app, { cfg, db });

  const auth = new AuthService(db, cfg);
  registerAuth(app, auth, cfg);
  authRoutes(app, { cfg, auth, otp: new OtpService(db, cfg) });
  const applications = new ApplicationService(db);
  const profiles = new ProfileService(db);
  applicationRoutes(app, { service: applications });
  profileRoutes(app, { service: profiles });
  committeeRoutes(app, { service: new CommitteeService(db, applications, profiles) });
  adminRoutes(app, { service: new AdminService(db) });
  callRoutes(app, { service: new CallsService(db) });
  platformRoutes(app, { service: new PlatformService(db) });
  templateRoutes(app, { db });
  documentRoutes(app, { service: new DocumentService(db, cfg.UPLOAD_DIR, cfg.MAX_UPLOAD_MB) });

  return app;
}
