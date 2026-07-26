-- CreateTable
CREATE TABLE "SandwichItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandwichItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandwichOrder" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SandwichOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandwichOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceFt" INTEGER NOT NULL,

    CONSTRAINT "SandwichOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SandwichOrder_orderDate_idx" ON "SandwichOrder"("orderDate");

-- CreateIndex
CREATE UNIQUE INDEX "SandwichOrder_customerId_orderDate_key" ON "SandwichOrder"("customerId", "orderDate");

-- CreateIndex
CREATE INDEX "SandwichOrderLine_orderId_idx" ON "SandwichOrderLine"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "SandwichOrderLine_orderId_itemId_key" ON "SandwichOrderLine"("orderId", "itemId");

-- AddForeignKey
ALTER TABLE "SandwichOrder" ADD CONSTRAINT "SandwichOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandwichOrderLine" ADD CONSTRAINT "SandwichOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SandwichOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandwichOrderLine" ADD CONSTRAINT "SandwichOrderLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SandwichItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
