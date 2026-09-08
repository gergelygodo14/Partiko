-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "issueDate" TIMESTAMP(3),
ADD COLUMN     "netAmountHUF" INTEGER,
ADD COLUMN     "vatAmountHUF" INTEGER;

-- CreateIndex
CREATE INDEX "Invoice_issueDate_idx" ON "Invoice"("issueDate");
