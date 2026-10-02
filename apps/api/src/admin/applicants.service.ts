/**
 * Officer-facing applicant search and bulk workflow actions.
 * Reads go to the replica; workflow writes go to the primary in a transaction
 * with a status-history row per application and an audit-log entry per action.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApplicantFilter, ApplicationData, ApplicationStatus, RK, isValidApplicationId, phoneSchema, emailSchema,
} from '@armyx/shared';
import { DatabaseService } from '../infra/database.service';
import { CryptoService } from '../infra/crypto.service';
import { RedisService } from '../infra/redis.service';
import { QueueService } from '../infra/queue.service';
import { StorageService } from '../infra/storage.service';
import { ExerciseService } from '../reference/exercise.service';

const SORT_COLS: Record<ApplicantFilter['sort'], string> = {
  submitted_at: 'a.submitted_at', surname: 'a.surname', state: 'a.state_code', status: 'a.status', height_cm: 'a.height_cm',
};

/** Allowed manual transitions. invited_for_screening is set only by screening assignment. */
const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  submitted: ['under_review', 'shortlisted', 'rejected'],
  under_review: ['shortlisted', 'rejected'],
  shortlisted: ['under_review', 'rejected'],
  invited_for_screening: ['rejected'],
  rejected: ['under_review'],
};

