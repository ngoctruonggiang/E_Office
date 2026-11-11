import { apiFetch } from "@/lib/api/client";
import type { FlowStatus } from "@/features/requests/types/detail";
import type { SignatureFieldInput, SignatureState } from "../types/signature";

/** GET /requests/:id/signature — the signing document + boxes for a request. */
export function getSignature(requestId: string): Promise<SignatureState> {
  return apiFetch<SignatureState>(`/requests/${requestId}/signature`);
}

/**
 * PUT /requests/:id/signature — replace the signing document + ALL boxes
 * ("from scratch"). Pass documentId=null with an empty array to clear signing.
 */
export function setSignature(
  requestId: string,
  body: { documentId: string | null; fields: SignatureFieldInput[] },
): Promise<SignatureState> {
  return apiFetch<SignatureState>(`/requests/${requestId}/signature`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/**
 * POST /requests/:id/signature/sign — stamp the caller's boxes with their
 * profile signature and approve, advancing the flow.
 */
export function signDocument(requestId: string): Promise<FlowStatus> {
  return apiFetch<FlowStatus>(`/requests/${requestId}/signature/sign`, {
    method: "POST",
  });
}

/**
 * POST /requests/:id/signature/reject — reject through the document (approver
 * "cancel"): rejects the caller's boxes and the request.
 */
export function rejectDocument(requestId: string): Promise<FlowStatus> {
  return apiFetch<FlowStatus>(`/requests/${requestId}/signature/reject`, {
    method: "POST",
  });
}
