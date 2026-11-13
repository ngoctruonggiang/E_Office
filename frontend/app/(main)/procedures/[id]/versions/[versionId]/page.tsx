import { ProcedureBuilder } from '@/features/procedure';

export default async function ProcedureVersionPage({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}) {
  const { versionId } = await params;
  return <ProcedureBuilder versionId={versionId} />;
}

