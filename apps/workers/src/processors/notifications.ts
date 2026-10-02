/**
 * Email + SMS delivery. Recipients are resolved from the user id at send time
 * so contact details are never stored in Redis job payloads.
 */
import type { Job } from 'bullmq';
import { NotificationJob } from '@armyx/shared';
import { crypto, replica, primary } from '../lib/infra';
import { htmlEmail, render } from '../lib/templates';
import { sendEmail, sendSms } from '../lib/senders';

export async function processNotification(job: Job<NotificationJob>) {
  const n = job.data;
  let to = n.to;
  const vars = { ...n.vars };
  if (!to && n.userId) {
    // OTPs are sent right after registration: read the primary to avoid replica lag.
    const pool = n.template === 'otp' || n.template === 'welcome' ? primary : replica;
    const { rows: [u] } = await pool.query(`SELECT email_enc, phone_enc, first_name, erased_at FROM users WHERE id = $1`, [n.userId]);
    if (!u || u.erased_at) return { skipped: 'recipient not found' };
    to = crypto.decryptString(n.channel === 'email' ? u.email_enc : u.phone_enc) ?? undefined;
    vars.firstName ??= u.first_name;
  }
  if (!to) return { skipped: 'no recipient' };
  const msg = render(n.template, vars);
  if (n.channel === 'email') await sendEmail(to, msg.subject, msg.text, htmlEmail(msg.subject, msg.text));
  else await sendSms(to, msg.sms);
  return { sent: n.channel };
}
