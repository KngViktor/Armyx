import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import sharp from 'sharp';
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
    pool: { connectionString: process.env.CMS_DATABASE_URL },
    // Schema changes are applied through generated migrations in production.
    push: process.env.NODE_ENV !== 'production',
  }),
  sharp,
  cors: [process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'],
  csrf: [process.env.CMS_PUBLIC_URL ?? 'http://localhost:3001'],
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  upload: { limits: { fileSize: 20 * 1024 * 1024 } },
});
