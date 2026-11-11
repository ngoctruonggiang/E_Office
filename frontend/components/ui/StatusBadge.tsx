"use client";

import { useT } from "@/components/providers/I18nProvider";
import { Badge } from "./Badge";

/** Mirrors be RequestStatus enum (form_response.prisma). */
export type RequestStatus =
  | "DRAFT"
  | "PENDING"
  | "REQUEST_CHANGES"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

const tone: Record<
  RequestStatus,
  "neutral" | "info" | "success" | "warning" | "danger"
> = {
  DRAFT: "neutral",
  PENDING: "warning",
  REQUEST_CHANGES: "info",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

/** Status pill with the localized status label (vi/en). */
export function StatusBadge({ status }: { status: RequestStatus }) {
  const t = useT();
  return <Badge tone={tone[status]}>{t(`status.${status}`)}</Badge>;
}
