// Creates the documents bucket (local/dev S3-compatible stores only; production buckets are provisioned by IaC).
import { S3Client, CreateBucketCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
const s3 = new S3Client({
  region: process.env.S3_REGION ?? 'us-east-1', endpoint: process.env.S3_ENDPOINT, forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
});
const Bucket = process.env.S3_BUCKET ?? 'armyx-documents';
try { await s3.send(new CreateBucketCommand({ Bucket })); console.log('bucket created'); } catch (e) { console.log('bucket:', e.name); }
await s3.send(new PutBucketCorsCommand({ Bucket, CORSConfiguration: { CORSRules: [{ AllowedOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','), AllowedMethods: ['POST', 'GET'], AllowedHeaders: ['*'], MaxAgeSeconds: 3600 }] } }));
console.log('bucket CORS set');
