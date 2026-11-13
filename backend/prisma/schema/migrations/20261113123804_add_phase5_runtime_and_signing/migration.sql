-- AlterTable
ALTER TABLE "FormResponse" ADD COLUMN     "businessKey" TEXT,
ADD COLUMN     "operatonProcessDefinitionId" TEXT,
ADD COLUMN     "operatonProcessInstanceId" TEXT,
ADD COLUMN     "procedureVersionId" TEXT;

-- AlterTable
ALTER TABLE "SignatureField" ADD COLUMN     "actualActorId" TEXT,
ADD COLUMN     "taskDefinitionKey" TEXT;

-- CreateTable
CREATE TABLE "request_actual_actors" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "taskDefinitionKey" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isOverridden" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "department" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_actual_actors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_projections" (
    "id" TEXT NOT NULL,
    "operatonTaskId" TEXT NOT NULL,
    "processInstanceId" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "taskDefinitionKey" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dueDate" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_projections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_actual_actors_responseId_idx" ON "request_actual_actors"("responseId");

-- CreateIndex
CREATE INDEX "request_actual_actors_userId_idx" ON "request_actual_actors"("userId");

-- CreateIndex
CREATE INDEX "request_actual_actors_responseId_taskDefinitionKey_idx" ON "request_actual_actors"("responseId", "taskDefinitionKey");

-- CreateIndex
CREATE UNIQUE INDEX "task_projections_operatonTaskId_key" ON "task_projections"("operatonTaskId");

-- CreateIndex
CREATE INDEX "task_projections_assigneeId_status_idx" ON "task_projections"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "task_projections_responseId_idx" ON "task_projections"("responseId");

-- CreateIndex
CREATE INDEX "task_projections_processInstanceId_idx" ON "task_projections"("processInstanceId");

-- CreateIndex
CREATE INDEX "FormResponse_procedureVersionId_idx" ON "FormResponse"("procedureVersionId");

-- CreateIndex
CREATE INDEX "FormResponse_operatonProcessInstanceId_idx" ON "FormResponse"("operatonProcessInstanceId");

-- CreateIndex
CREATE INDEX "FormResponse_businessKey_idx" ON "FormResponse"("businessKey");

-- CreateIndex
CREATE INDEX "SignatureField_responseId_taskDefinitionKey_idx" ON "SignatureField"("responseId", "taskDefinitionKey");

-- AddForeignKey
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_procedureVersionId_fkey" FOREIGN KEY ("procedureVersionId") REFERENCES "procedure_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_actual_actors" ADD CONSTRAINT "request_actual_actors_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "FormResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_actual_actors" ADD CONSTRAINT "request_actual_actors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_projections" ADD CONSTRAINT "task_projections_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "FormResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_projections" ADD CONSTRAINT "task_projections_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
