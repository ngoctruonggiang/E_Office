import { apiFetch } from "@/lib/api/client";
import { toQuery, type Paginated } from "@/lib/api/pagination";
import type {
  FormDetail,
  FormInput,
  FormSummary,
  RequestValue,
} from "../types/form";

/** Create a form template (POST /forms). */
export function createForm(input: FormInput): Promise<FormDetail> {
  return apiFetch<FormDetail>(`/forms`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Update a form (PATCH /forms/:id) — may create a new version (see backend). */
export function updateForm(id: string, input: FormInput): Promise<FormDetail> {
  return apiFetch<FormDetail>(`/forms/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Fetch the assembled latest version of a form (GET /forms/:id). */
export function getForm(id: string): Promise<FormDetail> {
  return apiFetch<FormDetail>(`/forms/${id}`);
}

/** Fetch a pinned FormVersion by its versionId (GET /forms/versions/:versionId). */
export function getFormVersion(versionId: string): Promise<FormDetail> {
  return apiFetch<FormDetail>(`/forms/versions/${versionId}`);
}

/** List form categories (GET /forms) — used by the form-type filter panel. */
export function listForms(
  params: { name?: string; page?: number; limit?: number } = {},
): Promise<Paginated<FormSummary>> {
  return apiFetch<Paginated<FormSummary>>(`/forms${toQuery(params)}`);
}

export type SubmitRequestInput = {
  formId: string;
  values: RequestValue[];
  /** false → keep as DRAFT; true/omitted → start the approval flow. */
  submit?: boolean;
  viewerIds?: string[];
};

/** Create a request (a filled-in form) — POST /requests. */
export function submitRequest(input: SubmitRequestInput): Promise<unknown> {
  return apiFetch(`/requests`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
