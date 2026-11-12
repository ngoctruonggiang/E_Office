"use client";

import Link from "next/link";
import { Building2, ChevronRight, Plus, Search } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LoadingState } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { useOrgRoots } from "../hooks/useOrgRoots";
import { OrgNodeFormModal } from "./OrgNodeFormModal";

/** Lists the root companies in scope. Click one to open its HR screen. */
export function OrganizationsListScreen() {
  const t = useT();
  const { user } = useAuth();
  const { open } = useModal();
  const { roots, search, setSearch, loading, reload } = useOrgRoots();
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-4">
      <PageHeader
        title={isAdmin ? t("staff.organizationsTitle") : t("staff.myCompanies")}
        actions={
          isAdmin ? (
            <Button
              variant="accent"
              onClick={() =>
                open(
                  <OrgNodeFormModal mode={{ kind: "createRoot" }} onSaved={reload} />,
                  { size: "md" },
                )
              }
            >
              <Plus size={16} />
              {t("staff.newCompany")}
            </Button>
          ) : undefined
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
          placeholder={t("common.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      {loading ? (
        <LoadingState />
      ) : roots.length === 0 ? (
        <EmptyState
          title={t("staff.noCompanies")}
          icon={<Building2 size={20} strokeWidth={1.6} />}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roots.map((root) => (
            <Link
              key={root.id}
              href={`/staff/organizations/${root.id}`}
              className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary/30 hover:bg-surface-secondary/70"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-secondary text-primary">
                <Building2 size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {root.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {root.memberCount ?? 0} {t("staff.members")}
                </span>
              </span>
              <ChevronRight
                size={16}
                className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
