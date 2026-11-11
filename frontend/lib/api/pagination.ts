// Mirrors be Paginated<T> / PaginationMetaDto (core/common/dto).

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type Paginated<T> = {
  items: T[];
  meta: PaginationMeta;
};

/**
 * Build a `?a=1&b=2` query string, skipping null/undefined/"" values.
 * Returns "" (no leading `?`) when nothing is set.
 */
export function toQuery(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}
