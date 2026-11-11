"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, NavItem } from "@/config/navigation";
import { useT } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { cn } from "@/lib/utils/cn";

export function Sidebar() {
  const pathname = usePathname();
  const t = useT();
  const { user } = useAuth();
  const role = user?.role;

  // Drop role-gated items the current user can't see, then any section left
  // empty as a result.
  const sections = navItems
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || (role !== undefined && item.roles.includes(role)),
      ),
    }))
    .filter((group) => group.items.length > 0);

  const renderItemContent = (item: NavItem, active: boolean) => (
    <>
      <span className={active ? "text-primary" : ""}>{item.icon}</span>
      <span className="flex-1 text-left">{t(item.labelKey)}</span>
      {item.badge && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
          {item.badge}
        </span>
      )}
    </>
  );

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-6 text-lg font-bold tracking-tight">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
          g
        </span>
        {t("common.appName")}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-6 overflow-y-auto p-4">
        {sections.map((group) => (
          <div key={group.sectionKey} className="space-y-1">
            <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {t(group.sectionKey)}
            </p>

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    title={t(item.labelKey)}
                    className={cn(
                      "group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-all",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                    )}
                    {renderItemContent(item, active)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
