"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Plus, Power, Search, ShieldCheck } from "lucide-react";
import { useT, useLocale } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  TableCellStack,
} from "@/components/ui/Table";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionMenu } from "@/components/ui/ActionMenu";
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

  const isAdmin = user?.role === "admin";
  useEffect(() => {
    if (!authLoading && !isAdmin) router.replace("/staff/organizations");
  }, [authLoading, isAdmin, router]);

  if (authLoading || !isAdmin) {
    return <LoadingState />;
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
      <PageHeader
        title={t("staff.accountsTitle")}
        actions={
          <Button
            variant="accent"
            onClick={() =>
              open(<AccountFormModal onSaved={reload} />, { size: "md" })
            }
          >
            <Plus size={16} />
            {t("staff.newAccount")}
          </Button>
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

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {loading ? (
          <LoadingState />
        ) : accounts.length === 0 ? (
          <EmptyState title={t("staff.noAccounts")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("staff.displayName")}</TH>
                <TH>{t("staff.systemRole")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("staff.createdAt")}</TH>
                <TH className="w-12 text-right">{t("common.actions")}</TH>
              </TR>
            </THead>
            <TBody>
              {accounts.map((account) => (
                <TR key={account.id}>
                  <TD>
                    <TableCellStack
                      primary={account.displayName ?? account.email}
                      secondary={account.email}
                    />
                  </TD>
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
                    <Badge tone={account.isActive ? "success" : "neutral"} dot>
                      {account.isActive
                        ? t("staff.statusActive")
                        : t("staff.statusInactive")}
                    </Badge>
                  </TD>
                  <TD className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(account.createdAt, locale)}
                  </TD>
                  <TD className="text-right">
                    <ActionMenu
                      label={t("common.actions")}
                      items={[
                        {
                          id: "edit",
                          label: t("common.edit"),
                          icon: <Pencil size={14} />,
                          onSelect: () =>
                            open(
                              <AccountFormModal
                                account={account}
                                onSaved={reload}
                              />,
                              { size: "md" },
                            ),
                        },
                        {
                          id: "reset-pw",
                          label: t("staff.resetPassword"),
                          icon: <KeyRound size={14} />,
                          onSelect: () =>
                            open(<PasswordResetModal account={account} />, {
                              size: "md",
                            }),
                        },
                        {
                          id: "toggle-active",
                          label: account.isActive
                            ? t("staff.deactivate")
                            : t("staff.activate"),
                          icon: <Power size={14} />,
                          tone: account.isActive ? "danger" : "default",
                          dividerBefore: true,
                          onSelect: () => void toggleActive(account),
                        },
                      ]}
                    />
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
