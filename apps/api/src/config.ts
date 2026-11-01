import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3102),
  HOST: z.string().default('127.0.0.1'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL الزامی است'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET باید حداقل ۳۲ کاراکتر باشد'),
  SESSION_TTL_HOURS: z.coerce.number().default(12),
  COOKIE_SECURE: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  TRUST_PROXY: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  /** فقط درخواست‌هایی که از این IPها (nginx محلی) برسند می‌توانند X-Forwarded-* را تعیین کنند */
  TRUSTED_PROXY_IPS: z.string().default('127.0.0.1,::1')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
  UPLOAD_DIR: z.string().default('/var/lib/nezarat/uploads'),
  MAX_UPLOAD_MB: z.coerce.number().default(10),
  SMS_PROVIDER: z.enum(['kavenegar', 'melipayamak', 'ippanel', 'mock', 'disabled']).default('mock'),
  OTP_AUTH_ENABLED: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  SMS_WEBHOOK_TOKEN: z.string().optional(),
  KAVENEGAR_API_KEY: z.string().optional(),
  KAVENEGAR_SENDER: z.string().optional(),
  KAVENEGAR_OTP_TEMPLATE: z.string().optional(),
  MELIPAYAMAK_USERNAME: z.string().optional(),
  MELIPAYAMAK_PASSWORD: z.string().optional(),
  MELIPAYAMAK_SENDER: z.string().optional(),
  MELIPAYAMAK_OTP_BODY_ID: z.string().optional(),
  IPPANEL_API_KEY: z.string().optional(),
  IPPANEL_SENDER: z.string().optional(),
  IPPANEL_OTP_PATTERN: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  WORKER_POLL_MS: z.coerce.number().default(2000),
  WORKER_BATCH: z.coerce.number().default(10),
  WORKER_STALE_MINUTES: z.coerce.number().default(10),
  OTP_TTL_SECONDS: z.coerce.number().default(120),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  OTP_LOCK_MINUTES: z.coerce.number().default(15),
  OTP_MAX_PER_MOBILE_10MIN: z.coerce.number().default(3),
  OTP_MAX_PER_IP_10MIN: z.coerce.number().default(10),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`پیکربندی محیطی نامعتبر است:\n${msg}`);
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.SMS_PROVIDER === 'mock') {
    throw new Error('حالت mock پیامک در production مجاز نیست');
  }
  return parsed.data;
}
