# Document — Controller & DTOs

`DocumentController` (`src/modules/document/document.controller.ts`), base path
`/documents`. All endpoints require a valid access token.

Files are persisted by `DocumentStorageService`, which has two drivers selected
via `STORAGE_DRIVER`: `disk` (local `./uploads`, dev default) or `s3` (the
MinIO/S3 bucket shared with Documenso, used in staging/production). In both cases
`Document.filePath` records a locator — an on‑disk path, or an `s3://<key>` key
namespaced as `<repo>/<requestorId>/<requestId>/<file>`. The internal `filePath`
is never returned to clients. See `docs/document/service.md` for details.

## Endpoints

| Method | Path | Auth | Body | Returns |
| --- | --- | --- | --- | --- |
| POST | `/documents/upload` | JWT | multipart: `file` + `UploadDocumentDto` | `DocumentResponseDto` |
| PATCH | `/documents/:id/name` | JWT | `UpdateDocumentNameDto` | `DocumentResponseDto` |
| DELETE | `/documents/:id` | JWT | — | 204 (soft delete) |
| DELETE | `/documents/:id/hard` | JWT + **admin** | — | 204 (hard delete) |

### POST /documents/upload
`multipart/form-data` with a `file` part (handled by `FileInterceptor`, max
20 MB) plus optional text fields. If `requestId` is supplied, the document is
linked to that request (`RequestDocument`); `404` if the request doesn't exist,
`400` if no file is sent.

### PATCH /documents/:id/name
Renames a document. Creator‑only; `404` if missing or soft‑deleted.

### DELETE /documents/:id (soft)
Sets `deletedFlag = true` and `deletedAt`. The file stays on disk. Creator‑only.

### DELETE /documents/:id/hard (admin)
Protected by `RolesGuard` + `@Roles('admin')`. Removes the `RequestDocument`
links and the `Document` row, then deletes the file from disk (best‑effort).

## DTOs

### UploadDocumentDto (multipart text fields)
| Field | Type | Notes |
| --- | --- | --- |
| `requestId?` | string | request to attach the document to |
| `name?` | string | display name; defaults to the original filename |
| `type?` | `DocumentType` | `NORMAL` (default) \| `PRIMARY_SIGNED` |

### UpdateDocumentNameDto (request)
`{ name: string }` (non‑empty).

### DocumentResponseDto (response)
```jsonc
{
  "id": "...",
  "name": "contract.pdf",
  "mimeType": "application/pdf" | null,
  "size": 12345 | null,
  "type": "NORMAL",
  "createdById": "...",
  "deletedFlag": false,
  "createdAt": "2026-..."
}
```
