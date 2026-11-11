"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { Button } from "./Button";

export type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
};

/** Compact prev/next pager with a "Page X of Y" label and total count. */
export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: PaginationProps) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground">
      <span>
        {total} {t("common.results")}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={t("common.previous")}
        >
          <ChevronLeft size={16} />
        </Button>
        <span className="min-w-24 text-center">
          {t("common.page")} {page} {t("common.of")} {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="outline"
          size="icon"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={t("common.next")}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
