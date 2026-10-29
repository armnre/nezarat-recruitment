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
  UPLOAD_DIR: z.string().default('/var/lib/nezarat/uploads'),
  MAX_UPLOAD_MB: z.coerce.number().default(10),
  SMS_PROVIDER: z.enum(['kavenegar', 'melipayamak', 'ippanel', 'mock']).default('mock'),
  SMS_WEBHOOK_TOKEN: z.string().optional(),
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
