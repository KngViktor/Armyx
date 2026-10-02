/** Shared connections for all processors in this worker process. */
import { Pool } from 'pg';
import Redis, { Cluster } from 'ioredis';
import { S3Client } from '@aws-sdk/client-s3';
import pino from 'pino';
import { FieldCrypto } from '@armyx/shared/server';
import { env } from './env';

export const log = pino({ level: process.env.LOG_LEVEL ?? 'info', base: { svc: 'workers' } });

export const primary = new Pool({ connectionString: env.databaseUrl, max: 10, application_name: 'armyx-workers' });
export const replica = env.replicaUrl ? new Pool({ connectionString: env.replicaUrl, max: 5, application_name: 'armyx-workers-ro' }) : primary;

export function createRedis(): Redis | Cluster {
  if (env.redisClusterNodes) {
    const nodes = env.redisClusterNodes.split(',').map((n) => ({ host: n.split(':')[0]!, port: Number(n.split(':')[1] ?? 6379) }));
    return new Redis.Cluster(nodes, { redisOptions: { maxRetriesPerRequest: null, password: process.env.REDIS_PASSWORD } });
  }
  return new Redis(env.redisUrl, { maxRetriesPerRequest: null });
}
/** General purpose client (caches, counters). BullMQ gets its own connections. */
export const redis = createRedis();

export const s3 = new S3Client({
  region: env.s3.region,
  endpoint: env.s3.endpoint,
  forcePathStyle: env.s3.forcePathStyle,
  credentials: env.s3.accessKeyId ? { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey! } : undefined,
});

export const crypto = FieldCrypto.fromEnv();
export const blindIndexKey = Buffer.from(process.env.BLIND_INDEX_KEY ?? '', 'base64');

/** Run fn in a transaction on the primary. */
export async function tx<T>(fn: (c: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const c = await primary.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

/** Calendar date in Nigeria (WAT) for daily statistics. */
export const lagosDate = (d: Date) => new Date(d.getTime() + 3600_000).toISOString().slice(0, 10);
