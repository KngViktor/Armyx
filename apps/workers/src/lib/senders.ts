/** Email (SMTP, pooled) and SMS (pluggable provider) delivery. */
import nodemailer from 'nodemailer';
import { env } from './env';
import { log } from './infra';

const transport = nodemailer.createTransport(env.smtpUrl, { pool: true, maxConnections: 5 } as any);

export async function sendEmail(to: string, subject: string, text: string, html: string) {
  await transport.sendMail({ from: env.mailFrom, to, subject, text, html });
}

export async function sendSms(to: string, message: string) {
  if (!message) return;
  switch (env.sms.provider) {
    case 'console':
      log.info({ to: to.slice(0, 7) + '****', message }, 'SMS (console provider)');
      return;
    case 'termii': {
      const res = await fetch(env.sms.url ?? 'https://api.ng.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.replace('+', ''), from: env.sms.sender, sms: message, type: 'plain', channel: 'dnd', api_key: env.sms.key }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`SMS provider error ${res.status}`);
      return;
    }
    default: {
      // Generic JSON HTTP gateway.
      const res = await fetch(env.sms.url!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.sms.key}` },
        body: JSON.stringify({ to, from: env.sms.sender, message }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`SMS gateway error ${res.status}`);
    }
  }
}
