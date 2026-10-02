/**
 * Redis client (single node in dev, Redis Cluster in production).
 * Used for sessions, OTPs, rate limiting, caches and BullMQ.
 *
 * Note for Redis Cluster: multi-key operations must share a hash slot. Keys
 * that are used together therefore embed a {hash tag}.
 */
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis, { Cluster } from 'ioredis';
import { config } from '../config/config';

export type RedisClient = Redis | Cluster;

export function createRedis(opts: { forBullmq?: boolean } = {}): RedisClient {
  const c = config();
  const extra = opts.forBullmq ? { maxRetriesPerRequest: null } : { maxRetriesPerRequest: 2 };
  if (c.REDIS_CLUSTER_NODES) {
    const nodes = c.REDIS_CLUSTER_NODES.split(',').map((n) => {
      const [host, port] = n.trim().split(':');
      return { host: host!, port: Number(port ?? 6379) };
    });
    return new Redis.Cluster(nodes, {
      redisOptions: { ...extra, password: process.env.REDIS_PASSWORD, tls: process.env.REDIS_TLS === 'true' ? {} : undefined },
      scaleReads: 'slave',
    });
  }
  return new Redis(c.REDIS_URL, { ...extra, enableAutoPipelining: true });
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: RedisClient = createRedis();

  /** Cache-aside helper: returns cached JSON or computes, stores with TTL and returns. */
  async cached<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    const hit = await this.client.get(key);
    if (hit) return JSON.parse(hit) as T;
    const value = await compute();
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    return value;
  }

  async onModuleDestroy() {
    await this.client.quit().catch(() => undefined);
  }
}
