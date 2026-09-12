import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';

/**
 * TAPS-2.13: uploads admin-provided files (PastPaper/StudyMaterial/Book
 * source PDFs) to Cloudflare R2 — an S3-compatible bucket, per
 * 05-ARCHITECTURE.md §2 — and returns the durable public URL that those
 * rows' `fileUrl` fields get populated with. Before this story, `fileUrl`
 * was a bare string every caller was assumed to already have a hosted URL
 * for; this is the first real producer of one.
 *
 * Env vars are checked lazily inside `upload()`, not in the constructor —
 * same convention as AuthService.login's ADMIN_PASSWORD_HASH check and
 * JwtAuthGuard's JWT_SECRET check — so a deployment/test run that never
 * calls upload() (most of them) never fails to boot just because R2 isn't
 * configured there.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | undefined;
  private bucket = '';
  private publicUrl = '';

  /**
   * Uploads `body` under a random, collision-proof key (prefixed by
   * `folder`, extension preserved from `originalName`) and returns the
   * public URL it's reachable at via R2_PUBLIC_URL. Throws
   * InternalServerErrorException if R2 isn't configured, or if the upload
   * itself fails — unlike PastPaperIngestionService.ingest, there's no
   * partial/best-effort state to fall back to here, so a failed upload
   * must fail the request that triggered it.
   */
  async upload(
    body: Buffer,
    originalName: string,
    contentType: string,
    folder = 'past-papers',
  ): Promise<string> {
    const client = this.getClient();
    const extension = originalName.includes('.')
      ? originalName.slice(originalName.lastIndexOf('.'))
      : '';
    const key = `${folder}/${randomUUID()}${extension}`;

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch (error) {
      this.logger.error(`Upload failed for key ${key}: ${(error as Error).message}`);
      throw new InternalServerErrorException('File upload failed');
    }

    return `${this.publicUrl}/${key}`;
  }

  /**
   * Builds (and caches) the R2 client from `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/
   * `R2_SECRET_ACCESS_KEY`/`R2_BUCKET_NAME`/`R2_PUBLIC_URL`. R2 is
   * S3-compatible but region-less — `region: 'auto'` is Cloudflare's
   * documented value, and the endpoint is R2's account-scoped S3 API host,
   * not a real AWS region endpoint.
   *
   * The `.us.` segment is required, not cosmetic: this project's bucket was
   * created under Cloudflare's "United States (US)" data-location
   * jurisdiction, which serves its S3 API from a jurisdiction-scoped host
   * (`<account>.us.r2.cloudflarestorage.com`) rather than the default
   * jurisdiction's `<account>.r2.cloudflarestorage.com`. Discovered the hard
   * way — every request against the default host came back `403
   * AccessDenied` with fully valid credentials (confirmed via a direct
   * HeadBucket/ListObjectsV2 probe bypassing this service entirely), which
   * is exactly what a jurisdiction/endpoint mismatch looks like, not a
   * credentials or permissions problem. If this bucket's jurisdiction ever
   * changes, this literal needs to change with it.
   */
  private getClient(): S3Client {
    if (this.client) {
      return this.client;
    }

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
      // Misconfiguration, not a bad request — matches AuthService.login's
      // handling of a missing ADMIN_PASSWORD_HASH.
      throw new InternalServerErrorException(
        'Object storage is not configured: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL must all be set.',
      );
    }

    this.bucket = bucket;
    this.publicUrl = publicUrl.replace(/\/$/, '');
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.us.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    return this.client;
  }
}
