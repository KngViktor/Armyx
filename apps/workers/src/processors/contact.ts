/** Stores contact-form messages (contact details encrypted) and forwards them to the relevant desk. */
import type { Job } from 'bullmq';
import { ContactJob } from '@armyx/shared';
import { crypto, primary } from '../lib/infra';
import { sendEmail } from '../lib/senders';
import { htmlEmail } from '../lib/templates';
import { env } from '../lib/env';

export async function processContact(job: Job<ContactJob>) {
  const m = job.data;
  const { rows: [r] } = await primary.query(
    `INSERT INTO contact_messages (name, email_enc, phone_enc, subject, message, ip_hash) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [m.name, crypto.encrypt(m.email), m.phone ? crypto.encrypt(m.phone) : null, m.subject, m.message, m.ipHash],
  );
  const text = `New ${m.subject} enquiry (ref ${r.id})\n\nFrom: ${m.name} <${m.email}>${m.phone ? `\nPhone: ${m.phone}` : ''}\n\n${m.message}`;
  await sendEmail(env.contactDesk, `[Website] ${m.subject} enquiry`, text, htmlEmail('Website enquiry', text));
  return { id: r.id };
}
