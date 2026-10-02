/**
 * S3-compatible object storage. Browsers upload documents DIRECTLY to the
 * bucket with a short-lived presigned POST whose policy enforces content type
 * and size, so large files never pass through (or tie up) the API pods.
 * Reads use presigned GET URLs that expire after a few minutes.
 * The bucket itself is private, encrypted at rest (SSE) and versioned.
 */
import { Injectable } from '@nestjs/common';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config/config';

function client(endpoint?: string) {
  const c = config();
  return new S3Client({
    region: c.S3_REGION,
    endpoint,
    forcePathStyle: c.S3_FORCE_PATH_STYLE,
    credentials: c.S3_ACCESS_KEY_ID ? { accessKeyId: c.S3_ACCESS_KEY_ID, secretAccessKey: c.S3_SECRET_ACCESS_KEY! } : undefined,
  });
}

@Injectable()
export class StorageService {
  private readonly c = config();
  /** Internal client (cluster network) for HEAD checks. */
  private readonly internal = client(this.c.S3_ENDPOINT);
  /** Signs URLs with the public hostname the browser will use. */
  private readonly signer = client(this.c.S3_PUBLIC_ENDPOINT ?? this.c.S3_ENDPOINT);

  async presignUpload(key: string, contentType: string, maxBytes: number) {
    const sse = this.c.S3_SSE;
    return createPresignedPost(this.signer, {
      Bucket: this.c.S3_BUCKET,
      Key: key,
      Conditions: [
        ['content-length-range', 1, maxBytes],
        ['eq', '$Content-Type', contentType],
        ...(sse ? [['eq', '$x-amz-server-side-encryption', sse] as ['eq', string, string]] : []),
      ],
      Fields: { 'Content-Type': contentType, ...(sse ? { 'x-amz-server-side-encryption': sse } : {}) },
      Expires: 300,
    });
  }

  async presignDownload(key: string, expiresIn = 300, downloadName?: string) {
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({
        Bucket: this.c.S3_BUCKET,
        Key: key,
        ResponseContentDisposition: downloadName ? `attachment; filename="${downloadName}"` : 'inline',
      }),
      { expiresIn },
    );
  }

  async head(key: string): Promise<{ size: number; contentType?: string } | null> {
    try {
      const r = await this.internal.send(new HeadObjectCommand({ Bucket: this.c.S3_BUCKET, Key: key }));
      return { size: r.ContentLength ?? 0, contentType: r.ContentType };
    } catch {
      return null;
    }
  }
}
