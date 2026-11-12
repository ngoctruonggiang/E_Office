"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { navItems, type NavItem } from "@/config/navigation";
import { useT } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLayout } from "@/components/providers/LayoutProvider";
import { cn } from "@/lib/utils/cn";

export function Sidebar() {
  const pathname = usePathname();
  const t = useT();
  const { user } = useAuth();
  const { sidebarCollapsed, toggleSidebarCollapse } = useLayout();
  const role = user?.role;

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
      <span
        className={cn(
          "shrink-0 transition-colors",
          active
            ? "text-primary"
            : "text-muted-foreground group-hover:text-foreground",
        )}
      >
        {item.icon}
      </span>
      {!sidebarCollapsed && (
        <span className="flex-1 truncate text-left">{t(item.labelKey)}</span>
      )}
      {!sidebarCollapsed && item.badge && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-secondary px-1.5 text-[10px] font-medium text-foreground">
          {item.badge}
        </span>
      )}
    </>
  );

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-150",
        sidebarCollapsed ? "w-16" : "w-58",
      )}
    >
      {/* Brand header */}
      <div
        className={cn(
          "flex h-13 shrink-0 items-center border-b border-sidebar-border",
          sidebarCollapsed ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5"
          title={t("common.appName")}
        >
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            g
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-highlight ring-2 ring-sidebar"
            />
          </span>
          {!sidebarCollapsed && (
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="truncate text-base font-semibold tracking-tight text-foreground">
                {t("common.appName")}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                E-Office
              </span>
            </span>
          )}
        </Link>

        {!sidebarCollapsed && (
          <button
            type="button"
            onClick={toggleSidebarCollapse}
            title={t("header.toggleSidebar")}
            aria-label={t("header.toggleSidebar")}
            className="hidden h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground md:inline-flex"
          >
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
        {sections.map((group) => (
          <div key={group.sectionKey} className="space-y-1">
            {!sidebarCollapsed && (
              <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
                {t(group.sectionKey)}
              </p>
            )}

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
                      "group flex w-full items-center rounded-md text-sm transition-colors",
                      sidebarCollapsed
                        ? "h-9 justify-center px-0"
                        : "gap-2.5 px-2.5 py-1.5",
                      active
                        ? "border border-border-subtle bg-surface font-medium text-foreground shadow-[0_1px_2px_rgba(20,28,23,0.04)]"
                        : "border border-transparent text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                    )}
                  >
                    {renderItemContent(item, active)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Expand trigger when collapsed */}
      {sidebarCollapsed && (
        <div className="border-t border-sidebar-border p-2.5">
          <button
            type="button"
            onClick={toggleSidebarCollapse}
            title={t("header.toggleSidebar")}
            aria-label={t("header.toggleSidebar")}
            className="flex h-8 w-full cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <PanelLeftOpen size={15} />
          </button>
        </div>
      )}
    </aside>
  );
}
