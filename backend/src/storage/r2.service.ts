import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';

/**
 * Thin wrapper over Cloudflare R2 (S3-compatible object storage). The bucket is
 * PRIVATE — objects are never public. Uploads go through the backend (so we can
 * validate + authorize first) and downloads are served as short-lived signed URLs
 * that force the original filename. Credentials come from env:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT
 */
@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private readonly bucket = process.env.R2_BUCKET ?? '';
  private client: S3Client | null = null;

  /** Whether R2 is configured. Lets callers fail with a clear message rather than a cryptic SDK error. */
  get isConfigured(): boolean {
    return Boolean(
      process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        this.bucket &&
        (process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID),
    );
  }

  private getClient(): S3Client {
    if (!this.isConfigured) {
      throw new InternalServerErrorException(
        'File storage is not configured. Set R2_* environment variables.',
      );
    }
    if (!this.client) {
      const endpoint =
        process.env.R2_ENDPOINT ||
        `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
        },
      });
    }
    return this.client;
  }

  /** Store bytes at `key`. Throws a clean 500 on transport failure. */
  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    try {
      await this.getClient().send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch (err) {
      this.logger.error(`R2 putObject failed for ${key}: ${(err as Error).message}`);
      throw new InternalServerErrorException('Failed to upload file to storage.');
    }
  }

  /**
   * A time-limited GET URL for the object. `downloadName` sets the download filename
   * via response-content-disposition so users get the original name back.
   */
  async getSignedDownloadUrl(
    key: string,
    downloadName: string,
    expiresInSeconds = 300,
  ): Promise<string> {
    const safe = downloadName.replace(/"/g, '');
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${safe}"`,
    });
    return getSignedUrl(this.getClient(), command, { expiresIn: expiresInSeconds });
  }

  /** Best-effort delete. Never throws — a failed purge must not block the DB soft-delete. */
  async deleteObject(key: string): Promise<void> {
    try {
      await this.getClient().send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      this.logger.warn(`R2 deleteObject failed for ${key}: ${(err as Error).message}`);
    }
  }
}
