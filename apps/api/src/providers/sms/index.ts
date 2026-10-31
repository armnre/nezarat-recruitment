import type { Config } from '../../config.js';
import { IppanelProvider, parseIppanelDelivery } from './ippanel.js';
import { KavenegarProvider, parseKavenegarDelivery } from './kavenegar.js';
import { MelipayamakProvider, parseMelipayamakDelivery } from './melipayamak.js';
import { MockSmsProvider } from './mock.js';
import type { DeliveryReport, FetchFn, SmsProvider } from './types.js';

export * from './types.js';
export { MockSmsProvider } from './mock.js';

function need(cfg: Config, key: keyof Config): string {
  const v = cfg[key];
  if (typeof v !== 'string' || !v) throw new Error(`متغیر محیطی ${String(key)} برای ارائه‌دهندهٔ پیامک ${cfg.SMS_PROVIDER} الزامی است`);
  return v;
}

export function createSmsProvider(cfg: Config, fetchFn: FetchFn = fetch, log?: (m: string, d: object) => void): SmsProvider {
  switch (cfg.SMS_PROVIDER) {
    case 'kavenegar':
      return new KavenegarProvider({ apiKey: need(cfg, 'KAVENEGAR_API_KEY'), sender: cfg.KAVENEGAR_SENDER, otpTemplate: need(cfg, 'KAVENEGAR_OTP_TEMPLATE') }, fetchFn);
    case 'melipayamak':
      return new MelipayamakProvider({ username: need(cfg, 'MELIPAYAMAK_USERNAME'), password: need(cfg, 'MELIPAYAMAK_PASSWORD'), sender: cfg.MELIPAYAMAK_SENDER, otpBodyId: need(cfg, 'MELIPAYAMAK_OTP_BODY_ID') }, fetchFn);
    case 'ippanel':
      return new IppanelProvider({ apiKey: need(cfg, 'IPPANEL_API_KEY'), sender: need(cfg, 'IPPANEL_SENDER'), otpPattern: need(cfg, 'IPPANEL_OTP_PATTERN') }, fetchFn);
    case 'mock':
      if (cfg.NODE_ENV === 'production') throw new Error('حالت mock پیامک در production مجاز نیست');
      return new MockSmsProvider(log);
  }
}

export const deliveryParsers: Record<string, (body: Record<string, unknown>) => DeliveryReport[]> = {
  kavenegar: parseKavenegarDelivery,
  melipayamak: parseMelipayamakDelivery,
  farapayamak: parseMelipayamakDelivery,
  ippanel: parseIppanelDelivery,
};
