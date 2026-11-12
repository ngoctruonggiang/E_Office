"use client";

import { BarChart2 } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ReportsPage() {
  const t = useT();
  return (
    <div className="space-y-4">
      <PageHeader title={t("reports.title")} />
      <div className="rounded-lg border border-border bg-surface">
        <EmptyState
          title={t("common.noData")}
          icon={<BarChart2 size={20} strokeWidth={1.6} />}
        />
      </div>
    </div>
  );
}
