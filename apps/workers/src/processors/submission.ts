/**
 * Persists a queued submission. Idempotent: the job id is the application id
 * and the (exercise_id, user_id) unique constraint means retries can never
 * create duplicates.
 */
import type { Job } from 'bullmq';
import { ApplicationData, RK, SubmissionJob } from '@armyx/shared';
import { crypto, lagosDate, log, redis, tx } from '../lib/infra';
import { queue, QUEUES } from '../lib/queues';

export async function processSubmission(job: Job<SubmissionJob>) {
  const j = job.data;
  const app = crypto.decryptJson<ApplicationData>(Buffer.from(j.payloadEnc, 'base64'));

  const inserted = await tx(async (c) => {
    const { rows: [u] } = await c.query(`SELECT email_hash, phone_hash FROM users WHERE id = $1`, [j.userId]);
    if (!u) throw new Error(`user ${j.userId} not found`);
    const { rows } = await c.query(
      `INSERT INTO applications (id, application_no, exercise_id, user_id, status, entry_type, trade, surname, first_name, gender, age,
                                 state_code, lga, qualification, height_cm, preferred_screening_state, email_hash, phone_hash, pii_enc, submitted_at)
       VALUES ($1,$2,$3,$4,'submitted',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (exercise_id, user_id) DO NOTHING RETURNING id`,
      [
        j.applicationId, j.applicationNo, j.exerciseId, j.userId, app.entry.entryType, app.entry.trade ?? null,
        app.personal.surname.toUpperCase(), app.personal.firstName, app.personal.gender, j.age, app.origin.stateOfOrigin, app.origin.lga,
        app.education.highestQualification, app.physical.heightCm, app.entry.preferredScreeningState, u.email_hash, u.phone_hash,
        crypto.encryptJson(app), j.submittedAt,
      ],
    );
    if (!rows.length) {
      // Either a genuine duplicate (another application exists) or a retry of THIS job after a partial failure.
      const { rows: [existing] } = await c.query(`SELECT id FROM applications WHERE exercise_id = $1 AND user_id = $2`, [j.exerciseId, j.userId]);
      return existing?.id === j.applicationId ? 'retry' : false;
    }
    await c.query(`INSERT INTO application_status_history (application_id, from_status, to_status, note) VALUES ($1, NULL, 'submitted', 'Online submission')`, [j.applicationId]);
    await c.query(`DELETE FROM drafts WHERE user_id = $1 AND exercise_id = $2`, [j.userId, j.exerciseId]);
    return true;
  });

  if (!inserted) {
    log.warn({ applicationId: j.applicationId }, 'duplicate submission ignored');
    return { duplicate: true };
  }

  // Real-time dashboard counters (reconciled periodically by the maintenance job).
  await redis
    .multi()
    .set(RK.appStatus(j.userId, j.exerciseId), JSON.stringify({ applicationId: j.applicationId, applicationNo: j.applicationNo, status: 'submitted' }), 'EX', 90 * 86400)
    .del(RK.draft(j.userId, j.exerciseId))
    .exec();
  // Follow-up steps below are idempotent so a retried job converges to the same state.
  const firstCount = await redis.set(`counted:${j.applicationId}`, '1', 'EX', 7 * 86400, 'NX');
  if (firstCount) await redis
    .multi()
    .incr(RK.statsTotal(j.exerciseId))
    .hincrby(RK.statsState(j.exerciseId), app.origin.stateOfOrigin, 1)
    .hincrby(RK.statsStatus(j.exerciseId), 'submitted', 1)
    .hincrby(RK.statsEntry(j.exerciseId), app.entry.entryType, 1)
    .hincrby(RK.statsDaily(j.exerciseId), lagosDate(new Date(j.submittedAt)), 1)
    .exec();

  await queue(QUEUES.pdf).add('slip', { applicationId: j.applicationId }, { jobId: `slip-${j.applicationId}` });
  const vars = { applicationNo: j.applicationNo, firstName: app.personal.firstName };
  await queue(QUEUES.notifications).addBulk([
    { name: 'submission_received', data: { channel: 'email', userId: j.userId, template: 'submission_received', vars }, opts: { jobId: `ack-email-${j.applicationId}` } },
    { name: 'submission_received', data: { channel: 'sms', userId: j.userId, template: 'submission_received', vars }, opts: { jobId: `ack-sms-${j.applicationId}` } },
  ]);
  return { inserted: true };
}
