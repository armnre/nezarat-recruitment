import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { otpCodes } from '../../db/schema.js';
import type { Config } from '../../config.js';
import { hmac, otpCode, safeEqual } from '../../lib/crypto.js';
import { Errors } from '../../lib/errors.js';
import { enqueue } from '../../lib/queue.js';

const TEN_MIN = 10 * 60 * 1000;

export class OtpService {
  constructor(private db: Db, private cfg: Config, private now: () => Date = () => new Date()) {}

  private hash(tenantId: string, mobile: string, code: string) {
    return hmac(this.cfg.SESSION_SECRET, `${tenantId}:${mobile}:${code}`);
  }

  async request(tenantId: string, mobile: string, ip: string) {
    const now = this.now();
    const since = new Date(now.getTime() - TEN_MIN);

    const [latest] = await this.db.select().from(otpCodes)
      .where(and(eq(otpCodes.tenantId, tenantId), eq(otpCodes.mobile, mobile)))
      .orderBy(desc(otpCodes.createdAt)).limit(1);
    if (latest?.lockedUntil && latest.lockedUntil > now) {
      throw Errors.tooMany('به‌دلیل تلاش‌های ناموفق، این شماره موقتاً قفل شده است');
    }

    const [{ byMobile }] = await this.db.select({ byMobile: sql<number>`count(*)::int` }).from(otpCodes)
      .where(and(eq(otpCodes.tenantId, tenantId), eq(otpCodes.mobile, mobile), gte(otpCodes.createdAt, since)));
    if (byMobile >= this.cfg.OTP_MAX_PER_MOBILE_10MIN) throw Errors.tooMany('تعداد درخواست کد برای این شماره بیش از حد مجاز است');

    const [{ byIp }] = await this.db.select({ byIp: sql<number>`count(*)::int` }).from(otpCodes)
      .where(and(eq(otpCodes.ip, ip), gte(otpCodes.createdAt, since)));
    if (byIp >= this.cfg.OTP_MAX_PER_IP_10MIN) throw Errors.tooMany();

    const code = otpCode();
    await this.db.insert(otpCodes).values({
      tenantId, mobile, ip, codeHash: this.hash(tenantId, mobile, code),
      expiresAt: new Date(now.getTime() + this.cfg.OTP_TTL_SECONDS * 1000), createdAt: now,
    });
    await enqueue(this.db, 'sms.otp', { mobile, code }, { tenantId });
    return { expiresIn: this.cfg.OTP_TTL_SECONDS, code };
  }

  async verify(tenantId: string, mobile: string, code: string) {
    const now = this.now();
    const [row] = await this.db.select().from(otpCodes)
      .where(and(eq(otpCodes.tenantId, tenantId), eq(otpCodes.mobile, mobile), isNull(otpCodes.consumedAt)))
      .orderBy(desc(otpCodes.createdAt)).limit(1);
    if (!row) throw Errors.validation('کد تأیید یافت نشد؛ دوباره درخواست کد دهید');
    if (row.lockedUntil && row.lockedUntil > now) throw Errors.tooMany('این شماره موقتاً قفل شده است');
    if (row.expiresAt < now) throw Errors.validation('کد تأیید منقضی شده است');

    if (!safeEqual(row.codeHash, this.hash(tenantId, mobile, code))) {
      const attempts = row.attempts + 1;
      const lock = attempts >= this.cfg.OTP_MAX_ATTEMPTS ? new Date(now.getTime() + this.cfg.OTP_LOCK_MINUTES * 60000) : null;
      await this.db.update(otpCodes).set({ attempts, lockedUntil: lock }).where(eq(otpCodes.id, row.id));
      throw lock ? Errors.tooMany('تعداد تلاش ناموفق زیاد بود؛ ۱۵ دقیقه دیگر تلاش کنید') : Errors.validation('کد تأیید نادرست است');
    }
    await this.db.update(otpCodes).set({ consumedAt: now }).where(eq(otpCodes.id, row.id));
  }
}
