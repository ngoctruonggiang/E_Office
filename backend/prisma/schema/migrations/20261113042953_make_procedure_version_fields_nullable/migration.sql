-- DropForeignKey
ALTER TABLE "procedure_versions" DROP CONSTRAINT "procedure_versions_formVersionId_fkey";

-- AlterTable
ALTER TABLE "procedure_versions" ALTER COLUMN "formVersionId" DROP NOT NULL,
ALTER COLUMN "operatonDefinitionId" DROP NOT NULL,
ALTER COLUMN "operatonDefinitionKey" DROP NOT NULL,
ALTER COLUMN "operatonDefinitionVersion" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "procedure_versions" ADD CONSTRAINT "procedure_versions_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "FormVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
