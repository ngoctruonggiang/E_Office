-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('PENDING', 'SIGNED', 'REJECTED');

-- AlterTable
ALTER TABLE "RequestDocument" ADD COLUMN     "signing" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "signatureImage" TEXT,
ADD COLUMN     "signatureName" TEXT;

-- CreateTable
CREATE TABLE "SignatureField" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "status" "SignatureStatus" NOT NULL DEFAULT 'PENDING',
    "signatureName" TEXT,
    "signatureImage" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignatureField_responseId_idx" ON "SignatureField"("responseId");

-- CreateIndex
CREATE INDEX "SignatureField_documentId_idx" ON "SignatureField"("documentId");

-- CreateIndex
CREATE INDEX "SignatureField_assigneeId_idx" ON "SignatureField"("assigneeId");

-- AddForeignKey
ALTER TABLE "SignatureField" ADD CONSTRAINT "SignatureField_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "FormResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureField" ADD CONSTRAINT "SignatureField_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureField" ADD CONSTRAINT "SignatureField_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
