"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Search } from "lucide-react";
import { useT, useLocale } from "@/components/providers/I18nProvider";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  TableCellStack,
} from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import type { PaginationMeta } from "@/lib/api/pagination";
import { formatDate } from "@/lib/utils/format";
import { listForms } from "../api/forms";
import type { FormSummary } from "../types/form";

const LIMIT = 10;

export function FormListScreen() {
  const t = useT();
  const [locale] = useLocale();
  const router = useRouter();

  const [items, setItems] = useState<FormSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const queryKey = `${page}|${debounced.trim()}`;

  useEffect(() => {
    let active = true;
    listForms({ page, limit: LIMIT, name: debounced.trim() || undefined })
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setMeta(res.meta);
      })
      .catch(() => active && setItems([]))
      .finally(() => active && setLoadedKey(queryKey));
    return () => {
      active = false;
    };
  }, [page, debounced, queryKey]);

  const loading = loadedKey !== queryKey;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("forms.title")}
        actions={
          <Link href="/forms/new">
            <Button variant="accent">
              <Plus size={16} />
              {t("forms.createForm")}
            </Button>
          </Link>
        }
      />

      <div className="relative max-w-sm">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("forms.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {loading ? (
          <LoadingState />
        ) : items.length === 0 ? (
          <EmptyState title={t("forms.empty")} />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>{t("forms.columns.name")}</TH>
                  <TH className="text-center">{t("forms.columns.requestCount")}</TH>
                  <TH>{t("requests.createdAt")}</TH>
                  <TH className="w-8" />
                </tr>
              </THead>
              <TBody>
                {items.map((form) => (
                  <TR
                    key={form.id}
                    className="group cursor-pointer"
                    onClick={() => router.push(`/forms/${form.id}/edit`)}
                  >
                    <TD>
                      <TableCellStack
                        primary={form.name}
                        secondary={`v${form.latestVersion}`}
                      />
                    </TD>
                    <TD className="text-center">
                      <Badge tone={form.requestCount > 0 ? "info" : "neutral"}>
                        {form.requestCount}
                      </Badge>
                    </TD>
                    <TD className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                      {formatDate(form.createdAt, locale)}
                    </TD>
                    <TD className="text-right">
                      <ChevronRight
                        size={15}
                        className="inline-block text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {meta && (
              <div className="border-t border-border-subtle">
                <Pagination
                  page={meta.page}
                  totalPages={meta.totalPages}
                  total={meta.total}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
