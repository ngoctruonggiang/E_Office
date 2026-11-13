-- AlterEnum
ALTER TYPE "FieldType" ADD VALUE 'TABLE';

-- AlterTable
ALTER TABLE "FormField" ADD COLUMN     "tableConfig" JSONB;

-- AlterTable
ALTER TABLE "FormVersion" ADD COLUMN     "layoutSchema" JSONB;
