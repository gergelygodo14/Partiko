import { prisma } from "@/lib/db";
import { PriceSource, ProductStatus, type PriceSource as PriceSourceType, type Supplier } from "@/generated/prisma/client";
import { findBestProductMatch, type ProductCandidate } from "@/lib/productMatching";
import type { ParsedPriceList } from "@/lib/priceListParsing";

export type PriceListIngestResult =
  | { status: "already_processed"; productCount: number }
  | { status: "imported"; productCount: number };

const SUPPLIER_LABEL: Record<Supplier, string> = {
  SAJTFUTAR: "Sajtfutár",
  BAROMFIUDVAR: "Baromfiudvar",
};

// Only called for a freshly-imported price list (not "already_processed")
// so the owner gets a one-time confirmation per week, not a daily ping.
export function buildPriceListNotificationText(supplier: Supplier, productCount: number): string {
  return `🧾 Új ${SUPPLIER_LABEL[supplier]} árközlő feldolgozva: ${productCount} termék.`;
}

type ObservationInput = {
  productId: string;
  supplier: Supplier;
  unitPrice: number;
  unit?: string;
  observedDate: Date;
  source: PriceSourceType;
  rawText: string;
};

export async function ingestPriceList(
  emailMessageId: string,
  supplier: Supplier,
  parsed: ParsedPriceList
): Promise<PriceListIngestResult> {
  const existing = await prisma.priceListImportRun.findUnique({ where: { emailMessageId } });
  if (existing) {
    return { status: "already_processed", productCount: existing.productCount };
  }

  const observedDate = parsed.validFrom ?? new Date();
  const confirmedProducts: ProductCandidate[] = await prisma.product.findMany({
    where: { status: ProductStatus.CONFIRMED },
    select: { id: true, name: true },
  });

  const observations: ObservationInput[] = [];

  for (const item of parsed.items) {
    const match = findBestProductMatch(item.name, confirmedProducts);
    let productId: string;

    if (match) {
      productId = match.id;
    } else {
      const created = await prisma.product.create({
        data: { name: item.name, unit: item.unit ?? undefined, status: ProductStatus.CONFIRMED },
      });
      productId = created.id;
      confirmedProducts.push({ id: created.id, name: created.name });
    }

    observations.push({
      productId,
      supplier,
      unitPrice: item.unitPrice,
      unit: item.unit ?? undefined,
      observedDate,
      source: PriceSource.EMAIL_PRICELIST,
      rawText: item.name,
    });
  }

  await prisma.priceObservation.createMany({ data: observations });
  await prisma.priceListImportRun.create({
    data: { emailMessageId, supplier, productCount: parsed.items.length },
  });

  return { status: "imported", productCount: parsed.items.length };
}
