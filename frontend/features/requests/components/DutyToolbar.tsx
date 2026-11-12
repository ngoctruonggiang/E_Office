"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils/cn";
import {
  DUTY_SORT_FIELDS,
  type DutySortField,
  type DutyStatusFilter,
  type SortDir,
} from "../types/request";

const DUTY_FILTERS: { value: DutyStatusFilter | "ALL"; key: string }[] = [
  { value: "ALL", key: "all" },
  { value: "PENDING", key: "pending" },
  { value: "DONE", key: "done" },
];

export type DutyToolbarProps = {
  dutyStatus: DutyStatusFilter | null;
  sortBy: DutySortField;
  sortDir: SortDir;
  onDutyStatusChange: (status: DutyStatusFilter | null) => void;
  onSortChange: (sortBy: DutySortField, sortDir: SortDir) => void;
};

/**
 * Duty-scope controls: restrained neutral segmented filter + sort selector.
 */
export function DutyToolbar({
  dutyStatus,
  sortBy,
  sortDir,
  onDutyStatusChange,
  onSortChange,
}: DutyToolbarProps) {
  const t = useT();
  const active = dutyStatus ?? "ALL";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Done / Pending / All segmented filter */}
      <div className="inline-flex rounded-md border border-border-subtle bg-surface-secondary p-0.5">
        {DUTY_FILTERS.map(({ value, key }) => {
          const selected = active === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() =>
                onDutyStatusChange(value === "ALL" ? null : value)
              }
              className={cn(
                "cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors",
                selected
                  ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(20,28,23,0.06)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`requests.duty.${key}`)}
            </button>
          );
        })}
      </div>

      {/* Sort field + direction */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {t("requests.duty.sort")}
        </span>
        <Select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as DutySortField, sortDir)}
          className="h-8 w-44 text-xs"
        >
          {DUTY_SORT_FIELDS.map((f) => (
            <option key={f} value={f}>
              {t(`requests.duty.sortBy.${f}`)}
            </option>
          ))}
        </Select>
        <Button
          variant="outline"
          size="icon"
          aria-label={t(`requests.duty.${sortDir === "asc" ? "asc" : "desc"}`)}
          title={t(`requests.duty.${sortDir === "asc" ? "asc" : "desc"}`)}
          onClick={() =>
            onSortChange(sortBy, sortDir === "asc" ? "desc" : "asc")
          }
        >
          {sortDir === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        </Button>
      </div>
    </div>
  );
}
