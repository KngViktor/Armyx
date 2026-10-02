/**
 * Post-upload document verification. The browser-declared Content-Type is not
 * trusted: we read the object and check its magic bytes, record a SHA-256 and
 * mark it verified or rejected. An antivirus hook (e.g. ClamAV via clamd) can
 * be plugged in at `scan()`.
 */
import type { Job } from 'bullmq';
import { createHash } from 'node:crypto';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { DocumentVerifyJob } from '@armyx/shared';
import { primary, s3 } from '../lib/infra';
import { env } from '../lib/env';
import { sniff } from '../lib/sniff';

/** Hook for malware scanning. Return a reason string to reject. */
async function scan(_buf: Buffer): Promise<string | null> {
  return null;
}

export async function processDocument(job: Job<DocumentVerifyJob>) {
  const { rows: [d] } = await primary.query(`SELECT id, s3_key, content_type FROM documents WHERE id = $1`, [job.data.documentId]);
  if (!d) return { skipped: true };
  const obj = await s3.send(new GetObjectCommand({ Bucket: env.s3.bucket, Key: d.s3_key }));
  const buf = Buffer.from(await obj.Body!.transformToByteArray());
  const detected = sniff(buf);
  let reason: string | null = null;
  if (detected !== d.content_type) reason = 'File content does not match its type. Upload a genuine PDF, JPG or PNG.';
  else reason = await scan(buf);
  const sha256 = createHash('sha256').update(buf).digest('hex');
  await primary.query(`UPDATE documents SET status = $2, reject_reason = $3, sha256 = $4, updated_at = now() WHERE id = $1 AND s3_key = $5`, [
    d.id, reason ? 'rejected' : 'verified', reason, sha256, d.s3_key,
  ]);
  return { status: reason ? 'rejected' : 'verified' };
}
