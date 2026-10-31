import { describe, expect, it, vi } from 'vitest';
import { KavenegarProvider, parseKavenegarDelivery } from '../src/providers/sms/kavenegar.js';
import { MelipayamakProvider, parseMelipayamakDelivery } from '../src/providers/sms/melipayamak.js';
import { IppanelProvider, parseIppanelDelivery } from '../src/providers/sms/ippanel.js';
import { createSmsProvider } from '../src/providers/sms/index.js';
import { loadConfig } from '../src/config.js';
import { backoffMs } from '../src/jobs/processor.js';
import { renderText } from '../src/lib/templates.js';

const respond = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
const base = { DATABASE_URL: 'postgres://x', SESSION_SECRET: 'x'.repeat(48) };

describe('SmsProvider (HTTP mock)', () => {
  it('Kavenegar: OTP با verify/lookup و الگو', async () => {
    const f = respond({ return: { status: 200 }, entries: [{ messageid: 123 }] });
    const p = new KavenegarProvider({ apiKey: 'KEY', otpTemplate: 'otp-tpl' }, f);
    expect(await p.sendOtp('09120000000', '123456')).toEqual({ messageId: '123' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.kavenegar.com/v1/KEY/verify/lookup.json');
    expect(String(init.body)).toContain('template=otp-tpl');
    expect(String(init.body)).toContain('token=123456');
  });

  it('Kavenegar: خطای ارائه‌دهنده پرتاب می‌شود', async () => {
    const p = new KavenegarProvider({ apiKey: 'K', otpTemplate: 't' }, respond({ return: { status: 418, message: 'credit' } }));
    await expect(p.sendText('0912', 'hi')).rejects.toThrow('credit');
  });

  it('Melipayamak: BaseServiceNumber با bodyId', async () => {
    const f = respond({ Value: '5432109876543210', RetStatus: 1, StrRetStatus: 'Ok' });
    const p = new MelipayamakProvider({ username: 'u', password: 'p', otpBodyId: '777' }, f);
    expect(await p.sendOtp('0912', '111222')).toEqual({ messageId: '5432109876543210' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/BaseServiceNumber');
    expect(JSON.parse(String(init.body))).toMatchObject({ bodyId: '777', text: '111222', to: '0912' });
  });

  it('Melipayamak: کد خطای کوتاه = شکست', async () => {
    const p = new MelipayamakProvider({ username: 'u', password: 'p', otpBodyId: '1', sender: '3000' }, respond({ Value: '11', RetStatus: 0, StrRetStatus: 'InvalidData' }));
    await expect(p.sendText('0912', 'x')).rejects.toThrow('InvalidData');
  });

  it('IPPanel: pattern با هدر apikey', async () => {
    const f = respond({ status: 'OK', data: { message_id: 99 } });
    const p = new IppanelProvider({ apiKey: 'AK', sender: '+983000', otpPattern: 'pat' }, f);
    expect(await p.sendOtp('0912', '000111')).toEqual({ messageId: '99' });
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).apikey).toBe('AK');
    expect(JSON.parse(String(init.body)).variable).toEqual({ code: '000111' });
  });

  it('پارس گزارش تحویل', () => {
    expect(parseKavenegarDelivery({ messageid: '5', status: '10' })[0].status).toBe('delivered');
    expect(parseKavenegarDelivery({ messageid: '5', status: '11' })[0].status).toBe('failed');
    expect(parseMelipayamakDelivery({ recId: '9', status: '1' })[0].status).toBe('delivered');
    expect(parseIppanelDelivery({ message_id: 3, status: 'undelivered' })[0].status).toBe('failed');
  });

  it('mock در production ساخته نمی‌شود و کلید ناقص خطا می‌دهد', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', SMS_PROVIDER: 'mock' })).toThrow();
    const cfg = loadConfig({ ...base, NODE_ENV: 'development', SMS_PROVIDER: 'kavenegar' });
    expect(() => createSmsProvider(cfg)).toThrow('KAVENEGAR_API_KEY');
  });
});

describe('ابزارهای worker', () => {
  it('backoff نمایی با سقف', () => {
    expect([1, 2, 3, 4].map(backoffMs)).toEqual([30000, 60000, 120000, 240000]);
    expect(backoffMs(20)).toBe(3600000);
  });
  it('رندر قالب', () => {
    expect(renderText('سلام {{name}} {{ x }}', { name: 'علی' })).toBe('سلام علی ');
  });
});
