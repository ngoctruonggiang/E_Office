import type { ReactNode } from "react";
import { StaffTabs } from "./StaffTabs";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6 p-6">
      <StaffTabs />
      {children}
    </div>
  );
}
