-- CreateEnum
CREATE TYPE "StoreGroup" AS ENUM ('FAV', 'COOP', 'EGYEB', 'VIDEK');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "storeGroup" "StoreGroup" NOT NULL DEFAULT 'EGYEB',
ADD COLUMN     "storeOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SandwichFixOrder" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SandwichFixOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandwichFixOrderLine" (
    "id" TEXT NOT NULL,
    "fixOrderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "SandwichFixOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SandwichFixOrder_weekday_active_idx" ON "SandwichFixOrder"("weekday", "active");

-- CreateIndex
CREATE UNIQUE INDEX "SandwichFixOrder_customerId_weekday_key" ON "SandwichFixOrder"("customerId", "weekday");

-- CreateIndex
CREATE INDEX "SandwichFixOrderLine_fixOrderId_idx" ON "SandwichFixOrderLine"("fixOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "SandwichFixOrderLine_fixOrderId_itemId_key" ON "SandwichFixOrderLine"("fixOrderId", "itemId");

-- CreateIndex
CREATE INDEX "Customer_storeGroup_storeOrder_idx" ON "Customer"("storeGroup", "storeOrder");

-- AddForeignKey
ALTER TABLE "SandwichFixOrder" ADD CONSTRAINT "SandwichFixOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandwichFixOrderLine" ADD CONSTRAINT "SandwichFixOrderLine_fixOrderId_fkey" FOREIGN KEY ("fixOrderId") REFERENCES "SandwichFixOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandwichFixOrderLine" ADD CONSTRAINT "SandwichFixOrderLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SandwichItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
