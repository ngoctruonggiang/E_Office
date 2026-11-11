# Document — Services

## DocumentService (`document/document.service.ts`)
Manages document records and their files, with soft delete by default and an
admin‑only hard delete.

| Method | Signature | Behaviour |
| --- | --- | --- |
| `upload` | `(userId, file, UploadDocumentDto) → DocumentResponseDto` | Validates the optional `requestId`, persists the bytes via `DocumentStorageService.save` (disk or MinIO), then creates the `Document` (name, filePath locator, mimeType, size, type) and links it to the request when given. |
| `updateName` | `(userId, id, name) → DocumentResponseDto` | Loads a non‑deleted, owned document (`getActiveOwned`) and renames it. |
| `openStream` | `(filePath) → Readable` | Resolves the stored locator to a readable stream (delegates to `DocumentStorageService`). Used by the controller's download route. |
| `softDelete` | `(userId, id) → void` | Owner‑only; sets `deletedFlag`/`deletedAt`. File kept in storage. |
| `hardDelete` | `(id) → void` | Deletes `RequestDocument` links + the row in a transaction, then removes the bytes via `DocumentStorageService.remove` (best‑effort, logged on failure). Authorization is enforced by the controller's `RolesGuard`. |

### getActiveOwned (private)
Loads a document by id; throws `404` if missing **or** soft‑deleted, `403` if the
caller isn't the creator. Used by `updateName` and `softDelete`.

## Storage drivers (`document/document-storage.service.ts`)
`DocumentStorageService` decouples file bytes from the database and picks a
backend at boot via the `STORAGE_DRIVER` env var:

- `disk` (default, dev) — writes to `UPLOAD_DIR`; `filePath` holds the on‑disk path.
- `s3` (staging/prod, set in `.gitlab-ci.yml`) — writes to the MinIO/S3 bucket
  shared with Documenso (`S3_*` credentials). Objects are keyed
  `<STORAGE_REPO_NAME>/<requestorId>/<requestId|_unattached>/<uuid>-<name>`, and
  `filePath` holds an `s3://<key>` locator. The `s3://` prefix lets `openStream`
  / `remove` route each document to the right backend, so legacy disk rows keep
  working after switching drivers.

## Upload configuration (`document/multer.config.ts`)
- `documentStorage` — Multer `memoryStorage`; the file buffer is handed to
  `DocumentStorageService`, which routes it to disk or MinIO.
- `UPLOAD_DIR` — defaults to `./uploads` (override with the `UPLOAD_DIR` env var).
  Added to `.gitignore`. Used only by the `disk` driver.
- `MAX_UPLOAD_BYTES` — 20 MB per file, enforced by the `FileInterceptor`.

## Entity (`document/entities/document.entity.ts`)
`DocumentEntity` is an alias over the generated Prisma `Document` model:
`id`, `name`, `filePath`, `mimeType`, `size`, `type`, `createdById`,
`deletedFlag`, `deletedAt`, `createdAt`, `updatedAt`.
