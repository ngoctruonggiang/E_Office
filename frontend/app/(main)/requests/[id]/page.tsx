import { RequestDetailScreen } from "@/features/requests/components/RequestDetailScreen";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RequestDetailScreen id={id} />;
}
