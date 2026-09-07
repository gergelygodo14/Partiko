-- AlterEnum
ALTER TYPE "PriceSource" ADD VALUE 'NAV';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "navInvoiceNumber" TEXT,
ALTER COLUMN "photoUrl" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_supplier_navInvoiceNumber_key" ON "Invoice"("supplier", "navInvoiceNumber");

