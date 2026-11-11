import { apiFetch, API_BASE_URL } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/storage";

// Mirrors be DocumentResponseDto (document/dto/document-response.dto.ts).
export type DocumentMeta = {
  id: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  type: string;
  createdById: string;
  deletedFlag: boolean;
  createdAt: string;
};

/** Document metadata by id (GET /documents/:id). */
export function getDocument(id: string): Promise<DocumentMeta> {
  return apiFetch<DocumentMeta>(`/documents/${id}`);
}

/**
 * Absolute URL to stream/download a document. The endpoint requires a Bearer
 * token, so opening it in a new tab won't authenticate — prefer
 * `downloadDocument` which fetches with auth then saves the blob.
 */
export function documentDownloadUrl(id: string): string {
  return `${API_BASE_URL}/documents/${id}/download`;
}

/**
 * Fetch a document with auth and trigger a browser save. The download endpoint
 * is Bearer-protected, so we can't just point an <a> at it.
 */
export async function downloadDocument(
  id: string,
  fileName: string,
): Promise<void> {
  const res = await fetch(documentDownloadUrl(id), {
    headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Soft-delete a document (DELETE /documents/:id). Creator-only on the backend. */
export function softDeleteDocument(id: string): Promise<void> {
  return apiFetch<void>(`/documents/${id}`, { method: "DELETE" });
}

/**
 * Which section an attachment occupies within a request.
 *  - MAIN: core content, creator-managed, editable only while DRAFT.
 *  - SECONDARY: supporting file anyone with access may add (default).
 */
export type RequestDocSection = "MAIN" | "SECONDARY";

/** Upload a file, optionally attaching it to a request (POST /documents/upload). */
export function uploadDocument(
  file: File,
  opts: { requestId?: string; name?: string; section?: RequestDocSection } = {},
): Promise<DocumentMeta> {
  const form = new FormData();
  form.append("file", file);
  if (opts.requestId) form.append("requestId", opts.requestId);
  if (opts.name) form.append("name", opts.name);
  if (opts.section) form.append("section", opts.section);
  return apiFetch<DocumentMeta>(`/documents/upload`, {
    method: "POST",
    body: form,
  });
}

/**
 * Remove a document attached to a request (DELETE /requests/:id/documents/:documentId).
 * Creator-only; main documents may only be removed while the request is a draft.
 */
export function detachRequestDocument(
  requestId: string,
  documentId: string,
): Promise<void> {
  return apiFetch<void>(`/requests/${requestId}/documents/${documentId}`, {
    method: "DELETE",
  });
}
