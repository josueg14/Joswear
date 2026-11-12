CREATE TABLE "RestockAlert" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notifiedAt" TIMESTAMP(3),
  CONSTRAINT "RestockAlert_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RestockAlert_customerId_variantId_key" ON "RestockAlert"("customerId", "variantId");
CREATE INDEX "RestockAlert_variantId_notifiedAt_idx" ON "RestockAlert"("variantId", "notifiedAt");
ALTER TABLE "RestockAlert" ADD CONSTRAINT "RestockAlert_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestockAlert" ADD CONSTRAINT "RestockAlert_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
