import type { ReactNode } from "react";
import { LayoutProvider } from "@/components/providers/LayoutProvider";
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import { ModalProvider } from "@/components/providers/ModalProvider";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <LayoutProvider>
        <NotificationProvider>
          <ModalProvider>
            <AppShell>{children}</AppShell>
          </ModalProvider>
        </NotificationProvider>
      </LayoutProvider>
    </RequireAuth>
  );
}
