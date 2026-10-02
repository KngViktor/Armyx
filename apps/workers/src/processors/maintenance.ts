/**
 * Periodic jobs:
 *  - reconcile-stats (every 5 min): rebuild Redis dashboard counters from the
 *    replica so drift (e.g. after a Redis failover) self-heals.
 *  - retention (daily): NDPA storage limitation — delete stale drafts and
 *    expired export files' metadata.
 */
import type { Job } from 'bullmq';
import { RK } from '@armyx/shared';
import { primary, redis, replica } from '../lib/infra';

export async function processMaintenance(job: Job) {
  if (job.name === 'reconcile-stats') {
    const { rows: exercises } = await replica.query(`SELECT id FROM exercises WHERE state = 'open' OR closes_at > now() - interval '30 days'`);
    for (const { id } of exercises) {
      const group = async (col: string) =>
        (await replica.query(`SELECT ${col} AS k, count(*)::int AS n FROM applications WHERE exercise_id = $1 GROUP BY 1`, [id])).rows;
      const [byState, byStatus, byEntry, daily] = await Promise.all([
        group('state_code'), group('status'), group('entry_type'), group(`to_char(submitted_at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD')`),
      ]);
      const total = byStatus.reduce((s, r) => s + r.n, 0);
      const m = redis.multi();
      m.set(RK.statsTotal(id), total);
      for (const [key, rows] of [[RK.statsState(id), byState], [RK.statsStatus(id), byStatus], [RK.statsEntry(id), byEntry], [RK.statsDaily(id), daily]] as const) {
        m.del(key);
        if (rows.length) m.hset(key, Object.fromEntries(rows.map((r) => [String(r.k), r.n])));
      }
      await m.exec();
    }
    return { exercises: exercises.length };
  }
  if (job.name === 'retention') {
    const drafts = await primary.query(
      `DELETE FROM drafts d USING exercises e WHERE e.id = d.exercise_id AND e.state = 'closed' AND e.closes_at < now() - interval '90 days'`,
    );
    const exports = await primary.query(`DELETE FROM exports WHERE created_at < now() - interval '30 days'`);
    return { drafts: drafts.rowCount, exports: exports.rowCount };
  }
  return { unknown: job.name };
}
