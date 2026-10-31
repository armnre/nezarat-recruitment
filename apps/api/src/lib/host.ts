import type { FastifyRequest } from 'fastify';

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

/** نام میزبان معتبر (بدون پورت، حروف کوچک) یا null */
export function normalizeHostname(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const host = raw.trim().toLowerCase().replace(/\.$/, '').replace(/:\d+$/, '');
  return HOSTNAME_RE.test(host) ? host : null;
}

/**
 * میزبان درخواست. Fastify با trustProxy محدود به TRUSTED_PROXY_IPS فقط وقتی
 * X-Forwarded-Host را در req.hostname می‌گذارد که درخواست از nginx محلی آمده باشد؛
 * در غیر این صورت هدر Host خود اتصال استفاده می‌شود.
 */
export function requestHostname(req: FastifyRequest): string | null {
  const raw = req.hostname;
  // اگر چند مقدار با کاما آمده باشد (زنجیرهٔ پراکسی)، اولی که nginx گذاشته معتبر است
  return normalizeHostname(raw.split(',')[0]);
}
