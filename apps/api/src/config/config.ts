/**
 * Environment configuration, validated once at boot. The process refuses to
 * start with an invalid config rather than failing later under load.
 */
import { z } from 'zod';

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  METRICS_PORT: z.coerce.number().default(9464),
  /** Comma-separated list of browser origins allowed to call the API with credentials. */
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  PUBLIC_WEB_URL: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string(),
  /** Read replica(s) behind PgBouncer. Falls back to the primary when unset. */
  DATABASE_REPLICA_URL: z.string().optional(),
  DB_POOL_MAX: z.coerce.number().default(20),

  /** Either a single Redis URL or a comma-separated list of cluster nodes. */
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_CLUSTER_NODES: z.string().optional(),

  S3_ENDPOINT: z.string().optional(),
  S3_PUBLIC_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('armyx-documents'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: bool.default(true),
  /** Server-side encryption header for uploads ('AES256' or 'aws:kms'). Empty disables (local dev stores only). */
  S3_SSE: z.string().default('AES256'),

  SESSION_COOKIE: z.string().default('sid'),
  SESSION_TTL_SECONDS: z.coerce.number().default(60 * 60 * 2),
  ADMIN_SESSION_TTL_SECONDS: z.coerce.number().default(60 * 30),
  COOKIE_SECURE: bool.default(false),
  /** Used to salt IP hashes in logs. */
  IP_HASH_SALT: z.string().min(16),

  TURNSTILE_SECRET: z.string().optional(),
  /** Maximum concurrent in-flight requests per pod before load shedding (503 + Retry-After). */
  MAX_INFLIGHT: z.coerce.number().default(400),
  /** Trust X-Forwarded-For / CF-Connecting-IP from this many proxy hops. */
  TRUST_PROXY_HOPS: z.coerce.number().default(1),
  LOG_LEVEL: z.string().default('info'),
});

export type AppConfig = z.infer<typeof schema>;

let cached: AppConfig | undefined;
export function config(): AppConfig {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      // eslint-disable-next-line no-console
      console.error('Invalid configuration:', z.prettifyError(parsed.error));
      process.exit(1);
    }
    cached = parsed.data;
  }
  return cached;
}
