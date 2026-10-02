/**
 * Worker entrypoint. One image, many roles: WORKER_QUEUES selects which
 * queues this process consumes so each queue can be scaled independently
 * (e.g. a dedicated deployment for `submissions` autoscaled on its backlog).
 */
import http from 'node:http';
import { Worker, Job } from 'bullmq';
import { Counter, Gauge, Histogram, collectDefaultMetrics, register } from 'prom-client';
import { QUEUES, QueueName } from '@armyx/shared';
import { env } from './lib/env';
import { createRedis, log, primary, redis, replica } from './lib/infra';
import { closeQueues, queue } from './lib/queues';
import { processSubmission } from './processors/submission';
import { processDraft } from './processors/drafts';
import { processNotification } from './processors/notifications';
import { processPdf } from './processors/pdf';
import { processExport } from './processors/exports';
import { processDocument } from './processors/documents';
import { processContact } from './processors/contact';
import { processMaintenance } from './processors/maintenance';

collectDefaultMetrics({ prefix: 'armyx_workers_' });
const jobsTotal = new Counter({ name: 'armyx_jobs_total', help: 'Processed jobs', labelNames: ['queue', 'result'] });
const jobDuration = new Histogram({ name: 'armyx_job_duration_seconds', help: 'Job duration', labelNames: ['queue'], buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 30, 120] });
const queueDepth = new Gauge({ name: 'armyx_queue_depth', help: 'Waiting + delayed + prioritized jobs', labelNames: ['queue'] });

const processors: Record<QueueName, (job: Job) => Promise<unknown>> = {
  submissions: processSubmission,
  drafts: processDraft,
  notifications: processNotification,
  pdf: processPdf,
  exports: processExport,
  documents: processDocument,
  contact: processContact,
  maintenance: processMaintenance,
};

/** Per-queue concurrency: cheap I/O jobs run wide, heavy jobs run narrow. */
const concurrency: Partial<Record<QueueName, number>> = {
  submissions: env.concurrency * 2,
  notifications: env.concurrency * 3,
  pdf: Math.max(2, Math.floor(env.concurrency / 2)),
  exports: 1,
  maintenance: 1,
};

const workers: Worker[] = [];
for (const name of env.queues as QueueName[]) {
  if (!processors[name]) throw new Error(`Unknown queue ${name}`);
  const w = new Worker(
    name,
    async (job) => {
      const end = jobDuration.startTimer({ queue: name });
      try {
        return await processors[name](job);
      } finally {
        end();
      }
    },
    {
      connection: createRedis() as any,
      prefix: '{bull}',
      concurrency: concurrency[name] ?? env.concurrency,
      // Notifications are rate limited to respect SMS/email provider quotas.
      ...(name === 'notifications' ? { limiter: { max: 200, duration: 1000 } } : {}),
    },
  );
  w.on('completed', () => jobsTotal.inc({ queue: name, result: 'ok' }));
  w.on('failed', (job, err) => {
    jobsTotal.inc({ queue: name, result: 'failed' });
    log.error({ queue: name, jobId: job?.id, attempts: job?.attemptsMade, err: err.message }, 'job failed');
  });
  workers.push(w);
  log.info({ queue: name, concurrency: concurrency[name] ?? env.concurrency }, 'worker started');
}

// Repeatable maintenance jobs (BullMQ de-duplicates schedulers across pods).
if (env.queues.includes(QUEUES.maintenance)) {
  const q = queue(QUEUES.maintenance);
  q.upsertJobScheduler('reconcile-stats', { every: 5 * 60_000 }, { name: 'reconcile-stats' });
  q.upsertJobScheduler('retention', { pattern: '0 2 * * *', tz: 'Africa/Lagos' }, { name: 'retention' });
}

// Queue depth metrics drive KEDA autoscaling of worker deployments.
setInterval(async () => {
  for (const name of env.queues as QueueName[]) {
    try {
      const c = await queue(name).getJobCounts('waiting', 'delayed', 'prioritized');
      queueDepth.set({ queue: name }, (c.waiting ?? 0) + (c.delayed ?? 0) + (c.prioritized ?? 0));
    } catch { /* transient */ }
  }
}, 10_000).unref();

http
  .createServer(async (req, res) => {
    if (req.url === '/metrics') {
      res.setHeader('Content-Type', register.contentType);
      res.end(await register.metrics());
    } else if (req.url === '/health') {
      res.end('ok');
    } else {
      res.statusCode = 404;
      res.end();
    }
  })
  .listen(env.metricsPort);

async function shutdown(signal: string) {
  log.info({ signal }, 'shutting down: finishing in-flight jobs');
  await Promise.all(workers.map((w) => w.close()));
  await closeQueues();
  await redis.quit().catch(() => undefined);
  await primary.end();
  if (replica !== primary) await replica.end();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
