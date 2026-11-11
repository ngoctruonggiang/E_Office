-- CreateEnum
CREATE TYPE "SigningEnvelopeStatus" AS ENUM ('DRAFT', 'PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SigningRecipientStatus" AS ENUM ('NOT_SIGNED', 'SIGNED');

-- AlterEnum
ALTER TYPE "RequestStatus" ADD VALUE 'REQUEST_CHANGES';

-- AlterEnum
ALTER TYPE "TaskType" ADD VALUE 'CLOSE';

-- AlterTable
ALTER TABLE "FlowStep" ADD COLUMN     "isFinal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT;

-- AlterTable
ALTER TABLE "FormResponse" ADD COLUMN     "cloneMode" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "signing_envelopes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documensoDocumentId" INTEGER NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "status" "SigningEnvelopeStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signing_envelopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signing_recipients" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documensoRecipientId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "signingUrl" TEXT NOT NULL,
    "status" "SigningRecipientStatus" NOT NULL DEFAULT 'NOT_SIGNED',
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signing_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signing_fields" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "documensoFieldId" INTEGER NOT NULL,
    "page" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signing_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "signing_envelopes_documensoDocumentId_key" ON "signing_envelopes"("documensoDocumentId");

-- CreateIndex
CREATE INDEX "signing_envelopes_ownerId_idx" ON "signing_envelopes"("ownerId");

-- CreateIndex
CREATE INDEX "signing_recipients_userId_idx" ON "signing_recipients"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "signing_recipients_envelopeId_userId_key" ON "signing_recipients"("envelopeId", "userId");

-- CreateIndex
CREATE INDEX "signing_fields_envelopeId_idx" ON "signing_fields"("envelopeId");

-- AddForeignKey
ALTER TABLE "signing_envelopes" ADD CONSTRAINT "signing_envelopes_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signing_recipients" ADD CONSTRAINT "signing_recipients_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "signing_envelopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signing_recipients" ADD CONSTRAINT "signing_recipients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signing_fields" ADD CONSTRAINT "signing_fields_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "signing_envelopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signing_fields" ADD CONSTRAINT "signing_fields_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "signing_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
