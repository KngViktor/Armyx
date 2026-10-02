/** Debounced write-behind of autosaved drafts from Redis to PostgreSQL. */
import type { Job } from 'bullmq';
import { DraftPersistJob, RK } from '@armyx/shared';
import { crypto, primary, redis } from '../lib/infra';

export async function processDraft(job: Job<DraftPersistJob>) {
  const { userId, exerciseId } = job.data;
  const blob = await (redis as any).getBuffer(RK.draft(userId, exerciseId));
  if (!blob) return { skipped: 'no draft in cache' };
  const draft = crypto.decryptJson<{ data: unknown; stepsDone: string[]; updatedAt: string }>(blob);
  await primary.query(
    `INSERT INTO drafts (user_id, exercise_id, data_enc, steps_done, updated_at) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, exercise_id) DO UPDATE SET data_enc = EXCLUDED.data_enc, steps_done = EXCLUDED.steps_done, updated_at = EXCLUDED.updated_at
     WHERE drafts.updated_at <= EXCLUDED.updated_at`,
    [userId, exerciseId, crypto.encryptJson(draft.data), draft.stepsDone, draft.updatedAt],
  );
  return { persisted: true };
}
