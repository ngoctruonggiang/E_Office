"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  FilePlus2,
  LogOut,
  Menu,
  Plus,
  PlusCircle,
  Search,
  Settings,
} from "lucide-react";
import { navItems } from "@/config/navigation";
import { useT } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLayout } from "@/components/providers/LayoutProvider";
import { useNotifications } from "@/components/providers/NotificationProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { cn } from "@/lib/utils/cn";

/**
 * Lightweight top bar (RAMP Section 2.3): sidebar toggle + global search on
 * the left; quiet global utilities (quick-create, notifications, language,
 * user menu) on the right so it never competes with page headings.
 */
export function Header() {
  const t = useT();
  const { sidebarOpen, toggleSidebar, notificationsOpen, toggleNotifications } =
    useLayout();
  const { unreadCount } = useNotifications();

  return (
    <header className="flex h-13 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={t("header.toggleSidebar")}
          title={t("header.toggleSidebar")}
          className={cn(
            "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-secondary hover:text-foreground",
            sidebarOpen && "md:hidden",
          )}
        >
          <Menu size={17} />
        </button>

        <GlobalSearch />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <QuickCreateMenu />

        <button
          type="button"
          onClick={toggleNotifications}
          aria-label={t("header.notifications")}
          aria-expanded={notificationsOpen}
          title={t("header.notifications")}
          className={cn(
            "relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors",
            notificationsOpen
              ? "bg-surface-secondary text-foreground"
              : "text-muted-foreground hover:bg-surface-secondary hover:text-foreground",
          )}
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-highlight px-1 text-[10px] font-semibold leading-none text-highlight-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <LanguageSwitcher />
        <UserMenu />
      </div>
    </header>
  );
}

function GlobalSearch() {
  const t = useT();
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  const role = user?.role;
  const shortcuts = useMemo(() => {
    const navShortcuts = navItems.flatMap((group) =>
      group.items
        .filter((item) => !item.roles || (role !== undefined && item.roles.includes(role)))
        .map((item) => ({
          id: item.id,
          label: t(item.labelKey),
          href: item.href,
          icon: item.icon,
          group: "nav" as const,
        })),
    );
    return [
      ...navShortcuts,
      {
        id: "action-create-request",
        label: t("header.createRequest"),
        href: "/requests/new",
        icon: <PlusCircle size={15} />,
        group: "action" as const,
      },
      {
        id: "action-create-form",
        label: t("header.createForm"),
        href: "/forms/new",
        icon: <FilePlus2 size={15} />,
        group: "action" as const,
      },
      {
        id: "nav-profile",
        label: t("header.settings"),
        href: "/profile",
        icon: <Settings size={15} />,
        group: "nav" as const,
      },
    ];
  }, [role, t]);

  const trimmed = query.trim();
  const normalized = trimmed.toLowerCase();
  const filtered = useMemo(() => {
    if (!normalized) return shortcuts.slice(0, 6);
    return shortcuts.filter((s) => s.label.toLowerCase().includes(normalized));
  }, [normalized, shortcuts]);

  const navigate = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <Search
        size={14}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && trimmed) {
            e.preventDefault();
            navigate(`/requests/duty?q=${encodeURIComponent(trimmed)}`);
          }
        }}
        placeholder={t("header.quickSearchPlaceholder")}
        className="h-8 w-full rounded-md border border-border bg-surface-secondary/75 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/40 focus:bg-surface focus:ring-2 focus:ring-ring/10"
      />

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-full overflow-hidden rounded-lg border border-border bg-popover py-1.5 shadow-lg">
          {trimmed && (
            <div className="border-b border-border-subtle pb-1">
              <button
                type="button"
                onClick={() =>
                  navigate(`/requests/duty?q=${encodeURIComponent(trimmed)}`)
                }
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-surface-secondary"
              >
                <Search size={14} className="shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {t("header.quickSearchRequests")}:{" "}
                  <strong className="font-medium">&ldquo;{trimmed}&rdquo;</strong>
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate(`/requests/mine?q=${encodeURIComponent(trimmed)}`)
                }
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground hover:bg-surface-secondary"
              >
                <Search size={14} className="shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {t("header.quickSearchMine")}:{" "}
                  <strong className="font-medium">&ldquo;{trimmed}&rdquo;</strong>
                </span>
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {t("header.quickSearchEmpty")}
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto pt-1">
              <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {t("header.groupNavigation")}
              </p>
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.href)}
                  className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left text-sm text-foreground/90 hover:bg-surface-secondary hover:text-foreground"
                >
                  <span className="shrink-0 text-muted-foreground">
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuickCreateMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-secondary"
      >
        <Plus size={14} />
        <span className="hidden sm:inline">{t("header.quickCreate")}</span>
        <ChevronDown size={13} className="text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-lg">
          <MenuLink
            href="/requests/new"
            icon={<PlusCircle size={15} />}
            onClick={() => setOpen(false)}
          >
            {t("header.createRequest")}
          </MenuLink>
          <MenuLink
            href="/forms/new"
            icon={<FilePlus2 size={15} />}
            onClick={() => setOpen(false)}
          >
            {t("header.createForm")}
          </MenuLink>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const t = useT();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const name = user?.displayName ?? user?.email ?? "—";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors hover:bg-surface-secondary"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initial}
        </span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-28 truncate text-xs font-medium text-foreground">
            {name}
          </span>
          <span className="block text-[10px] capitalize text-muted-foreground">
            {user?.role}
          </span>
        </span>
        <ChevronDown size={14} className="text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-lg">
          <div className="border-b border-border-subtle px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">
              {name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.email}
            </p>
          </div>
          <MenuLink
            href="/profile"
            icon={<Settings size={15} />}
            onClick={() => setOpen(false)}
          >
            {t("header.settings")}
          </MenuLink>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-subtle"
          >
            <LogOut size={15} />
            {t("header.logout")}
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  children,
  onClick,
  className,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground/85 hover:bg-surface-secondary hover:text-foreground",
        className,
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      {children}
    </Link>
  );
}
