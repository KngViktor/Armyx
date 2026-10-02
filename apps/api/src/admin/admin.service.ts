/**
 * Exercises, screening centres, exports, dashboard, audit log and admin users.
 */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  APPLICATION_STATUSES, ExerciseInput, RK, ruleSetSchema, type AdminRole,
} from '@armyx/shared';
import { DatabaseService } from '../infra/database.service';
import { RedisService } from '../infra/redis.service';
import { QueueService } from '../infra/queue.service';
import { StorageService } from '../infra/storage.service';
import { ExerciseService } from '../reference/exercise.service';
import { AdminAuthService } from './admin-auth.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly queue: QueueService,
    private readonly storage: StorageService,
    private readonly exercises: ExerciseService,
    private readonly adminAuth: AdminAuthService,
  ) {}

  // ------------------------------------------------------------- exercises
  listExercises() {
    return this.db.read(
      `SELECT e.id, e.code, e.title, e.state, e.opens_at, e.closes_at, e.rules, e.quotas, e.created_at,
              (SELECT count(*)::int FROM applications a WHERE a.exercise_id = e.id) AS applications
         FROM exercises e ORDER BY e.opens_at DESC`,
    );
  }

  async createExercise(input: ExerciseInput, actorId: string) {
    const [row] = await this.db.write(
      `INSERT INTO exercises (code, title, opens_at, closes_at, rules, quotas, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [input.code, input.title, input.opensAt, input.closesAt, JSON.stringify(input.rules), JSON.stringify(input.quotas), actorId],
    );
    return row;
  }

  async updateExercise(id: string, input: ExerciseInput) {
    for (const r of Object.values(input.rules)) {
      ruleSetSchema.parse(r);
      if (r.minAge > r.maxAge) throw new BadRequestException('Minimum age cannot exceed maximum age');
    }
    const [row] = await this.db.write(
      `UPDATE exercises SET code = $2, title = $3, opens_at = $4, closes_at = $5, rules = $6, quotas = $7, updated_at = now()
        WHERE id = $1 RETURNING *`,
      [id, input.code, input.title, input.opensAt, input.closesAt, JSON.stringify(input.rules), JSON.stringify(input.quotas)],
    );
    if (!row) throw new NotFoundException();
    await this.exercises.invalidate();
    return row;
  }

  async setExerciseState(id: string, state: 'open' | 'closed') {
    try {
      const [row] = await this.db.write(`UPDATE exercises SET state = $2, updated_at = now() WHERE id = $1 RETURNING id, code, state`, [id, state]);
      if (!row) throw new NotFoundException();
      await this.exercises.invalidate();
      return row;
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new ConflictException('Another exercise is already open. Close it first.');
      throw e;
    }
  }

  // ------------------------------------------------------------- screening centres
  listCentres(exerciseId: string) {
    return this.db.read(
      `SELECT c.*, (SELECT count(*)::int FROM applications a WHERE a.screening_centre_id = c.id) AS assigned
         FROM screening_centres c WHERE c.exercise_id = $1 ORDER BY c.state_code, c.name`,
      [exerciseId],
    );
  }

  async createCentre(exerciseId: string, c: { name: string; stateCode: string; address: string; capacityPerDay: number }) {
    const [row] = await this.db.write(
      `INSERT INTO screening_centres (exercise_id, name, state_code, address, capacity_per_day) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [exerciseId, c.name, c.stateCode, c.address, c.capacityPerDay],
    );
    return row;
  }

  async deleteCentre(id: string) {
    const [used] = await this.db.write(`SELECT 1 FROM applications WHERE screening_centre_id = $1 LIMIT 1`, [id]);
    if (used) throw new ConflictException('Centre has assigned applicants and cannot be deleted');
    await this.db.write(`DELETE FROM screening_centres WHERE id = $1`, [id]);
    return { ok: true };
  }

  // ------------------------------------------------------------- exports
  async createExport(actorId: string, format: 'csv' | 'xlsx', filter: object, exerciseId: string) {
    const [row] = await this.db.write(
      `INSERT INTO exports (requested_by, format, filter) VALUES ($1,$2,$3) RETURNING id, status, format, created_at`,
      [actorId, format, JSON.stringify({ ...filter, exerciseId })],
    );
    await this.queue.export({ exportId: row.id });
    return row;
  }

  listExports(actorId: string) {
    return this.db.write(
      `SELECT id, format, status, row_count, error, created_at, completed_at FROM exports WHERE requested_by = $1 ORDER BY created_at DESC LIMIT 20`,
      [actorId],
    );
  }

  async exportUrl(id: string, actorId: string) {
    const [row] = await this.db.write(`SELECT s3_key, format FROM exports WHERE id = $1 AND requested_by = $2 AND status = 'done'`, [id, actorId]);
    if (!row) throw new NotFoundException('Export not ready');
    return { url: await this.storage.presignDownload(row.s3_key, 120, `applicants-${id.slice(0, 8)}.${row.format}`) };
  }

  // ------------------------------------------------------------- dashboard
  /**
   * Real-time numbers come from Redis counters maintained by the submission
   * worker and status changes; a maintenance job reconciles them against the
   * replica every few minutes. Falls back to the replica if counters are empty.
   */
  async dashboard(exerciseId: string) {
    const r = this.redis.client;
    let [total, byState, byStatus, byEntry, daily] = await Promise.all([
      r.get(RK.statsTotal(exerciseId)),
      r.hgetall(RK.statsState(exerciseId)),
      r.hgetall(RK.statsStatus(exerciseId)),
      r.hgetall(RK.statsEntry(exerciseId)),
      r.hgetall(RK.statsDaily(exerciseId)),
    ]);
    if (total === null) {
      const agg = await this.aggregateFromReplica(exerciseId);
      ({ total, byState, byStatus, byEntry, daily } = agg as any);
    }
    const num = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Number(v)]));
    const statuses = num(byStatus);
    for (const s of APPLICATION_STATUSES) statuses[s] ??= 0;
    const [queueDepth, recent] = await Promise.all([
      this.queue.depth('submissions'),
      this.db.read(`SELECT count(*)::int AS n FROM applications WHERE exercise_id = $1 AND submitted_at > now() - interval '1 hour'`, [exerciseId]),
    ]);
    return {
      total: Number(total ?? 0),
      lastHour: recent[0]?.n ?? 0,
      pendingSubmissions: queueDepth,
      byState: num(byState),
      byStatus: statuses,
      byEntryType: num(byEntry),
      daily: Object.entries(num(daily)).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
      generatedAt: new Date().toISOString(),
    };
  }

  async aggregateFromReplica(exerciseId: string) {
    const [t] = await this.db.read(`SELECT count(*)::int AS n FROM applications WHERE exercise_id = $1`, [exerciseId]);
    const group = async (col: string) =>
      Object.fromEntries(
        (await this.db.read(`SELECT ${col} AS k, count(*)::int AS n FROM applications WHERE exercise_id = $1 GROUP BY 1`, [exerciseId]))
          .map((r) => [String(r.k), String(r.n)]),
      );
    return {
      total: String(t.n),
      byState: await group('state_code'),
      byStatus: await group('status'),
      byEntry: await group('entry_type'),
      daily: await group(`to_char(submitted_at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD')`),
    };
  }

  // ------------------------------------------------------------- audit log
  auditLogs(q: { actor?: string; action?: string; entity?: string; before?: string; limit?: number }) {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      params.push(v);
      where.push(sql.replace('?', `$${params.length}`));
    };
    if (q.actor) add('actor_email ILIKE ?', `%${q.actor}%`);
    if (q.action) add('action LIKE ?', `${q.action}%`);
    if (q.entity) add('entity_id = ?', q.entity);
    if (q.before) add('id < ?', q.before);
    params.push(Math.min(q.limit ?? 50, 200));
    return this.db.read(
      `SELECT id, actor_email, actor_role, action, entity_type, entity_id, details, ip, created_at FROM audit_logs
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT $${params.length}`,
      params,
    );
  }

  // ------------------------------------------------------------- admin users
  listAdmins() {
    return this.db.read(`SELECT id, email, full_name, role, active, totp_enabled, last_login_at, created_at FROM admin_users ORDER BY created_at`);
  }

  async inviteAdmin(email: string, fullName: string, role: AdminRole) {
    const [row] = await this.db.write(
      `INSERT INTO admin_users (email, full_name, role) VALUES ($1,$2,$3) RETURNING id, email, full_name, role`,
      [email, fullName, role],
    );
    const token = await this.adminAuth.createInvite(row.id);
    await this.queue.notify({ channel: 'email', to: email, template: 'admin_invite', vars: { token, name: fullName } });
    return row;
  }

  async updateAdmin(id: string, patch: { role?: AdminRole; active?: boolean }, actorId: string) {
    if (id === actorId && (patch.active === false || (patch.role && patch.role !== 'super_admin'))) {
      throw new BadRequestException('You cannot demote or deactivate your own account');
    }
    const [row] = await this.db.write(
      `UPDATE admin_users SET role = COALESCE($2, role), active = COALESCE($3, active), updated_at = now() WHERE id = $1
       RETURNING id, email, full_name, role, active`,
      [id, patch.role ?? null, patch.active ?? null],
    );
    if (!row) throw new NotFoundException();
    return row;
  }
}
