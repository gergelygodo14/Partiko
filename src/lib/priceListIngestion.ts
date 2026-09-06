import { prisma } from "@/lib/db";
import { PriceSource, ProductStatus, type PriceSource as PriceSourceType, type Supplier } from "@/generated/prisma/client";
import { findBestProductMatch, type ProductCandidate } from "@/lib/productMatching";
import type { ParsedPriceList } from "@/lib/priceListParsing";
import { isLargePriceChange } from "@/lib/priceChangeThreshold";
import { sendTelegramMessage } from "@/lib/telegram";

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

type PriceJump = { productName: string; supplier: Supplier; priorPrice: number; newPrice: number };

// Unlike invoiceProcessing.ts's pendingLineItems, a jump here is never held
// back - this is a structured, machine-generated source (no OCR misread
// risk, see CLAUDE.md), so it's saved as usual and just also flagged
// immediately (owner request, 2026-09-06).
export function buildPriceJumpAlertText(jumps: PriceJump[]): string {
  if (jumps.length === 0) return "";
  const lines = jumps.map((jump) => {
    const direction = jump.newPrice > jump.priorPrice ? "drágább" : "olcsóbb";
    const diffPct = Math.abs(((jump.newPrice - jump.priorPrice) / jump.priorPrice) * 100);
    return `${jump.newPrice > jump.priorPrice ? "📈" : "📉"} ${jump.productName} (${SUPPLIER_LABEL[jump.supplier]}): ${jump.priorPrice} → ${jump.newPrice} Ft (${diffPct.toFixed(0)}%-kal ${direction})`;
  });
  return `⚠️ Nagy áreltérés az új árközlőben:\n${lines.join("\n")}`;
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
  const jumps: PriceJump[] = [];

  for (const item of parsed.items) {
    const match = findBestProductMatch(item.name, confirmedProducts);
    let productId: string;
    let productName: string;

    if (match) {
      productId = match.id;
      productName = match.name;
    } else {
      const created = await prisma.product.create({
        data: { name: item.name, unit: item.unit ?? undefined, status: ProductStatus.CONFIRMED },
      });
      productId = created.id;
      productName = created.name;
      confirmedProducts.push({ id: created.id, name: created.name });
    }

    // Only meaningful for a product that already had a price on record with
    // this same supplier - a brand-new product/supplier pairing has nothing
    // to jump from.
    const priorSameSupplier = await prisma.priceObservation.findFirst({
      where: { productId, supplier },
      orderBy: { observedDate: "desc" },
      select: { unitPrice: true },
    });
    if (priorSameSupplier && isLargePriceChange(item.unitPrice, priorSameSupplier.unitPrice)) {
      jumps.push({
        productName,
        supplier,
        priorPrice: priorSameSupplier.unitPrice,
        newPrice: item.unitPrice,
      });
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

  if (jumps.length > 0) {
    try {
      await sendTelegramMessage(buildPriceJumpAlertText(jumps));
    } catch (e) {
      console.error("Telegram price-jump alert failed:", e);
    }
  }

  await prisma.priceListImportRun.create({
    data: { emailMessageId, supplier, productCount: parsed.items.length },
  });

  return { status: "imported", productCount: parsed.items.length };
}
