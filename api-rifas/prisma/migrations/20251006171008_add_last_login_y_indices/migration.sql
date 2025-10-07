-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "lastLogin" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Usuario_rol_idx" ON "Usuario"("rol");

-- CreateIndex
CREATE INDEX "Usuario_isActive_idx" ON "Usuario"("isActive");
