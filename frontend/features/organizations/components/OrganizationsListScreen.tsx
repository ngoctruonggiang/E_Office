"use client";

import Link from "next/link";
import { Building2, ChevronRight, Plus, Search } from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">
          {isAdmin ? t("staff.organizationsTitle") : t("staff.myCompanies")}
        </h1>
        {isAdmin && (
          <Button
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
        )}
      </div>

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
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : roots.length === 0 ? (
        <EmptyState title={t("staff.noCompanies")} icon={<Building2 size={28} strokeWidth={1.5} />} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roots.map((root) => (
            <Link
              key={root.id}
              href={`/staff/organizations/${root.id}`}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Building2 size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">
                  {root.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {root.memberCount ?? 0} {t("staff.members")}
                </span>
              </span>
              <ChevronRight
                size={18}
                className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
