-- Replace the non-unique index on (responseId, fieldKey) with a UNIQUE
-- constraint so the EAV value table supports upsert (one value per field
-- per request).
DROP INDEX "FormResponseValue_responseId_fieldKey_idx";

CREATE UNIQUE INDEX "FormResponseValue_responseId_fieldKey_key" ON "FormResponseValue"("responseId", "fieldKey");
