export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL!,
  replicaUrl: process.env.DATABASE_REPLICA_URL,
  redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  redisClusterNodes: process.env.REDIS_CLUSTER_NODES,
  queues: (process.env.WORKER_QUEUES ?? 'submissions,drafts,notifications,pdf,exports,documents,contact,maintenance').split(',').map((s) => s.trim()).filter(Boolean),
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 10),
  metricsPort: Number(process.env.WORKER_METRICS_PORT ?? 9465),
  publicWebUrl: process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000',
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: process.env.S3_BUCKET ?? 'armyx-documents',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
    /** Server-side encryption for objects the workers write. Empty disables (local dev only). */
    sse: (process.env.S3_SSE ?? 'AES256') as 'AES256' | 'aws:kms' | '',
  },
  smtpUrl: process.env.SMTP_URL ?? 'smtp://127.0.0.1:1025',
  mailFrom: process.env.MAIL_FROM ?? 'Nigerian Army Recruitment <no-reply@army.mil.ng>',
  contactDesk: process.env.CONTACT_DESK_EMAIL ?? 'info@army.mil.ng',
  sms: {
    provider: process.env.SMS_PROVIDER ?? 'console',
    url: process.env.SMS_API_URL,
    key: process.env.SMS_API_KEY,
    sender: process.env.SMS_SENDER_ID ?? 'NIGARMY',
  },
};
if (!env.databaseUrl) throw new Error('DATABASE_URL is required');
