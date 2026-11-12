"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { useLocale, useT } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingState } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TableCellStack,
} from "@/components/ui/Table";
import { listRequests } from "@/features/requests/api/requests";
import { DutyStatusCell } from "@/features/requests/components/DutyStatusCell";
import type { RequestSummary } from "@/features/requests/types/request";
import { useUserDirectory } from "@/features/users/hooks/useUserDirectory";
import { formatDateTime, shortId } from "@/lib/utils/format";

type DashboardData = {
  pendingItems: RequestSummary[];
  pendingTotal: number;
  mineItems: RequestSummary[];
  mineTotal: number;
};

export default function HomePage() {
  const t = useT();
  const [locale] = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const { resolveName } = useUserDirectory();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      listRequests("duty", { dutyStatus: "PENDING", limit: 5 }),
      listRequests("mine", { limit: 5 }),
    ])
      .then(([dutyRes, mineRes]) => {
        if (!active) return;
        setData({
          pendingItems: dutyRes.items,
          pendingTotal: dutyRes.meta.total,
          mineItems: mineRes.items,
          mineTotal: mineRes.meta.total,
        });
      })
      .catch(() => {
        if (!active) return;
        setData({
          pendingItems: [],
          pendingTotal: 0,
          mineItems: [],
          mineTotal: 0,
        });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.dashboard")}
        description={user?.displayName ?? user?.email}
        actions={
          <Link href="/requests/new">
            <Button variant="accent">
              <Plus size={16} />
              {t("header.createRequest")}
            </Button>
          </Link>
        }
      />

      {!data ? (
        <LoadingState />
      ) : (
        <>
          {/* Compact summary counters */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/requests/duty?dutyStatus=PENDING"
              className="group flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3.5 transition-colors hover:border-primary/30 hover:bg-surface-secondary/60"
            >
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("dashboard.pendingCount")}
                </p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {data.pendingTotal}
                </p>
              </div>
              <ArrowRight
                size={16}
                className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
              />
            </Link>

            <Link
              href="/requests/mine"
              className="group flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3.5 transition-colors hover:border-primary/30 hover:bg-surface-secondary/60"
            >
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("dashboard.createdCount")}
                </p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {data.mineTotal}
                </p>
              </div>
              <ArrowRight
                size={16}
                className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
              />
            </Link>
          </div>

          {/* Pending my action */}
          <section className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                {t("dashboard.pendingDuty")}
              </h2>
              <Link
                href="/requests/duty"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {t("dashboard.viewAll")}
                <ArrowRight size={13} />
              </Link>
            </div>
            {data.pendingItems.length === 0 ? (
              <EmptyState compact title={t("dashboard.emptyPending")} />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>{t("requests.columns.form")}</TH>
                    <TH>{t("requests.columns.requestedBy")}</TH>
                    <TH>{t("requests.columns.status")}</TH>
                    <TH>{t("requests.duty.column")}</TH>
                    <TH>{t("requests.columns.submittedAt")}</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.pendingItems.map((r) => (
                    <TR
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/requests/${r.id}`)}
                    >
                      <TD>
                        <TableCellStack
                          primary={r.formName}
                          secondary={
                            <span className="font-mono">
                              #{shortId(r.id)} · v{r.version}
                            </span>
                          }
                        />
                      </TD>
                      <TD>{resolveName(r.createdById)}</TD>
                      <TD>
                        <StatusBadge status={r.status} />
                      </TD>
                      <TD>
                        <DutyStatusCell
                          status={r.dutyStatus}
                          action={r.dutyAction}
                          type={r.dutyType}
                        />
                      </TD>
                      <TD className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(r.createdAt, locale)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </section>

          {/* My recent requests */}
          <section className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                {t("dashboard.myRecent")}
              </h2>
              <Link
                href="/requests/mine"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {t("dashboard.viewAll")}
                <ArrowRight size={13} />
              </Link>
            </div>
            {data.mineItems.length === 0 ? (
              <EmptyState compact title={t("dashboard.emptyMine")} />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>{t("requests.columns.form")}</TH>
                    <TH>{t("requests.columns.status")}</TH>
                    <TH>{t("requests.columns.submittedAt")}</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.mineItems.map((r) => (
                    <TR
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/requests/${r.id}`)}
                    >
                      <TD>
                        <TableCellStack
                          primary={r.formName}
                          secondary={
                            <span className="font-mono">
                              #{shortId(r.id)} · v{r.version}
                            </span>
                          }
                        />
                      </TD>
                      <TD>
                        <StatusBadge status={r.status} />
                      </TD>
                      <TD className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                        {formatDateTime(r.createdAt, locale)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
