import { Suspense } from "react";
import { RequestListScreen } from "@/features/requests/components/RequestListScreen";

export default function RequestsViewablePage() {
  return (
    <Suspense>
      <RequestListScreen scope="viewable" />
    </Suspense>
  );
}
