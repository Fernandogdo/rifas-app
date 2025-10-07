/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `Orden` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Orden_idempotencyKey_key" ON "Orden"("idempotencyKey");
