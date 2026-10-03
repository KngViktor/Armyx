import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import sharp from 'sharp';
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob';
import { SiteSettings, collections } from './collections/index';
import { siteContentEndpoint } from './lib/site-content';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default buildConfig({
  serverURL: process.env.CMS_PUBLIC_URL ?? 'http://localhost:3001',
  secret: process.env.PAYLOAD_SECRET ?? '',
  admin: {
    user: 'users',
    meta: { titleSuffix: ' — Nigerian Army CMS' },
  },
  collections,
  globals: [SiteSettings],
  endpoints: [siteContentEndpoint],
  db: postgresAdapter({
    pool: { connectionString: process.env.CMS_DATABASE_URL, max: process.env.VERCEL ? 3 : 10 },
    // Optional dedicated schema, so the CMS can share a database safely.
    schemaName: process.env.CMS_DB_SCHEMA || undefined,
    // Development pushes schema changes directly; production applies the
    // committed migrations in src/migrations (`payload migrate`).
    push: process.env.NODE_ENV !== 'production',
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  sharp,
  // Serverless hosts (Vercel) have no persistent disk: store uploads in Vercel Blob when configured.
  plugins: process.env.BLOB_READ_WRITE_TOKEN
    ? [vercelBlobStorage({ collections: { media: true }, token: process.env.BLOB_READ_WRITE_TOKEN })]
    : [],
  cors: [process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'],
  csrf: [process.env.CMS_PUBLIC_URL ?? 'http://localhost:3001'],
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  upload: { limits: { fileSize: 20 * 1024 * 1024 } },
});
