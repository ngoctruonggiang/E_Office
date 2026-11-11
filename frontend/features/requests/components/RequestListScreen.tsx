"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useT, useLocale } from "@/components/providers/I18nProvider";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/Spinner";
import { useFormCategories } from "@/features/forms/hooks/useFormCategories";
import { useUserDirectory } from "@/features/users/hooks/useUserDirectory";
import { formatDateTime, shortId } from "@/lib/utils/format";
import { PAGE_SIZE_OPTIONS, useRequestList } from "../hooks/useRequestList";
import {
  REQUEST_STATUSES,
  type RequestScope,
  type RequestStatus,
} from "../types/request";
import { FormTypePanel } from "./FormTypePanel";
import { RequestFilterButton } from "./RequestFilterButton";
import { DutyToolbar } from "./DutyToolbar";
import { DutyStatusCell } from "./DutyStatusCell";

const SCOPES: RequestScope[] = ["duty", "mine", "viewable"];

export function RequestListScreen({ scope }: { scope: RequestScope }) {
  const t = useT();
  const [locale] = useLocale();
  const router = useRouter();
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  const list = useRequestList(scope);
  const { forms, loading: formsLoading } = useFormCategories();
  const { resolveName } = useUserDirectory();

  const isDuty = scope === "duty";

  const tabs: TabItem[] = SCOPES.map((s) => ({
    value: s,
    label: t(`requests.tabs.${s}`)
  }));

  const rows = list.items;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {t("requests.title")}
        </h1>
      </div>

      <Tabs
        items={tabs}
        value={scope}
        onValueChange={(v) => router.push(`/requests/${v}`)}
      />

      <div className="flex gap-6">
        <FormTypePanel
          forms={forms}
          loading={formsLoading}
          selected={list.formId}
          onSelect={list.setFormId}
          collapsed={panelCollapsed}
          onToggleCollapse={() => setPanelCollapsed((v) => !v)}
        />

        <div className="min-w-0 flex-1 space-y-3">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-48 flex-1">
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
              showFormSelector={list.formId === null}
              onApply={({ formId, dateRange }) => {
                list.setFormId(formId);
                list.setDateRange(dateRange);
              }}
            />
          </div>

          {/* Duty-only: done/pending/all filter + sort */}
          {isDuty && (
            // {true && (
            <DutyToolbar
              dutyStatus={list.dutyStatus}
              sortBy={list.sortBy}
              sortDir={list.sortDir}
              onDutyStatusChange={list.setDutyStatus}
              onSortChange={list.setSort}
            />
          )}

          {/* Table */}
          <Card className="overflow-hidden">
            {list.loading ? (
              <LoadingState />
            ) : list.error ? (
              <EmptyState
                title={t("common.error")}
                description={list.error.message}
              />
            ) : rows.length === 0 ? (
              <EmptyState title={t("requests.empty")} />
            ) : (
              <>
                <Table>
                  <THead>
                    <tr>
                      <TH>{t("requests.columns.id")}</TH>
                      <TH>{t("requests.columns.form")}</TH>
                      <TH>{t("requests.columns.requestedBy")}</TH>
                      <TH>{t("requests.columns.status")}</TH>
                      {isDuty && <TH>{t("requests.duty.column")}</TH>}
                      <TH className="text-center">
                        {t("requests.columns.version")}
                      </TH>
                      <TH>{t("requests.columns.submittedAt")}</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {rows.map((r) => (
                      <TR
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/requests/${r.id}`)}
                      >
                        <TD className="font-mono text-xs text-muted-foreground">
                          {shortId(r.id)}
                        </TD>
                        <TD className="font-medium text-foreground">
                          {r.formName}
                        </TD>
                        <TD>{resolveName(r.createdById)}</TD>
                        <TD>
                          <StatusBadge status={r.status} />
                        </TD>
                        {isDuty && (
                          <TD>
                            <DutyStatusCell
                              status={r.dutyStatus}
                              action={r.dutyAction}
                              type={r.dutyType}
                            />
                          </TD>
                        )}
                        <TD className="text-center text-muted-foreground">
                          v{r.version}
                        </TD>
                        <TD className="whitespace-nowrap text-muted-foreground">
                          {formatDateTime(r.createdAt, locale)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border">
                  <label className="flex items-center gap-2 px-4 text-sm text-muted-foreground">
                    {t("common.rowsPerPage")}
                    <Select
                      value={String(list.limit)}
                      onChange={(e) => list.setLimit(Number(e.target.value))}
                      className="w-20"
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
          </Card>
        </div>
      </div>
    </div>
  );
}
