import { FormBuilderScreen } from "@/features/forms/components/builder/FormBuilderScreen";

export default async function EditFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FormBuilderScreen formId={id} />;
}
