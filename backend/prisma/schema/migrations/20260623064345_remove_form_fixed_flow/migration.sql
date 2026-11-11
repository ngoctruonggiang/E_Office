-- A Form is a basic-information template only; the approval flow now
-- belongs to the request (FormResponse), built by the end-user at request
-- creation time (see Flow/FlowInstance + RequestService.create).

-- DropForeignKey
ALTER TABLE "Form" DROP CONSTRAINT "Form_flowId_fkey";

-- AlterTable
ALTER TABLE "Form" DROP COLUMN "flowId";
