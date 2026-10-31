import { randomUUID } from 'node:crypto';
import type { SmsProvider } from './types.js';

export interface SentMessage { mobile: string; kind: 'otp' | 'text'; body: string; messageId: string }

/** فقط برای توسعه و تست؛ در production ساخته نمی‌شود. */
export class MockSmsProvider implements SmsProvider {
  readonly name = 'mock';
  readonly sent: SentMessage[] = [];
  constructor(private log: (msg: string, data: object) => void = () => {}) {}

  async sendOtp(mobile: string, code: string) {
    const messageId = randomUUID();
    this.sent.push({ mobile, kind: 'otp', body: code, messageId });
    this.log('MOCK SMS OTP', { mobile, code });
    return { messageId };
  }

  async sendText(mobile: string, text: string) {
    const messageId = randomUUID();
    this.sent.push({ mobile, kind: 'text', body: text, messageId });
    this.log('MOCK SMS', { mobile, text });
    return { messageId };
  }
}
