/*
  Warnings:

  - A unique constraint covering the columns `[clientTransactionId]` on the table `Orden` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Orden" ADD COLUMN     "clientTransactionId" VARCHAR(15);

-- CreateIndex
CREATE UNIQUE INDEX "Orden_clientTransactionId_key" ON "Orden"("clientTransactionId");
