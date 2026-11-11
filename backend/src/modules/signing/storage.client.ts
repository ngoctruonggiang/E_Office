import { Readable } from 'stream';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Direct S3/MinIO access for the signing bridge.
 *
 * Documenso (in its container) reaches MinIO at `minio:9002`; gafood runs on
 * the host and reaches the SAME MinIO at `localhost:9002`. Because S3 SigV4
 * signs the host, gafood cannot reuse Documenso's presigned URLs — instead it
 * signs its own requests against its own endpoint. We only need the object key
 * (parsed from Documenso's presigned URL path) to read/write the same object.
 */
@Injectable()
export class StorageClient {
  private readonly logger = new Logger(StorageClient.name);
  private readonly s3: S3Client;
  readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('S3_BUCKET') ?? 'documenso';
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
  }

  /**
   * Extract the object key from a Documenso presigned URL. The path is
   * `/<bucket>/<key...>` (path-style); we strip the leading `/<bucket>/`.
   */
  keyFromPresignedUrl(url: string): string {
    const { pathname } = new URL(url);
    const prefix = `/${this.bucket}/`;
    const path = pathname.startsWith(prefix)
      ? pathname.slice(prefix.length)
      : pathname.replace(/^\//, '');
    return decodeURIComponent(path);
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    this.logger.debug(`Uploaded ${key} (${body.length} bytes) to ${this.bucket}`);
  }

  async getObject(
    key: string,
  ): Promise<{ body: Readable; contentType?: string; contentLength?: number }> {
    const res = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return {
      body: res.Body as Readable,
      contentType: res.ContentType,
      contentLength: res.ContentLength,
    };
  }
}
