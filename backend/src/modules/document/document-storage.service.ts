import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, createReadStream } from 'fs';
import { unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { Readable } from 'stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UPLOAD_DIR } from './multer.config';

/** Where document bytes physically live. */
export type StorageDriver = 'disk' | 's3';

/** Objects stored on S3/MinIO are referenced by a locator with this prefix. */
const S3_LOCATOR_PREFIX = 's3://';

/**
 * File-bytes persistence for documents, decoupled from the database. Two
 * drivers, selected once at boot via the `STORAGE_DRIVER` env var:
 *
 *   - `disk` (default, dev): writes to the local `UPLOAD_DIR`.
 *   - `s3`  (staging/prod):  writes to the MinIO/S3 bucket shared with
 *     Documenso (same `S3_*` credentials as the signing bridge).
 *
 * The returned *locator* is what gets stored in `Document.filePath`:
 *   - disk → the on-disk path (unchanged from the legacy behaviour, so old
 *     rows keep streaming),
 *   - s3   → `s3://<objectKey>`.
 *
 * On S3 the object key is namespaced per requestor/request so a request's
 * attachments live together and never collide with Documenso's signing PDFs:
 *
 *     <repo>/<requestorId>/<requestId>/<uuid>-<originalName>
 *
 * Unattached uploads (no requestId) go under `<repo>/<requestorId>/_unattached/`.
 */
@Injectable()
export class DocumentStorageService {
  private readonly logger = new Logger(DocumentStorageService.name);
  readonly driver: StorageDriver;

  private readonly bucket: string;
  private readonly repo: string;
  private readonly s3?: S3Client;

  constructor(config: ConfigService) {
    this.driver = config.get<string>('STORAGE_DRIVER') === 's3' ? 's3' : 'disk';
    this.bucket = config.get<string>('S3_BUCKET') ?? 'documenso';
    // Top-level key prefix so this app's files are namespaced inside the
    // shared bucket. Defaults to the repository name.
    this.repo = config.get<string>('STORAGE_REPO_NAME') ?? 'gafood';

    if (this.driver === 's3') {
      this.s3 = new S3Client({
        endpoint: config.get<string>('S3_ENDPOINT') ?? 'http://localhost:9002',
        region: config.get<string>('S3_REGION') ?? 'us-east-1',
        forcePathStyle: true,
        credentials: {
          accessKeyId: config.get<string>('S3_ACCESS_KEY_ID') ?? 'documenso',
          secretAccessKey:
            config.get<string>('S3_SECRET_ACCESS_KEY') ?? 'password',
        },
      });
      this.logger.log(
        `Document storage driver: s3 (bucket "${this.bucket}", prefix "${this.repo}/")`,
      );
    } else {
      this.logger.log(`Document storage driver: disk (${UPLOAD_DIR})`);
    }
  }

  /**
   * Persist an uploaded file's bytes and return its locator (to be saved in
   * `Document.filePath`). `requestId` is optional — unattached uploads still
   * get a stable, namespaced key on S3.
   */
  async save(
    file: Express.Multer.File,
    opts: { requestorId: string; requestId?: string },
  ): Promise<string> {
    if (!file.buffer) {
      // memoryStorage is configured on the route; guard against misconfig.
      throw new Error('Uploaded file has no buffer (expected memoryStorage)');
    }

    if (this.driver === 's3') {
      const key = this.buildKey(
        opts.requestorId,
        opts.requestId,
        file.originalname,
      );
      await this.s3!.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      this.logger.debug(
        `Uploaded ${key} (${file.size} bytes) to ${this.bucket}`,
      );
      return `${S3_LOCATOR_PREFIX}${key}`;
    }

    // disk: collision-free, randomized filename (legacy behaviour).
    if (!existsSync(UPLOAD_DIR)) {
      mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    const diskPath = join(
      UPLOAD_DIR,
      `${randomUUID()}${extname(file.originalname)}`,
    );
    await writeFile(diskPath, file.buffer);
    return diskPath;
  }

  /** Open a readable stream for a stored document, regardless of driver. */
  async openStream(locator: string): Promise<Readable> {
    if (this.isS3(locator)) {
      const key = locator.slice(S3_LOCATOR_PREFIX.length);
      const res = await this.s3!.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return res.Body as Readable;
    }
    return createReadStream(locator);
  }

  /** Best-effort removal of the bytes (used by hard delete). */
  async remove(locator: string): Promise<void> {
    if (this.isS3(locator)) {
      const key = locator.slice(S3_LOCATOR_PREFIX.length);
      await this.s3!.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return;
    }
    await unlink(locator);
  }

  private isS3(locator: string): boolean {
    return locator.startsWith(S3_LOCATOR_PREFIX);
  }

  /** `<repo>/<requestorId>/<requestId|_unattached>/<uuid>-<originalName>`. */
  private buildKey(
    requestorId: string,
    requestId: string | undefined,
    originalName: string,
  ): string {
    const scope = requestId ?? '_unattached';
    const safeName = sanitizeFilename(originalName);
    return `${this.repo}/${requestorId}/${scope}/${randomUUID()}-${safeName}`;
  }
}

/** Strip path separators / control chars so the name is a safe key segment. */
function sanitizeFilename(name: string): string {
  const base = name.replace(/^.*[\\/]/, '').trim();
  const cleaned = base.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_');
  return cleaned || 'file';
}
