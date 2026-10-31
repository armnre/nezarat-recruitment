import nodemailer from 'nodemailer';
import type { Config } from '../config.js';

export interface MailMessage { to: string; subject: string; text: string; html?: string }
export interface Mailer { send(msg: MailMessage): Promise<{ messageId: string | null }> }

export class SmtpMailer implements Mailer {
  private transport: nodemailer.Transporter;
  constructor(private cfg: { host: string; port: number; user?: string; pass?: string; from: string }) {
    this.transport = nodemailer.createTransport({
      host: cfg.host, port: cfg.port, secure: cfg.port === 465,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass ?? '' } : undefined,
    });
  }
  async send(msg: MailMessage) {
    const info = await this.transport.sendMail({ from: this.cfg.from, ...msg });
    return { messageId: info.messageId ?? null };
  }
}

export class MockMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  constructor(private log: (m: string, d: object) => void = () => {}) {}
  async send(msg: MailMessage) {
    this.sent.push(msg);
    this.log('MOCK EMAIL', { to: msg.to, subject: msg.subject });
    return { messageId: null };
  }
}

export function createMailer(cfg: Config, log?: (m: string, d: object) => void): Mailer {
  if (cfg.SMTP_HOST && cfg.SMTP_FROM) {
    return new SmtpMailer({ host: cfg.SMTP_HOST, port: cfg.SMTP_PORT, user: cfg.SMTP_USER, pass: cfg.SMTP_PASS, from: cfg.SMTP_FROM });
  }
  if (cfg.NODE_ENV === 'production') throw new Error('SMTP_HOST و SMTP_FROM در production الزامی است');
  return new MockMailer(log);
}
