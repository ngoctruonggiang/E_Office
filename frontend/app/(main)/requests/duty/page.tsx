import { Suspense } from "react";
import { RequestListScreen } from "@/features/requests/components/RequestListScreen";

export default function RequestsDutyPage() {
  return (
    <Suspense>
      <RequestListScreen scope="duty" />
    </Suspense>
  );
}
