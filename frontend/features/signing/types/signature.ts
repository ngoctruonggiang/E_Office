// Mirrors be SignatureField / SignatureStateDto (modules/signature/dto).

export type SignatureStatus = "PENDING" | "SIGNED" | "REJECTED";

export type SignatureField = {
  id: string;
  documentId: string;
  assigneeId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  status: SignatureStatus;
  signatureName: string | null;
  signatureImage: string | null;
  signedAt: string | null;
};

/** The full signing state for a request: the signing doc + its boxes. */
export type SignatureState = {
  documentId: string | null;
  fields: SignatureField[];
};

/** One signature box to place (geometry as % of page, top-left origin). */
export type SignatureFieldInput = {
  assigneeId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

// Local-only state for placing a signing document in the create/edit flow.
// The file is always a PDF (docx is converted on pick) so the client can later
// assemble a signed PDF from its bytes.
import type { OverlayField } from "../lib/pdf-canvas";

export type SigningDraft = {
  /** The PDF file to upload as the signing document, or null when none/unchanged. */
  file: File | null;
  /** Raw PDF bytes for preview/placement. */
  bytes: ArrayBuffer | null;
  /** Display label for the chosen document. */
  fileName: string | null;
  /** Placed signature boxes (assigneeId = approver userId). */
  fields: OverlayField[];
  /** Set when editing a draft that already has a stored signing doc. */
  existingDocumentId?: string | null;
};

export const emptySigningDraft: SigningDraft = {
  file: null,
  bytes: null,
  fileName: null,
  fields: [],
  existingDocumentId: null,
};
