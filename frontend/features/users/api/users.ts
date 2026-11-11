import { apiFetch } from "@/lib/api/client";
import { toQuery, type Paginated } from "@/lib/api/pagination";
import type { UserLite } from "../types/user";

/** List users (GET /users), paginated and optionally filtered. */
export function listUsers(
  params: {
    id?: string;
    displayName?: string;
    email?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<Paginated<UserLite>> {
  return apiFetch<Paginated<UserLite>>(`/users${toQuery(params)}`);
}
