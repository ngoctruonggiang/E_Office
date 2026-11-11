"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  FilePlus2,
  PlusCircle,
  LogOut,
  Settings,
  ChevronDown,
} from "lucide-react";
import { useT } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { cn } from "@/lib/utils/cn";

/** Top header: quick-action tabs (center), language + profile menu (right). */
export function Header() {
  const t = useT();

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-4 shadow-sm">
      {/* Center quick actions */}
      <div className="flex flex-1 items-center justify-center gap-2">
        <Link
          href="/forms/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground"
        >
          <FilePlus2 size={16} />
          {t("header.createForm")}
        </Link>
        <Link
          href="/requests/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <PlusCircle size={16} />
          {t("header.createRequest")}
        </Link>
      </div>

      <div className="flex items-center gap-1">
        <LanguageSwitcher />
        <UserMenu />
      </div>
    </header>
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
        className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 hover:bg-muted"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initial}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium text-foreground">
            {name}
          </span>
          <span className="block text-[11px] capitalize text-muted-foreground">
            {user?.role}
          </span>
        </span>
        <ChevronDown size={15} className="text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-md border border-border bg-popover py-1 shadow-lg">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">
              {name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.email}
            </p>
          </div>
          <MenuLink href="/profile" icon={<Settings size={15} />} onClick={() => setOpen(false)}>
            {t("header.settings")}
          </MenuLink>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted"
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
        "flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground/80 hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
