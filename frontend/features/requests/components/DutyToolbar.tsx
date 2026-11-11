"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
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
 * Duty-scope controls: a segmented Done / Pending / All filter and a sort
 * selector (default: by when the action was created). Both drive the
 * server-side query in useRequestList.
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
      <div className="inline-flex rounded-md border border-border p-0.5">
        {DUTY_FILTERS.map(({ value, key }) => (
          <button
            key={value}
            type="button"
            onClick={() =>
              onDutyStatusChange(value === "ALL" ? null : value)
            }
            className={
              "rounded px-3 py-1 text-sm font-medium transition-colors " +
              (active === value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {t(`requests.duty.${key}`)}
          </button>
        ))}
      </div>

      {/* Sort field + direction */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {t("requests.duty.sort")}
        </span>
        <Select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as DutySortField, sortDir)}
          className="w-44"
        >
          {DUTY_SORT_FIELDS.map((f) => (
            <option key={f} value={f}>
              {t(`requests.duty.sortBy.${f}`)}
            </option>
          ))}
        </Select>
        <Button
          variant="outline"
          size="md"
          aria-label={t(`requests.duty.${sortDir === "asc" ? "asc" : "desc"}`)}
          title={t(`requests.duty.${sortDir === "asc" ? "asc" : "desc"}`)}
          onClick={() =>
            onSortChange(sortBy, sortDir === "asc" ? "desc" : "asc")
          }
        >
          {sortDir === "asc" ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
        </Button>
      </div>
    </div>
  );
}
