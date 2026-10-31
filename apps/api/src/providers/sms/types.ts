export type FetchFn = typeof fetch;

export interface SmsSendResult {
  messageId: string | null;
}

export type DeliveryStatus = 'sent' | 'delivered' | 'failed';

export interface DeliveryReport {
  messageId: string;
  status: DeliveryStatus;
  error?: string;
}

/** رابط واحد همهٔ ارائه‌دهندگان پیامک. */
export interface SmsProvider {
  readonly name: string;
  /** ارسال OTP با الگو (Pattern) روی خط اختصاصی. */
  sendOtp(mobile: string, code: string): Promise<SmsSendResult>;
  /** ارسال پیامک اطلاع‌رسانی متنی (متن از قالب‌های notification_templates). */
  sendText(mobile: string, text: string): Promise<SmsSendResult>;
}

export class SmsError extends Error {
  constructor(provider: string, message: string) {
    super(`[${provider}] ${message}`);
  }
}

export async function readJson(res: Response, provider: string): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new SmsError(provider, `پاسخ نامعتبر (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
}
