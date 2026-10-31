import { readJson, SmsError, type DeliveryReport, type FetchFn, type SmsProvider } from './types.js';

type IpResponse = { status?: string; code?: number | string; error_message?: string; data?: { message_id?: number | string } };

export class IppanelProvider implements SmsProvider {
  readonly name = 'ippanel';
  constructor(private opts: { apiKey: string; sender: string; otpPattern: string }, private fetchFn: FetchFn = fetch) {}

  private async call(path: string, body: unknown) {
    const res = await this.fetchFn(`https://api2.ippanel.com/api/v1/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: this.opts.apiKey },
      body: JSON.stringify(body),
    });
    const json = (await readJson(res, this.name)) as IpResponse;
    if (!res.ok || json.status !== 'OK') throw new SmsError(this.name, json.error_message ?? `HTTP ${res.status}`);
    const id = json.data?.message_id;
    return { messageId: id != null ? String(id) : null };
  }

  sendOtp(mobile: string, code: string) {
    return this.call('sms/pattern/normal/send', { code: this.opts.otpPattern, sender: this.opts.sender, recipient: mobile, variable: { code } });
  }

  sendText(mobile: string, text: string) {
    return this.call('sms/send/webservice/single', { recipient: [mobile], sender: this.opts.sender, message: text });
  }
}

export function parseIppanelDelivery(body: Record<string, unknown>): DeliveryReport[] {
  const id = body.message_id ?? body.messageId ?? body.bulk_id;
  if (id == null) return [];
  const s = String(body.status ?? '').toLowerCase();
  const status = s === 'delivered' || s === '1' ? 'delivered' : ['failed', 'undelivered', 'blocked', '2'].includes(s) ? 'failed' : 'sent';
  return [{ messageId: String(id), status, error: status === 'failed' ? s : undefined }];
}
