"use client";

import { useT } from "@/components/providers/I18nProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardBody } from "@/components/ui/Card";

export default function HomePage() {
  const t = useT();
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {t("nav.dashboard")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user?.displayName ?? user?.email}
        </p>
      </div>

      <Card>
        <CardBody>
          <p className="text-sm text-muted-foreground">
            {/* Dashboard summary cards & charts land in a later slice. */}
            {t("common.noData")}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
