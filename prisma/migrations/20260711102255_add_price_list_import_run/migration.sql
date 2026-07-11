-- CreateTable
CREATE TABLE "PriceListImportRun" (
    "id" TEXT NOT NULL,
    "emailMessageId" TEXT NOT NULL,
    "supplier" "Supplier" NOT NULL,
    "productCount" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceListImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceListImportRun_emailMessageId_key" ON "PriceListImportRun"("emailMessageId");
