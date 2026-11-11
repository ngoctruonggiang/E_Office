import { Suspense } from "react";
import { RequestListScreen } from "@/features/requests/components/RequestListScreen";

export default function RequestsMinePage() {
  return (
    <Suspense>
      <RequestListScreen scope="mine" />
    </Suspense>
  );
}
