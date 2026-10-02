import { JobsOptions, Queue } from 'bullmq';
import { QUEUES, QueueName } from '@armyx/shared';
import { createRedis } from './infra';

const connection = createRedis();
const cache = new Map<string, Queue>();
const defaults: JobsOptions = { attempts: 8, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: { age: 3600, count: 10000 }, removeOnFail: { age: 7 * 86400 } };

/** Producer handle for chaining jobs (e.g. submission -> pdf -> notification). */
export function queue(name: QueueName): Queue {
  let q = cache.get(name);
  if (!q) {
    q = new Queue(name, { connection: connection as any, prefix: '{bull}', defaultJobOptions: defaults });
    cache.set(name, q);
  }
  return q;
}
export { QUEUES };
export const closeQueues = async () => {
  await Promise.all([...cache.values()].map((q) => q.close()));
  await connection.quit().catch(() => undefined);
};
