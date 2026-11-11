"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PaginationMeta } from "@/lib/api/pagination";
import { listRequests } from "../api/requests";
import {
  DUTY_SORT_FIELDS,
  REQUEST_STATUSES,
  type DutySortField,
  type DutyStatusFilter,
  type RequestScope,
  type RequestStatus,
  type RequestSummary,
  type SortDir,
} from "../types/request";

/** Selectable page sizes for the request lists. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 300;

const DEFAULT_SORT_BY: DutySortField = "dutyCreated";
const DEFAULT_SORT_DIR: SortDir = "desc";

const emptyMeta: PaginationMeta = {
  page: 1,
  limit: DEFAULT_LIMIT,
  total: 0,
  totalPages: 0,
};

export type DateRange = { from: string | null; to: string | null };

export type RequestListState = {
  items: RequestSummary[];
  meta: PaginationMeta;
  loading: boolean;
  error: Error | null;
  // current filters
  page: number;
  limit: number;
  formId: string | null;
  status: RequestStatus | null;
  search: string;
  dateRange: DateRange;
  // duty-scope only
  dutyStatus: DutyStatusFilter | null;
  sortBy: DutySortField;
  sortDir: SortDir;
  // setters (filter changes reset to page 1)
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setFormId: (formId: string | null) => void;
  setStatus: (status: RequestStatus | null) => void;
  setSearch: (search: string) => void;
  setDateRange: (range: DateRange) => void;
  setDutyStatus: (status: DutyStatusFilter | null) => void;
  setSort: (sortBy: DutySortField, sortDir: SortDir) => void;
  reload: () => void;
};

// ── URL param parsing helpers ──────────────────────────────────────────────

function parsePage(v: string | null): number {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
function parseLimit(v: string | null): number {
  const n = Number(v);
  return PAGE_SIZE_OPTIONS.includes(n) ? n : DEFAULT_LIMIT;
}
function parseStatus(v: string | null): RequestStatus | null {
  return v && (REQUEST_STATUSES as string[]).includes(v)
    ? (v as RequestStatus)
    : null;
}
function parseDutyStatus(v: string | null): DutyStatusFilter | null {
  return v === "PENDING" || v === "DONE" ? v : null;
}
function parseSortBy(v: string | null): DutySortField {
  return v && (DUTY_SORT_FIELDS as string[]).includes(v)
    ? (v as DutySortField)
    : DEFAULT_SORT_BY;
}
function parseSortDir(v: string | null): SortDir {
  return v === "asc" ? "asc" : DEFAULT_SORT_DIR;
}

/**
 * Fetches a request list for `scope` with server-side filters (formId, status,
 * free-text search, createdAt range), page size, and pagination. State is
 * initialized from — and mirrored back to — the URL query string so filtered
 * views are shareable and survive refresh. Filter changes reset to page 1; the
 * search term is debounced.
 */
export function useRequestList(scope: RequestScope): RequestListState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<RequestSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize each filter from the URL (read once).
  const [page, setPageState] = useState(() => parsePage(searchParams.get("page")));
  const [limit, setLimitState] = useState(() =>
    parseLimit(searchParams.get("limit")),
  );
  const [formId, setFormIdState] = useState<string | null>(
    () => searchParams.get("formId") || null,
  );
  const [status, setStatusState] = useState<RequestStatus | null>(() =>
    parseStatus(searchParams.get("status")),
  );
  const [search, setSearchInput] = useState(() => searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(
    () => searchParams.get("q") ?? "",
  );
  const [dateRange, setDateRangeState] = useState<DateRange>(() => ({
    from: searchParams.get("from") || null,
    to: searchParams.get("to") || null,
  }));
  const [dutyStatus, setDutyStatusState] = useState<DutyStatusFilter | null>(
    () => parseDutyStatus(searchParams.get("dutyStatus")),
  );
  const [sortBy, setSortByState] = useState<DutySortField>(() =>
    parseSortBy(searchParams.get("sortBy")),
  );
  const [sortDir, setSortDirState] = useState<SortDir>(() =>
    parseSortDir(searchParams.get("sortDir")),
  );
  const [nonce, setNonce] = useState(0);

  const isDuty = scope === "duty";

  // Debounce the free-text search → resets to page 1.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search);
      setPageState(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  // Mirror the active filters back to the URL (shareable / refresh-safe).
  const firstSync = useRef(true);
  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (limit !== DEFAULT_LIMIT) params.set("limit", String(limit));
    if (formId) params.set("formId", formId);
    if (status) params.set("status", status);
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    if (isDuty) {
      if (dutyStatus) params.set("dutyStatus", dutyStatus);
      if (sortBy !== DEFAULT_SORT_BY) params.set("sortBy", sortBy);
      if (sortDir !== DEFAULT_SORT_DIR) params.set("sortDir", sortDir);
    }
    const qs = params.toString();
    const current = searchParams.toString();
    // Skip the write if nothing changed (avoids redundant history churn).
    if (qs === current && !firstSync.current) return;
    firstSync.current = false;
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    limit,
    formId,
    status,
    debouncedSearch,
    dateRange.from,
    dateRange.to,
    isDuty,
    dutyStatus,
    sortBy,
    sortDir,
    pathname,
  ]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listRequests(scope, {
      page,
      limit,
      formId: formId ?? undefined,
      status: status ?? undefined,
      search: debouncedSearch.trim() || undefined,
      createdFrom: dateRange.from ?? undefined,
      createdTo: dateRange.to ?? undefined,
      // duty-only knobs — ignored by the server on other scopes
      dutyStatus: isDuty ? (dutyStatus ?? undefined) : undefined,
      sortBy: isDuty ? sortBy : undefined,
      sortDir: isDuty ? sortDir : undefined,
    })
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setMeta(res.meta);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err);
        setItems([]);
        setMeta(emptyMeta);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [
    scope,
    page,
    limit,
    formId,
    status,
    debouncedSearch,
    dateRange,
    isDuty,
    dutyStatus,
    sortBy,
    sortDir,
    nonce,
  ]);

  const setPage = useCallback((p: number) => setPageState(p), []);
  const setLimit = useCallback((l: number) => {
    setLimitState(l);
    setPageState(1);
  }, []);
  const setFormId = useCallback((id: string | null) => {
    setFormIdState(id);
    setPageState(1);
  }, []);
  const setStatus = useCallback((s: RequestStatus | null) => {
    setStatusState(s);
    setPageState(1);
  }, []);
  const setSearch = useCallback((s: string) => setSearchInput(s), []);
  const setDateRange = useCallback((range: DateRange) => {
    setDateRangeState(range);
    setPageState(1);
  }, []);
  const setDutyStatus = useCallback((s: DutyStatusFilter | null) => {
    setDutyStatusState(s);
    setPageState(1);
  }, []);
  const setSort = useCallback((by: DutySortField, dir: SortDir) => {
    setSortByState(by);
    setSortDirState(dir);
    setPageState(1);
  }, []);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    items,
    meta,
    loading,
    error,
    page,
    limit,
    formId,
    status,
    search,
    dateRange,
    dutyStatus,
    sortBy,
    sortDir,
    setPage,
    setLimit,
    setFormId,
    setStatus,
    setSearch,
    setDateRange,
    setDutyStatus,
    setSort,
    reload,
  };
}
