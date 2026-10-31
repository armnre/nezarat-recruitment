import { readJson, SmsError, type DeliveryReport, type FetchFn, type SmsProvider } from './types.js';

type MeliResponse = { Value?: string; RetStatus?: number; StrRetStatus?: string };

/** ملی‌پیامک / فراپیامک (وب‌سرویس REST مشترک rest.payamak-panel.com). */
export class MelipayamakProvider implements SmsProvider {
  readonly name = 'melipayamak';
  constructor(
    private opts: { username: string; password: string; sender?: string; otpBodyId: string },
    private fetchFn: FetchFn = fetch,
  ) {}

  private async call(path: string, params: Record<string, string>) {
    const res = await this.fetchFn(`https://rest.payamak-panel.com/api/SendSMS/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: this.opts.username, password: this.opts.password, ...params }),
    });
    const json = (await readJson(res, this.name)) as MeliResponse;
    // موفقیت: RetStatus=1 و Value شناسهٔ پیام (عدد بلند)
    if (json.RetStatus !== 1 || !json.Value || json.Value.length < 5) {
      throw new SmsError(this.name, json.StrRetStatus ?? `کد ${json.Value ?? json.RetStatus}`);
    }
    return { messageId: json.Value };
  }

  sendOtp(mobile: string, code: string) {
    return this.call('BaseServiceNumber', { to: mobile, bodyId: this.opts.otpBodyId, text: code });
  }

  sendText(mobile: string, text: string) {
    if (!this.opts.sender) throw new SmsError(this.name, 'MELIPAYAMAK_SENDER تنظیم نشده است');
    return this.call('SendSMS', { to: mobile, from: this.opts.sender, text, isFlash: 'false' });
  }
}

/** گزارش تحویل: recId + status (1 = رسیده، 2 = نرسیده). */
export function parseMelipayamakDelivery(body: Record<string, unknown>): DeliveryReport[] {
  const id = body.recId ?? body.RecId ?? body.messageId;
  if (id == null) return [];
  const s = Number(body.status ?? body.Status);
  const status = s === 1 ? 'delivered' : s === 2 || s === 3 ? 'failed' : 'sent';
  return [{ messageId: String(id), status, error: status === 'failed' ? `status ${s}` : undefined }];
}
