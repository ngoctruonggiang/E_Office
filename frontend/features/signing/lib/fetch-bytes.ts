"use client";

import { documentDownloadUrl } from "@/features/documents/api/documents";
import { getAccessToken } from "@/lib/auth/storage";

/**
 * Fetch a document's raw bytes (with Bearer auth) for client-side PDF rendering
 * + signed-PDF assembly. The download endpoint is Bearer-protected, so we can't
 * point pdf.js straight at the URL.
 */
export async function fetchDocumentBytes(id: string): Promise<ArrayBuffer> {
  const res = await fetch(documentDownloadUrl(id), {
    headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
  });
  if (!res.ok) throw new Error(`Failed to load document (${res.status})`);
  return res.arrayBuffer();
}
