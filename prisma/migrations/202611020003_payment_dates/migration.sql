ALTER TABLE "Payment" ADD COLUMN "confirmedAt" TIMESTAMP(3), ADD COLUMN "refundedAt" TIMESTAMP(3);
CREATE INDEX "Payment_status_confirmedAt_idx" ON "Payment"("status", "confirmedAt");
