-- DropIndex
DROP INDEX "Invoice_supplier_navInvoiceNumber_key";

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "supplierName" TEXT,
ADD COLUMN     "supplierTaxNumber" TEXT,
ALTER COLUMN "supplier" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_supplierTaxNumber_navInvoiceNumber_key" ON "Invoice"("supplierTaxNumber", "navInvoiceNumber");
