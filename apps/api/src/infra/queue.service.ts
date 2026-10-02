/**
 * BullMQ producers. The API only enqueues; workers (apps/workers) consume.
 * All queues share one connection. Job options give every job retries with
 * exponential backoff and bounded retention so Redis memory stays flat.
 */
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';
import {
  QUEUES, QueueName, SubmissionJob, DraftPersistJob, NotificationJob, PdfSlipJob, ExportJob, DocumentVerifyJob, ContactJob,
} from '@armyx/shared';
import { createRedis } from './redis.service';

const defaults: JobsOptions = {
  attempts: 8,
  backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: { age: 3600, count: 10_000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly connection = createRedis({ forBullmq: true });
  private readonly queues = new Map<QueueName, Queue>();

  private q(name: QueueName): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      // `prefix` uses a hash tag so all keys of a queue live in one cluster slot.
      queue = new Queue(name, { connection: this.connection as any, prefix: '{bull}', defaultJobOptions: defaults });
      this.queues.set(name, queue);
    }
    return queue;
  }

  /** jobId = application id makes submission idempotent (double clicks, retries). */
  submission(job: SubmissionJob) {
    return this.q(QUEUES.submissions).add('persist', job, { jobId: job.applicationId });
  }

  /**
   * Debounced draft persistence: repeated autosaves within 30s collapse into a
   * single DB write (BullMQ deduplication with ttl).
   */
  draft(job: DraftPersistJob) {
    return this.q(QUEUES.drafts).add('persist', job, {
      delay: 30_000,
      deduplication: { id: `${job.exerciseId}:${job.userId}`, ttl: 30_000 },
      attempts: 5,
    });
  }

  notify(job: NotificationJob, opts: JobsOptions = {}) {
    return this.q(QUEUES.notifications).add(job.template, job, opts);
  }

  notifyMany(jobs: NotificationJob[]) {
    return this.q(QUEUES.notifications).addBulk(jobs.map((data) => ({ name: data.template, data, opts: { priority: 5 } })));
  }

  pdfSlip(job: PdfSlipJob) {
    return this.q(QUEUES.pdf).add('slip', job, { jobId: `slip-${job.applicationId}` });
  }

  export(job: ExportJob) {
    return this.q(QUEUES.exports).add('export', job, { jobId: job.exportId, attempts: 3 });
  }

  verifyDocument(job: DocumentVerifyJob) {
    return this.q(QUEUES.documents).add('verify', job);
  }

  contact(job: ContactJob) {
    return this.q(QUEUES.contact).add('message', job);
  }

  async depth(name: QueueName): Promise<number> {
    return this.q(name).count();
  }

  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    await this.connection.quit().catch(() => undefined);
  }
}
