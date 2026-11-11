"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { useT } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";

/**
 * Route-based tab bar for the staff area. "Accounts" is admin-only; everyone
 * authenticated sees "Organizations" (their managed companies).
 */
export function StaffTabs() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const items: TabItem[] = [
    ...(user?.role === "admin"
      ? [{ value: "/staff/accounts", label: t("staff.tabAccounts") }]
      : []),
    { value: "/staff/organizations", label: t("staff.tabOrganizations") },
  ];

  // Match the tab whose route prefixes the current path (so detail pages keep
  // the Organizations tab active).
  const active =
    items.find((it) => pathname.startsWith(it.value))?.value ??
    items[0]?.value ??
    "";

  return (
    <Tabs items={items} value={active} onValueChange={(v) => router.push(v)} />
  );
}
