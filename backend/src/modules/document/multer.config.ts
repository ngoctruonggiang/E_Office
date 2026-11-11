import { memoryStorage } from 'multer';

/**
 * Local upload directory, used by the `disk` storage driver
 * (see DocumentStorageService). Override with the `UPLOAD_DIR` env var.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';

/**
 * Buffer uploads in memory so DocumentStorageService can route the bytes to
 * either the local disk or MinIO/S3. Files are capped at MAX_UPLOAD_BYTES.
 */
export const documentStorage = memoryStorage();

/** 20 MB per file. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
