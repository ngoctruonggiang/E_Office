"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Plus, Search, ShieldCheck } from "lucide-react";
import { useT, useLocale } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { formatDate } from "@/lib/utils/format";
import { ApiError } from "@/lib/api/client";
import { useAccountList } from "../hooks/useAccountList";
import { adminUpdateUser } from "../api/accounts";
import { AccountFormModal } from "./AccountFormModal";
import { PasswordResetModal } from "./PasswordResetModal";
import type { UserLite } from "@/features/users/types/user";

/** Admin account management: create, edit, enable/disable, reset password. */
export function AccountManagementScreen() {
  const t = useT();
  const [locale] = useLocale();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { open } = useModal();
  const { notify } = useNotifications();
  const { accounts, search, setSearch, loading, reload } = useAccountList();

  // Account management is admin-only; bounce others to organizations.
  const isAdmin = user?.role === "admin";
  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace("/staff/organizations");
  }, [authLoading, isAdmin, router]);

  if (authLoading || !isAdmin) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const toggleActive = async (account: UserLite) => {
    try {
      await adminUpdateUser(account.id, { isActive: !account.isActive });
      notify({ title: t("staff.accountUpdated"), kind: "success" });
      reload();
    } catch (err) {
      notify({
        title: t("staff.saveFailed"),
        message: err instanceof ApiError ? err.message : undefined,
        kind: "error",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">
          {t("staff.accountsTitle")}
        </h1>
        <Button
          onClick={() =>
            open(<AccountFormModal onSaved={reload} />, { size: "md" })
          }
        >
          <Plus size={16} />
          {t("staff.newAccount")}
        </Button>
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

      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState title={t("staff.noAccounts")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("staff.displayName")}</TH>
                <TH>{t("staff.email")}</TH>
                <TH>{t("staff.systemRole")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("staff.createdAt")}</TH>
                <TH className="text-right">{t("common.actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {accounts.map((account) => (
                <TR key={account.id}>
                  <TD className="font-medium text-foreground">
                    {account.displayName ?? "—"}
                  </TD>
                  <TD className="text-muted-foreground">{account.email}</TD>
                  <TD>
                    <Badge tone={account.role === "admin" ? "info" : "neutral"}>
                      {account.role === "admin" ? (
                        <span className="inline-flex items-center gap-1">
                          <ShieldCheck size={12} />
                          {t("staff.roleAdmin")}
                        </span>
                      ) : (
                        t("staff.roleUser")
                      )}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge tone={account.isActive ? "success" : "neutral"}>
                      {account.isActive
                        ? t("staff.statusActive")
                        : t("staff.statusInactive")}
                    </Badge>
                  </TD>
                  <TD className="text-muted-foreground">
                    {formatDate(account.createdAt, locale)}
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          open(
                            <AccountFormModal
                              account={account}
                              onSaved={reload}
                            />,
                            { size: "md" },
                          )
                        }
                      >
                        <Pencil size={14} />
                        {t("common.edit")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          open(<PasswordResetModal account={account} />, {
                            size: "md",
                          })
                        }
                      >
                        <KeyRound size={14} />
                        {t("staff.resetPassword")}
                      </Button>
                      <Button
                        variant={account.isActive ? "ghost" : "outline"}
                        size="sm"
                        onClick={() => toggleActive(account)}
                      >
                        {account.isActive
                          ? t("staff.deactivate")
                          : t("staff.activate")}
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}
