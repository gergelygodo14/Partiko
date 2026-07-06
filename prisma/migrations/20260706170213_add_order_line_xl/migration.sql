-- AlterTable
ALTER TABLE "OrderLine" ADD COLUMN     "isXl" BOOLEAN NOT NULL DEFAULT false;

-- DropIndex
DROP INDEX "OrderLine_orderId_dayIndex_letter_key";

-- CreateIndex
CREATE UNIQUE INDEX "OrderLine_orderId_dayIndex_letter_isXl_key" ON "OrderLine"("orderId", "dayIndex", "letter", "isXl");
