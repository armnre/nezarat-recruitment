import { readJson, SmsError, type DeliveryReport, type FetchFn, type SmsProvider } from './types.js';

type KavResponse = { return?: { status?: number; message?: string }; entries?: { messageid?: number | string }[] };

export class KavenegarProvider implements SmsProvider {
  readonly name = 'kavenegar';
  constructor(private opts: { apiKey: string; sender?: string; otpTemplate: string }, private fetchFn: FetchFn = fetch) {}

  private async call(method: string, params: Record<string, string>) {
    const url = `https://api.kavenegar.com/v1/${encodeURIComponent(this.opts.apiKey)}/${method}.json`;
    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
    const json = (await readJson(res, this.name)) as KavResponse;
    if (json.return?.status !== 200) throw new SmsError(this.name, json.return?.message ?? `HTTP ${res.status}`);
    const id = json.entries?.[0]?.messageid;
    return { messageId: id != null ? String(id) : null };
  }

  sendOtp(mobile: string, code: string) {
    return this.call('verify/lookup', { receptor: mobile, token: code, template: this.opts.otpTemplate });
  }

  sendText(mobile: string, text: string) {
    const p: Record<string, string> = { receptor: mobile, message: text };
    if (this.opts.sender) p.sender = this.opts.sender;
    return this.call('sms/send', p);
  }
}

/** کاوه‌نگار: messageid + status (10 = رسیده، 11 = نرسیده، 6/14/100 = خطا). */
export function parseKavenegarDelivery(body: Record<string, unknown>): DeliveryReport[] {
  const id = body.messageid ?? body.messageId;
  if (id == null) return [];
  const s = Number(body.status);
  const status = s === 10 ? 'delivered' : [6, 11, 13, 14, 100].includes(s) ? 'failed' : 'sent';
  return [{ messageId: String(id), status, error: status === 'failed' ? `status ${s}` : undefined }];
}
