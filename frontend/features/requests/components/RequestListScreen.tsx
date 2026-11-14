"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Pencil, Plus, Search, X } from "lucide-react";
import { useT, useLocale } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  TableCellStack,
} from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { InlineNotice } from "@/components/ui/InlineNotice";
import { useFormCategories } from "@/features/forms/hooks/useFormCategories";
import { useUserDirectory } from "@/features/users/hooks/useUserDirectory";
import { formatDateTime, shortId } from "@/lib/utils/format";
import { PAGE_SIZE_OPTIONS, useRequestList } from "../hooks/useRequestList";
import {
  REQUEST_STATUSES,
  type RequestScope,
  type RequestStatus,
} from "../types/request";
import { RequestFilterButton } from "./RequestFilterButton";
import { DutyToolbar } from "./DutyToolbar";
import { DutyStatusCell } from "./DutyStatusCell";

const SCOPES: RequestScope[] = ["duty", "mine", "viewable"];

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-secondary px-2 py-0.5 text-xs text-foreground">
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X size={12} />
      </button>
    </span>
  );
}

export function RequestListScreen({ scope }: { scope: RequestScope }) {
  const t = useT();
  const [locale] = useLocale();
  const router = useRouter();

  const list = useRequestList(scope);
  const { user } = useAuth();
  const { forms } = useFormCategories();
  const { resolveName } = useUserDirectory();

  const isDuty = scope === "duty";

  const tabs: TabItem[] = SCOPES.map((s) => ({
    value: s,
    label: t(`requests.tabs.${s}`),
  }));

  const selectedFormName = list.formId
    ? forms.find((f) => f.id === list.formId)?.name ?? list.formId
    : null;

  const hasFilters = Boolean(
    list.search.trim() ||
      list.formId ||
      list.status ||
      list.dateRange.from ||
      list.dateRange.to ||
      (isDuty && list.dutyStatus),
  );

  const clearAllFilters = () => {
    list.setSearch("");
    list.setFormId(null);
    list.setStatus(null);
    list.setDateRange({ from: null, to: null });
    if (isDuty) list.setDutyStatus(null);
  };

  const rows = list.items;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("requests.title")}
        actions={
          <Link href="/requests/new">
            <Button variant="accent">
              <Plus size={16} />
              {t("header.createRequest")}
            </Button>
          </Link>
        }
      >
        <Tabs
          items={tabs}
          value={scope}
          onValueChange={(v) => router.push(`/requests/${v}`)}
        />
      </PageHeader>

      {/* Toolbar: search + form-type dropdown + status + date-range popover */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-56 flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={list.search}
              onChange={(e) => list.setSearch(e.target.value)}
              placeholder={t("requests.searchPlaceholder")}
              className="pl-9"
            />
          </div>

          <Select
            aria-label={t("requests.formTypes")}
            value={list.formId ?? ""}
            onChange={(e) => list.setFormId(e.target.value || null)}
            className="w-48"
          >
            <option value="">{t("requests.allForms")}</option>
            {forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>

          <Select
            aria-label={t("requests.statusFilter")}
            value={list.status ?? ""}
            onChange={(e) =>
              list.setStatus((e.target.value || null) as RequestStatus | null)
            }
            className="w-44"
          >
            <option value="">{t("requests.allStatuses")}</option>
            {REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </Select>

          <RequestFilterButton
            formId={list.formId}
            dateRange={list.dateRange}
            forms={forms}
            onApply={({ dateRange }) => list.setDateRange(dateRange)}
          />
        </div>

        {/* Duty-only: done/pending/all segmented filter + sort */}
        {isDuty && (
          <DutyToolbar
            dutyStatus={list.dutyStatus}
            sortBy={list.sortBy}
            sortDir={list.sortDir}
            onDutyStatusChange={list.setDutyStatus}
            onSortChange={list.setSort}
          />
        )}

        {/* Active filter chips */}
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-1.5">
            {list.search.trim() && (
              <FilterChip
                label={`${t("common.search")}: "${list.search.trim()}"`}
                onRemove={() => list.setSearch("")}
              />
            )}
            {selectedFormName && (
              <FilterChip
                label={`${t("requests.formTypes")}: ${selectedFormName}`}
                onRemove={() => list.setFormId(null)}
              />
            )}
            {list.status && (
              <FilterChip
                label={`${t("requests.statusFilter")}: ${t(`status.${list.status}`)}`}
                onRemove={() => list.setStatus(null)}
              />
            )}
            {isDuty && list.dutyStatus && (
              <FilterChip
                label={`${t("requests.duty.filter")}: ${t(
                  `requests.duty.${list.dutyStatus.toLowerCase()}`,
                )}`}
                onRemove={() => list.setDutyStatus(null)}
              />
            )}
            {(list.dateRange.from || list.dateRange.to) && (
              <FilterChip
                label={`${t("requests.createdAt")}: ${list.dateRange.from ?? "…"} – ${list.dateRange.to ?? "…"}`}
                onRemove={() => list.setDateRange({ from: null, to: null })}
              />
            )}
            <button
              type="button"
              onClick={clearAllFilters}
              className="cursor-pointer px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("common.clear")}
            </button>
          </div>
        )}
      </div>

      {/* Full-width table */}
      {list.error ? (
        <InlineNotice
          kind="danger"
          title={t("common.error")}
          description={list.error.message}
          action={
            <Button variant="outline" size="xs" onClick={list.reload}>
              {t("common.retry")}
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {list.loading ? (
            <LoadingState />
          ) : rows.length === 0 ? (
            <EmptyState
              title={t("requests.empty")}
              action={
                hasFilters ? (
                  <Button variant="outline" size="sm" onClick={clearAllFilters}>
                    {t("common.clear")}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <Table>
                <THead>
                  <tr>
                    <TH>{t("requests.columns.form")}</TH>
                    <TH>{t("requests.columns.requestedBy")}</TH>
                    <TH>{t("requests.columns.status")}</TH>
                    {isDuty && <TH>{t("requests.duty.column")}</TH>}
                    <TH>{t("requests.columns.submittedAt")}</TH>
                    <TH className="w-8" />
                  </tr>
                </THead>
                <TBody>
                  {rows.map((r) => (
                    <TR
                      key={r.id}
                      className="group cursor-pointer"
                      onClick={() => router.push(`/requests/${r.id}`)}
                    >
                      <TD>
                        <TableCellStack
                          primary={r.procedure?.name || r.formName}
                          secondary={
                            <span className="font-mono">
                              #{shortId(r.id)} · {r.procedure ? (
                                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{r.procedure.code}</span>
                              ) : (
                                `v${r.version}`
                              )}
                            </span>
                          }
                        />
                      </TD>
                      <TD className="text-foreground">
                        {resolveName(r.createdById)}
                      </TD>
                      <TD>
                        <StatusBadge status={r.status} />
                      </TD>
                      {isDuty && (
                        <TD>
                          <DutyStatusCell
                            status={r.dutyStatus}
                            action={r.dutyAction}
                            type={r.dutyType}
                            taskName={(r as any).taskName}
                            requiresSignature={(r as any).requiresSignature}
                          />
                        </TD>
                      )}
                      <TD className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(r.createdAt, locale)}
                      </TD>
                      <TD className="text-right whitespace-nowrap">
                        {r.createdById === user?.id &&
                        (r.status === "REQUEST_CHANGES" || r.status === "DRAFT") ? (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/requests/${r.id}/edit`);
                            }}
                            className="h-7 text-xs border-primary/40 text-primary hover:bg-primary/5"
                          >
                            <Pencil size={11} className="mr-1" />
                            Sửa tiếp
                          </Button>
                        ) : (
                          <ChevronRight
                            size={15}
                            className="inline-block text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                          />
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle">
                <label className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
                  {t("common.rowsPerPage")}
                  <Select
                    value={String(list.limit)}
                    onChange={(e) => list.setLimit(Number(e.target.value))}
                    className="h-8 w-20 text-xs"
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                </label>
                <div className="flex-1">
                  <Pagination
                    page={list.meta.page}
                    totalPages={list.meta.totalPages}
                    total={list.meta.total}
                    onPageChange={list.setPage}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
