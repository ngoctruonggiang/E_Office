"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus } from "lucide-react";
import { useT, useLocale } from "@/components/providers/I18nProvider";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
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
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    listForms({ page, limit: LIMIT, name: debounced.trim() || undefined })
      .then((res) => {
        if (!active) return;
        setItems(res.items);
        setMeta(res.meta);
      })
      .catch(() => active && setItems([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [page, debounced]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">
          {t("forms.title")}
        </h1>
        <Link href="/forms/new">
          <Button>
            <Plus size={16} />
            {t("forms.createForm")}
          </Button>
        </Link>
      </div>

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

      <Card className="overflow-hidden">
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
                  <TH className="text-center">{t("forms.columns.version")}</TH>
                  <TH className="text-center">
                    {t("forms.columns.requestCount")}
                  </TH>
                  <TH>{t("requests.createdAt")}</TH>
                </tr>
              </THead>
              <TBody>
                {items.map((form) => (
                  <TR
                    key={form.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/forms/${form.id}/edit`)}
                  >
                    <TD className="font-medium text-foreground">{form.name}</TD>
                    <TD className="text-center text-muted-foreground">
                      v{form.latestVersion}
                    </TD>
                    <TD className="text-center">
                      <Badge tone={form.requestCount > 0 ? "info" : "neutral"}>
                        {form.requestCount}
                      </Badge>
                    </TD>
                    <TD className="whitespace-nowrap text-muted-foreground">
                      {formatDate(form.createdAt, locale)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {meta && (
              <div className="border-t border-border">
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
      </Card>
    </div>
  );
}
