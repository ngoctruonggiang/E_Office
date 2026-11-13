-- CreateEnum
CREATE TYPE "ProcedureStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ActorAssigneeType" AS ENUM ('DIRECT_USER', 'DYNAMIC_RULE');

-- CreateEnum
CREATE TYPE "VariableMappingType" AS ENUM ('NUMBER', 'STRING', 'BOOLEAN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "department" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "procedures" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT,
    "icon" TEXT DEFAULT 'file-text',
    "color" TEXT DEFAULT '#2563eb',
    "activeVersionId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedure_versions" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ProcedureStatus" NOT NULL DEFAULT 'DRAFT',
    "formVersionId" TEXT NOT NULL,
    "operatonDefinitionId" TEXT NOT NULL,
    "operatonDefinitionKey" TEXT NOT NULL,
    "operatonDefinitionVersion" INTEGER NOT NULL,
    "operatonDeploymentId" TEXT,
    "bpmnSnapshotXml" TEXT,
    "createdById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procedure_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedure_actor_mappings" (
    "id" TEXT NOT NULL,
    "procedureVersionId" TEXT NOT NULL,
    "taskDefinitionKey" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "assigneeType" "ActorAssigneeType" NOT NULL DEFAULT 'DIRECT_USER',
    "defaultUserId" TEXT,
    "ruleConfig" JSONB,
    "allowOverride" BOOLEAN NOT NULL DEFAULT true,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "isMultiInstance" BOOLEAN NOT NULL DEFAULT false,
    "collectionVariable" TEXT,

    CONSTRAINT "procedure_actor_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedure_variable_mappings" (
    "id" TEXT NOT NULL,
    "procedureVersionId" TEXT NOT NULL,
    "operatonVarName" TEXT NOT NULL,
    "formFieldKey" TEXT NOT NULL,
    "variableType" "VariableMappingType" NOT NULL DEFAULT 'NUMBER',
    "fallbackValue" TEXT,

    CONSTRAINT "procedure_variable_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "procedures_code_key" ON "procedures"("code");

-- CreateIndex
CREATE INDEX "procedure_versions_procedureId_status_idx" ON "procedure_versions"("procedureId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "procedure_versions_procedureId_version_key" ON "procedure_versions"("procedureId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "procedure_actor_mappings_procedureVersionId_taskDefinitionK_key" ON "procedure_actor_mappings"("procedureVersionId", "taskDefinitionKey");

-- CreateIndex
CREATE UNIQUE INDEX "procedure_variable_mappings_procedureVersionId_operatonVarN_key" ON "procedure_variable_mappings"("procedureVersionId", "operatonVarName");

-- AddForeignKey
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "procedure_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_versions" ADD CONSTRAINT "procedure_versions_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "procedures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_versions" ADD CONSTRAINT "procedure_versions_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "FormVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_versions" ADD CONSTRAINT "procedure_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_actor_mappings" ADD CONSTRAINT "procedure_actor_mappings_procedureVersionId_fkey" FOREIGN KEY ("procedureVersionId") REFERENCES "procedure_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_actor_mappings" ADD CONSTRAINT "procedure_actor_mappings_defaultUserId_fkey" FOREIGN KEY ("defaultUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_variable_mappings" ADD CONSTRAINT "procedure_variable_mappings_procedureVersionId_fkey" FOREIGN KEY ("procedureVersionId") REFERENCES "procedure_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