export function buildFilter(f: Partial<ApplicantFilter>, exerciseId: string, crypto: CryptoService) {
  const where: string[] = ['a.exercise_id = $1'];
  const params: unknown[] = [exerciseId];
  const add = (sql: string, v: unknown) => {
    params.push(v);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (f.state) add('a.state_code = ?', f.state);
  if (f.lga) add('a.lga = ?', f.lga);
  if (f.qualification) add('a.qualification = ?', f.qualification);
  if (f.entryType) add('a.entry_type = ?', f.entryType);
  if (f.status) add('a.status = ?', f.status);
  if (f.gender) add('a.gender = ?', f.gender);
  if (f.q) {
    const q = f.q.trim();
    if (isValidApplicationId(q)) add('a.application_no = ?', q.toUpperCase());
    else if (emailSchema.safeParse(q).success) add('a.email_hash = ?', crypto.blindIndex(emailSchema.parse(q)));
    else if (phoneSchema.safeParse(q).success) add('a.phone_hash = ?', crypto.blindIndex(phoneSchema.parse(q)));
    else add(`lower(a.surname || ' ' || a.first_name) LIKE ?`, `%${q.toLowerCase().replace(/[%_\\]/g, '\\$&')}%`);
  }
  return { where, params };
}

@Injectable()
export class ApplicantsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: CryptoService,
    private readonly redis: RedisService,
    private readonly queue: QueueService,
    private readonly storage: StorageService,
    private readonly exercises: ExerciseService,
  ) {}

  async exerciseId(explicit?: string): Promise<string> {
    if (explicit) return explicit;
    const ex = await this.exercises.active();
    if (ex) return ex.id;
    const [latest] = await this.db.read(`SELECT id FROM exercises ORDER BY opens_at DESC LIMIT 1`);
    if (!latest) throw new NotFoundException('No recruitment exercise exists yet');
    return latest.id;
  }

  /** Keyset-paginated search: stable and fast at any depth (no OFFSET). */
  async search(f: ApplicantFilter) {
    const exerciseId = await this.exerciseId(f.exerciseId);
    const { where, params } = buildFilter(f, exerciseId, this.crypto);
    const col = SORT_COLS[f.sort];
    const dir = f.order === 'asc' ? 'ASC' : 'DESC';
    const countWhere = [...where];
    const countParams = [...params];

    if (f.cursor) {
      let cur: [unknown, string];
      try {
        cur = JSON.parse(Buffer.from(f.cursor, 'base64url').toString());
      } catch {
        throw new BadRequestException('Invalid cursor');
      }
      params.push(cur[0], cur[1]);
      where.push(`(${col}, a.id) ${dir === 'DESC' ? '<' : '>'} ($${params.length - 1}, $${params.length})`);
    }
    params.push(f.limit + 1);
    const rows = await this.db.read(
      `SELECT a.id, a.application_no, a.surname, a.first_name, a.gender, a.age, a.state_code, a.lga, a.qualification,
              a.entry_type, a.trade, a.height_cm, a.status, a.submitted_at, a.screening_date, ${col} AS sort_value
         FROM applications a WHERE ${where.join(' AND ')}
        ORDER BY ${col} ${dir}, a.id ${dir} LIMIT $${params.length}`,
      params,
    );
    const hasMore = rows.length > f.limit;
    const page = rows.slice(0, f.limit);
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? Buffer.from(JSON.stringify([last.sort_value, last.id])).toString('base64url') : null;

    // Counting millions of rows on every keystroke is wasteful: cache per filter for 30s.
    const countKey = `cnt:${Buffer.from(JSON.stringify([countWhere, countParams.map(String)])).toString('base64url').slice(0, 200)}`;
    const total = await this.redis.cached(countKey, 30, async () => {
      const [c] = await this.db.read(`SELECT count(*)::int AS n FROM applications a WHERE ${countWhere.join(' AND ')}`, countParams);
      return c.n as number;
    });
    return {
      total,
      nextCursor,
      items: page.map(({ sort_value, ...r }) => ({
        id: r.id, applicationNo: r.application_no, surname: r.surname, firstName: r.first_name, gender: r.gender, age: r.age,
        state: r.state_code, lga: r.lga, qualification: r.qualification, entryType: r.entry_type, trade: r.trade,
        heightCm: Number(r.height_cm), status: r.status, submittedAt: r.submitted_at, screeningDate: r.screening_date,
      })),
    };
  }

  async detail(id: string) {
    const [a] = await this.db.read(
      `SELECT a.*, c.name AS centre_name, c.address AS centre_address FROM applications a
         LEFT JOIN screening_centres c ON c.id = a.screening_centre_id WHERE a.id = $1`,
      [id],
    );
    if (!a) throw new NotFoundException('Application not found');
    const [user] = await this.db.read(`SELECT email_enc, phone_enc FROM users WHERE id = $1`, [a.user_id]);
    const docs = await this.db.read(
      `SELECT id, type, content_type, size_bytes, status, reject_reason FROM documents WHERE user_id = $1 AND exercise_id = $2`,
      [a.user_id, a.exercise_id],
    );
    const history = await this.db.read(
      `SELECT h.from_status, h.to_status, h.note, h.created_at, u.full_name AS actor
         FROM application_status_history h LEFT JOIN admin_users u ON u.id = h.actor_id
        WHERE h.application_id = $1 ORDER BY h.created_at`,
      [id],
    );
    return {
      id: a.id, applicationNo: a.application_no, status: a.status, submittedAt: a.submitted_at, reviewNote: a.review_note,
      screening: a.screening_date ? { date: a.screening_date, centre: a.centre_name, address: a.centre_address } : null,
      contact: { email: this.crypto.decryptString(user?.email_enc), phone: this.crypto.decryptString(user?.phone_enc) },
      data: this.crypto.decryptJson<ApplicationData>(a.pii_enc),
      documents: docs.map((d) => ({ id: d.id, type: d.type, contentType: d.content_type, size: d.size_bytes, status: d.status, rejectReason: d.reject_reason })),
      history,
    };
  }

  async documentUrl(applicationId: string, type: string) {
    const [d] = await this.db.read(
      `SELECT d.s3_key FROM documents d JOIN applications a ON a.user_id = d.user_id AND a.exercise_id = d.exercise_id
        WHERE a.id = $1 AND d.type = $2`,
      [applicationId, type],
    );
    if (!d) throw new NotFoundException('Document not found');
    return { url: await this.storage.presignDownload(d.s3_key, 120) };
  }

  async bulkStatus(ids: string[], to: ApplicationStatus, actorId: string, note?: string) {
    const allowedFrom = (Object.keys(TRANSITIONS) as ApplicationStatus[]).filter((s) => TRANSITIONS[s].includes(to));
    const exerciseId = await this.exerciseId();
    const quotas = (await this.exercises.active())?.quotas ?? {};

    const changed = await this.db.tx(async (c) => {
      const { rows: candidates } = await c.query(
        `SELECT id, user_id, status, state_code, exercise_id FROM applications
          WHERE id = ANY($1::uuid[]) AND status = ANY($2::application_status[]) FOR UPDATE`,
        [ids, allowedFrom],
      );
      if (!candidates.length) return [];

      if (to === 'shortlisted') {
        // Enforce per-state quotas (shortlisted + invited count against the quota).
        const byState = new Map<string, number>();
        for (const r of candidates) byState.set(r.state_code, (byState.get(r.state_code) ?? 0) + 1);
        const { rows: current } = await c.query(
          `SELECT state_code, count(*)::int AS n FROM applications
            WHERE exercise_id = $1 AND status IN ('shortlisted','invited_for_screening') AND state_code = ANY($2) GROUP BY state_code`,
          [exerciseId, [...byState.keys()]],
        );
        for (const [state, adding] of byState) {
          const quota = quotas[state];
          const have = current.find((r) => r.state_code === state)?.n ?? 0;
          if (quota && have + adding > quota) {
            throw new BadRequestException(`Quota for ${state} would be exceeded (${have} + ${adding} > ${quota})`);
          }
        }
      }

      const idsToChange = candidates.map((r) => r.id);
      await c.query(
        `UPDATE applications SET status = $2, reviewed_by = $3, review_note = COALESCE($4, review_note), updated_at = now()
          WHERE id = ANY($1::uuid[])`,
        [idsToChange, to, actorId, note ?? null],
      );
      await c.query(
        `INSERT INTO application_status_history (application_id, from_status, to_status, actor_id, note)
         SELECT x.id, x.from_status::application_status, $2, $3, $4 FROM unnest($1::uuid[], $5::text[]) AS x(id, from_status)`,
        [idsToChange, to, actorId, note ?? null, candidates.map((r) => r.status)],
      );
      return candidates;
    });

    await this.afterStatusChange(changed, to);
    return { requested: ids.length, updated: changed.length, skipped: ids.length - changed.length };
  }

  async bulkScreening(ids: string[], centreId: string, date: string, actorId: string) {
    const [centre] = await this.db.write(`SELECT id, name, address, exercise_id FROM screening_centres WHERE id = $1`, [centreId]);
    if (!centre) throw new NotFoundException('Screening centre not found');
    const changed = await this.db.tx(async (c) => {
      const { rows } = await c.query(
        `SELECT id, user_id, status, state_code, exercise_id FROM applications
          WHERE id = ANY($1::uuid[]) AND exercise_id = $2 AND status IN ('shortlisted','invited_for_screening') FOR UPDATE`,
        [ids, centre.exercise_id],
      );
      if (!rows.length) return [];
      const idsToChange = rows.map((r) => r.id);
      await c.query(
        `UPDATE applications SET status = 'invited_for_screening', screening_centre_id = $2, screening_date = $3, reviewed_by = $4, updated_at = now()
          WHERE id = ANY($1::uuid[])`,
        [idsToChange, centreId, date, actorId],
      );
      await c.query(
        `INSERT INTO application_status_history (application_id, from_status, to_status, actor_id, note)
         SELECT x.id, x.from_status::application_status, 'invited_for_screening', $2, $3 FROM unnest($1::uuid[], $4::text[]) AS x(id, from_status)`,
        [idsToChange, actorId, `Screening: ${centre.name}, ${new Date(date).toDateString()}`, rows.map((r) => r.status)],
      );
      return rows;
    });
    await this.afterStatusChange(changed, 'invited_for_screening', {
      centre: centre.name, address: centre.address, date: new Date(date).toUTCString(),
    });
    return { requested: ids.length, updated: changed.length, skipped: ids.length - changed.length };
  }

  /** Keep counters and caches consistent and notify applicants (email + SMS) via the queue. */
  private async afterStatusChange(rows: { user_id: string; status: string; exercise_id: string }[], to: ApplicationStatus, extra: Record<string, string> = {}) {
    if (!rows.length) return;
    const pipe = this.redis.client.pipeline();
    for (const r of rows) {
      pipe.del(RK.appStatus(r.user_id, r.exercise_id));
      if (r.status !== to) {
        pipe.hincrby(RK.statsStatus(r.exercise_id), r.status, -1);
        pipe.hincrby(RK.statsStatus(r.exercise_id), to, 1);
      }
    }
    await pipe.exec();
    const template = to === 'invited_for_screening' ? 'screening_invite' : 'status_changed';
    // under_review is internal noise for applicants; only notify meaningful changes.
    if (to === 'under_review') return;
    const jobs = rows.flatMap((r) => [
      { channel: 'email' as const, userId: r.user_id, template, vars: { status: to, ...extra } },
      { channel: 'sms' as const, userId: r.user_id, template, vars: { status: to, ...extra } },
    ]);
    for (let i = 0; i < jobs.length; i += 1000) await this.queue.notifyMany(jobs.slice(i, i + 1000) as any);
  }
}
