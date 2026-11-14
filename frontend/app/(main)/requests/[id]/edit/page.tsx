import { EditRequestScreen } from "@/features/requests/components/EditRequestScreen";

export default async function EditRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditRequestScreen id={id} />;
}

