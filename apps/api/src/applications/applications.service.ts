/**
 * Applicant side of the recruitment workflow.
 *
 * Hot-path design (what keeps p95 low during a recruitment-opening spike):
 *  - Draft autosave writes to Redis (encrypted) and schedules ONE debounced DB
 *    write per user per 30s via BullMQ — the database sees a fraction of the
 *    autosave traffic.
 *  - Submission validates everything synchronously (schemas, documents,
 *    eligibility), reserves the submission atomically in Redis (SET NX),
 *    enqueues the DB insert and returns 202 with the application number
 *    immediately. Workers persist, generate the PDF slip and notify.
 *  - Status lookups hit Redis first, then a read replica.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  APPLICATION_STEPS, ApplicationData, ApplicationStep, DOCUMENT_RULES, DOCUMENT_TYPES, DocumentType, DraftData, RK,
  STEP_SCHEMAS, ageOn, checkEligibility, generateApplicationId,
} from '@armyx/shared';
import { hashIp } from '@armyx/shared/server';
import { DatabaseService } from '../infra/database.service';
import { RedisService } from '../infra/redis.service';
import { CryptoService } from '../infra/crypto.service';
import { QueueService } from '../infra/queue.service';
import { StorageService } from '../infra/storage.service';
import { Exercise, ExerciseService } from '../reference/exercise.service';
import { config } from '../config/config';

const DRAFT_TTL = 60 * 24 * 3600;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };

interface StoredDraft {
  data: DraftData;
  stepsDone: ApplicationStep[];
  updatedAt: string;
}

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly crypto: CryptoService,
    private readonly queue: QueueService,
    private readonly storage: StorageService,
    private readonly exercises: ExerciseService,
  ) {}

  private async requireOpenExercise(): Promise<Exercise> {
    const ex = await this.exercises.active();
    if (!this.exercises.isAcceptingApplications(ex)) throw new ForbiddenException('Recruitment is not open at the moment');
    return ex;
  }

  // ------------------------------------------------------------------ drafts

  async loadDraft(userId: string, exerciseId: string): Promise<StoredDraft> {
    const key = RK.draft(userId, exerciseId);
    const cached = await this.redis.client.getBuffer(key);
    if (cached) return this.crypto.decryptJson<StoredDraft>(cached);
    const [row] = await this.db.read(`SELECT data_enc, steps_done, updated_at FROM drafts WHERE user_id = $1 AND exercise_id = $2`, [
      userId, exerciseId,
    ]);
    const draft: StoredDraft = row
      ? { data: this.crypto.decryptJson<DraftData>(row.data_enc), stepsDone: row.steps_done, updatedAt: row.updated_at.toISOString() }
      : { data: {}, stepsDone: [], updatedAt: new Date().toISOString() };
    if (row) await this.redis.client.set(key, this.crypto.encryptJson(draft), 'EX', DRAFT_TTL);
    return draft;
  }

  async getDraft(userId: string) {
    const ex = await this.exercises.active();
    if (!ex) return { exercise: null };
    const status = await this.status(userId);
    const draft = await this.loadDraft(userId, ex.id);
    const documents = await this.listDocuments(userId, ex.id);
    return {
      exercise: { id: ex.id, code: ex.code, title: ex.title, closesAt: ex.closesAt, open: this.exercises.isAcceptingApplications(ex), rules: ex.rules },
      submitted: !!status.application,
      ...draft,
      documents,
      eligibility: checkEligibility(ex.rules, draft.data, new Date(ex.closesAt)),
    };
  }

  async saveStep(userId: string, step: ApplicationStep, raw: Record<string, unknown>) {
    const ex = await this.requireOpenExercise();
    if (await this.redis.client.exists(RK.appStatus(userId, ex.id))) throw new ConflictException('Application already submitted');
    const parsed = STEP_SCHEMAS[step].safeParse(raw);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const i of parsed.error.issues) fields[i.path.join('.') || '_'] ??= i.message;
      throw new BadRequestException({ message: 'Please correct the highlighted fields', fields });
    }
    const draft = await this.loadDraft(userId, ex.id);
    (draft.data as Record<string, unknown>)[step] = parsed.data;
    if (!draft.stepsDone.includes(step)) draft.stepsDone.push(step);
    draft.updatedAt = new Date().toISOString();
    await this.redis.client.set(RK.draft(userId, ex.id), this.crypto.encryptJson(draft), 'EX', DRAFT_TTL);
    await this.queue.draft({ userId, exerciseId: ex.id });
    return {
      saved: true,
      stepsDone: draft.stepsDone,
      updatedAt: draft.updatedAt,
      eligibility: checkEligibility(ex.rules, draft.data, new Date(ex.closesAt)),
    };
  }

  // ------------------------------------------------------------------ documents

  async presignUpload(userId: string, type: DocumentType, contentType: string, size: number) {
    const ex = await this.requireOpenExercise();
    const rule = DOCUMENT_RULES[type];
    if (!rule.mimeTypes.includes(contentType)) throw new BadRequestException(`${rule.label}: allowed types are ${rule.mimeTypes.join(', ')}`);
    if (size > rule.maxBytes) throw new BadRequestException(`${rule.label} must not exceed ${Math.round(rule.maxBytes / 1024)}KB`);
    const key = `docs/${ex.id}/${userId}/${type}-${randomBytes(8).toString('hex')}.${EXT[contentType]}`;
    const post = await this.storage.presignUpload(key, contentType, rule.maxBytes);
    return { key, ...post };
  }

  async confirmUpload(userId: string, type: DocumentType, key: string) {
    const ex = await this.requireOpenExercise();
    // The key must be one we issued for this user/exercise/type.
    const prefix = `docs/${ex.id}/${userId}/${type}-`;
    if (!key.startsWith(prefix) || key.includes('..')) throw new ForbiddenException('Invalid upload key');
    const head = await this.storage.head(key);
    if (!head) throw new BadRequestException('Upload not found. Please upload the file again.');
    const rule = DOCUMENT_RULES[type];
    if (head.size > rule.maxBytes || !rule.mimeTypes.includes(head.contentType ?? '')) {
      throw new BadRequestException('File failed validation. Please upload a valid file.');
    }
    const [doc] = await this.db.write<{ id: string }>(
      `INSERT INTO documents (user_id, exercise_id, type, s3_key, content_type, size_bytes, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending')
       ON CONFLICT (user_id, exercise_id, type)
       DO UPDATE SET s3_key = EXCLUDED.s3_key, content_type = EXCLUDED.content_type, size_bytes = EXCLUDED.size_bytes,
                     status = 'pending', reject_reason = NULL, sha256 = NULL, updated_at = now()
       RETURNING id`,
      [userId, ex.id, type, key, head.contentType, head.size],
    );
    // Magic-byte verification (and optional AV scan) happens asynchronously.
    await this.queue.verifyDocument({ documentId: doc!.id });
    return { id: doc!.id, type, status: 'pending', size: head.size };
  }

  async listDocuments(userId: string, exerciseId: string) {
    const rows = await this.db.write(
      `SELECT id, type, content_type, size_bytes, status, reject_reason, updated_at FROM documents WHERE user_id = $1 AND exercise_id = $2`,
      [userId, exerciseId],
    );
    return rows.map((r) => ({
      id: r.id, type: r.type, contentType: r.content_type, size: r.size_bytes, status: r.status,
      rejectReason: r.reject_reason, updatedAt: r.updated_at,
    }));
  }

  async documentUrl(userId: string, type: DocumentType) {
    const ex = await this.exercises.active();
    if (!ex) throw new NotFoundException();
    const [d] = await this.db.read(`SELECT s3_key FROM documents WHERE user_id = $1 AND exercise_id = $2 AND type = $3`, [userId, ex.id, type]);
    if (!d) throw new NotFoundException('Document not uploaded');
    return { url: await this.storage.presignDownload(d.s3_key, 300) };
  }

  // ------------------------------------------------------------------ submission

  async submit(userId: string, ip: string) {
    const ex = await this.requireOpenExercise();
    const draft = await this.loadDraft(userId, ex.id);

    // 1. Every step must be complete and valid (re-validated server-side).
    const data = {} as Record<ApplicationStep, unknown>;
    const missing: string[] = [];
    for (const step of APPLICATION_STEPS) {
      const r = STEP_SCHEMAS[step].safeParse((draft.data as Record<string, unknown>)[step]);
      if (!r.success) missing.push(step);
      else data[step] = r.data;
    }
    if (missing.length) throw new BadRequestException({ message: 'Please complete all sections before submitting', missing });
    const app = data as unknown as ApplicationData;

    // 2. Required documents uploaded and not rejected.
    const docs = await this.listDocuments(userId, ex.id);
    const missingDocs = DOCUMENT_TYPES.filter((t) => DOCUMENT_RULES[t].required && !docs.some((d) => d.type === t && d.status !== 'rejected'));
    if (missingDocs.length) throw new BadRequestException({ message: 'Please upload all required documents', missingDocs });

    // 3. Eligibility — authoritative check.
    const closes = new Date(ex.closesAt);
    const eligibility = checkEligibility(ex.rules, app, closes);
    if (!eligibility.eligible) throw new BadRequestException({ message: 'You do not meet the eligibility requirements', reasons: eligibility.reasons });

    // 4. Atomically reserve the submission (protects against double submit across pods).
    const applicationId = randomUUID();
    const applicationNo = generateApplicationId(ex.code, closes.getUTCFullYear(), randomBytes(8));
    const submittedAt = new Date().toISOString();
    const reserved = await this.redis.client.set(
      RK.appStatus(userId, ex.id),
      JSON.stringify({ applicationId, applicationNo, status: 'processing', submittedAt }),
      'EX', 90 * 24 * 3600, 'NX',
    );
    if (!reserved) throw new ConflictException('You have already submitted an application for this exercise');

    // Belt and braces: the DB unique constraint (exercise_id, user_id) is the final guard (worker handles 23505).
    const [existing] = await this.db.read(`SELECT application_no FROM applications WHERE exercise_id = $1 AND user_id = $2`, [ex.id, userId]);
    if (existing) {
      await this.redis.client.set(RK.appStatus(userId, ex.id), JSON.stringify({ applicationNo: existing.application_no, status: 'submitted' }), 'EX', 300);
      throw new ConflictException('You have already submitted an application for this exercise');
    }

    // 5. Queue the write and answer immediately.
    await this.queue.submission({
      applicationId, applicationNo, userId, exerciseId: ex.id, submittedAt,
      age: ageOn(app.personal.dateOfBirth, closes),
      payloadEnc: this.crypto.encryptJson(app).toString('base64'),
      ipHash: hashIp(ip, config().IP_HASH_SALT),
    });
    return { applicationNo, status: 'processing', submittedAt };
  }

  // ------------------------------------------------------------------ status

  async status(userId: string) {
    const ex = await this.exercises.active();
    if (!ex) return { application: null };
    const key = RK.appStatus(userId, ex.id);
    const cached = await this.redis.client.get(key);
    if (cached) {
      const c = JSON.parse(cached);
      // "processing" means the worker has not yet persisted it; full detail comes from DB afterwards.
      if (c.status === 'processing' || c.detail) return { application: c.detail ?? c };
    }
    const [row] = await this.db.read(
      `SELECT a.id, a.application_no, a.status, a.entry_type, a.submitted_at, a.updated_at, a.slip_key IS NOT NULL AS slip_ready,
              a.screening_date, c.name AS centre_name, c.address AS centre_address, c.state_code AS centre_state
         FROM applications a LEFT JOIN screening_centres c ON c.id = a.screening_centre_id
        WHERE a.exercise_id = $1 AND a.user_id = $2`,
      [ex.id, userId],
    );
    if (!row) return { application: null };
    const history = await this.db.read(
      `SELECT to_status AS status, created_at AS at FROM application_status_history WHERE application_id = $1 ORDER BY created_at`,
      [row.id],
    );
    const detail = {
      applicationNo: row.application_no, status: row.status, entryType: row.entry_type, submittedAt: row.submitted_at,
      updatedAt: row.updated_at, slipReady: row.slip_ready,
      screening: row.screening_date ? { date: row.screening_date, centre: row.centre_name, address: row.centre_address, state: row.centre_state } : null,
      history,
    };
    // Cache only once the slip exists, so the dashboard picks up "slip ready" promptly.
    await this.redis.client.set(key, JSON.stringify({ status: row.status, applicationNo: row.application_no, detail }), 'EX', row.slip_ready ? 300 : 15);
    return { application: detail };
  }

  async slipUrl(userId: string) {
    const ex = await this.exercises.active();
    if (!ex) throw new NotFoundException();
    const [row] = await this.db.read(`SELECT application_no, slip_key FROM applications WHERE exercise_id = $1 AND user_id = $2`, [ex.id, userId]);
    if (!row) throw new NotFoundException('No submitted application');
    if (!row.slip_key) return { pending: true };
    return { url: await this.storage.presignDownload(row.slip_key, 300, `${row.application_no}.pdf`) };
  }
}
