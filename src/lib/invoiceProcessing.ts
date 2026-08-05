import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { PriceSource, ProductStatus, type Supplier } from "@/generated/prisma/client";
import { findBestProductMatch } from "@/lib/productMatching";
import { openRouterJsonCompletion } from "@/lib/openrouter";

export type ExtractedLineItem = {
  name: string;
  shortName: string;
  unit: string | null;
  quantity: number;
  unitPrice: number;
};

export type ExtractedInvoice = {
  invoiceDate: string | null;
  lineItems: ExtractedLineItem[];
};

export async function extractInvoiceLineItems(imageUrl: string): Promise<ExtractedInvoice> {
  const text = await openRouterJsonCompletion({
    maxTokens: 8192,
    content: [
      { type: "image_url", image_url: { url: imageUrl } },
      {
        type: "text",
        text:
          "Ez egy beszállítói számla fotója. Olvasd ki a tételsorokat (termék neve, mennyiségi egység, mennyiség, nettó egységár forintban) és a számla dátumát, ha szerepel rajta — a dátumot ISO 8601 formátumban add vissza (ÉÉÉÉ-HH-NN). Minden tételhez add meg a `shortName` mezőt is: egy rövid, köznyelvi magyar elnevezés (1-3 szó, pl. \"Csirkemell\", \"Tejföl\", \"Zsemlemorzsa\"), NEM a teljes, gyakran hosszú gyári/nagykereskedelmi terméknév (pl. \"FRISS CSIRKE MELLFILÉ FELEZETT FINOM CSIBE LÉDIG 12 KG/# HU1512EK\" helyett csak \"Csirkemell\") — ezt egy tömör árváltozás-összesítéshez használjuk.\n\n" +
          "Válaszolj kizárólag egy JSON objektummal, pontosan ebben a formában:\n" +
          '{"invoiceDate": "ÉÉÉÉ-HH-NN" vagy null, "lineItems": [{"name": string, "shortName": string, "unit": string vagy null, "quantity": szám, "unitPrice": szám}, ...]}',
      },
    ],
  });
  return JSON.parse(text) as ExtractedInvoice;
}

type PriceObservationRecord = { supplier: Supplier; unitPrice: number };

export type PriceChangeNote = {
  productName: string;
  shortName: string;
  supplier: Supplier;
  newPrice: number;
  priorSamePrice: number | null;
  otherSupplierPrice: number | null;
  otherSupplier: Supplier | null;
};

export function buildPriceChangeNote(
  productName: string,
  shortName: string,
  supplier: Supplier,
  newPrice: number,
  priorSameSupplier: PriceObservationRecord | null,
  latestOtherSupplier: PriceObservationRecord | null
): PriceChangeNote {
  return {
    productName,
    shortName,
    supplier,
    newPrice,
    priorSamePrice: priorSameSupplier?.unitPrice ?? null,
    otherSupplierPrice: latestOtherSupplier?.unitPrice ?? null,
    otherSupplier: latestOtherSupplier?.supplier ?? null,
  };
}

const SUPPLIER_LABEL_INESSIVE: Record<Supplier, string> = {
  SAJTFUTAR: "Sajtfutárnál",
  BAROMFIUDVAR: "Baromfiudvarnál",
};

// A short, prominent headline for the items that actually changed price,
// meant to sit at the TOP of the summary - the detailed per-item list below
// (formatPriceChangeSummary) buries changes among many unchanged lines on a
// large invoice, which the user found too easy to miss.
export function buildHighlightSummary(notes: PriceChangeNote[]): string {
  const changed = notes.filter(
    (note) => note.priorSamePrice !== null && note.priorSamePrice !== note.newPrice
  );
  if (changed.length === 0) return "";

  const lines = changed.map((note) => {
    const priorPrice = note.priorSamePrice as number;
    const direction = note.newPrice > priorPrice ? "drágább" : "olcsóbb";
    const arrow = note.newPrice > priorPrice ? "📈" : "📉";
    const supplierLabel = SUPPLIER_LABEL_INESSIVE[note.supplier];
    return `${arrow} ${note.shortName} ára ${direction} lett (${priorPrice} → ${note.newPrice} Ft, ${supplierLabel})`;
  });

  return lines.join("\n");
}

// A misread invoice photo doesn't average out or cancel across items - it
// shows up as one implausible number (a real example: a row-shift bug once
// put a 750 Ft item's price on a 1200 Ft item). Rather than trust every
// number the vision model returns, a jump this large against the product's
// own last same-supplier price gets held back for a manual look before it's
// allowed to become real price history.
export const LARGE_PRICE_CHANGE_THRESHOLD = 0.2;

export type PendingPriceItem = {
  id: string;
  productId: string;
  productName: string;
  shortName: string;
  rawText: string;
  unit: string | null;
  newPrice: number;
  priorPrice: number;
  observedDate: string;
};

function isLargePriceChange(newPrice: number, priorPrice: number): boolean {
  if (priorPrice === 0) return false;
  return Math.abs(newPrice - priorPrice) / priorPrice >= LARGE_PRICE_CHANGE_THRESHOLD;
}

export function buildPendingReviewNote(items: PendingPriceItem[]): string {
  if (items.length === 0) return "";
  const lines = items.map((item) => {
    const direction = item.newPrice > item.priorPrice ? "drágább" : "olcsóbb";
    const diffPct = Math.abs(((item.newPrice - item.priorPrice) / item.priorPrice) * 100);
    return (
      `❓ ${item.shortName}: ${item.priorPrice} → ${item.newPrice} Ft ` +
      `(${diffPct.toFixed(0)}%-kal ${direction}) - megerősítés szükséges, egyelőre nincs elmentve`
    );
  });
  return `Nagy áreltérést találtam, jóváhagyásra vár:\n${lines.join("\n")}`;
}

export function formatPriceChangeSummary(notes: PriceChangeNote[]): string {
  if (notes.length === 0) return "Nem sikerült egyetlen tételt sem feldolgozni.";

  const lines = notes.map((note) => {
    const parts: string[] = [];
    const supplierLabel = SUPPLIER_LABEL_INESSIVE[note.supplier];

    if (note.priorSamePrice !== null && note.priorSamePrice !== note.newPrice) {
      const diffPct = ((note.newPrice - note.priorSamePrice) / note.priorSamePrice) * 100;
      const direction = diffPct > 0 ? "nőtt" : "csökkent";
      parts.push(
        `${note.productName}: ${note.priorSamePrice} → ${note.newPrice} Ft ` +
          `(${supplierLabel}, ${direction} ${Math.abs(diffPct).toFixed(1)}%)`
      );
    } else {
      parts.push(`${note.productName}: ${note.newPrice} Ft (${supplierLabel})`);
    }

    if (note.otherSupplierPrice !== null && note.otherSupplier) {
      const otherLabel = SUPPLIER_LABEL_INESSIVE[note.otherSupplier];
      if (note.otherSupplierPrice < note.newPrice) {
        parts.push(`most olcsóbb a ${otherLabel} (${note.otherSupplierPrice} Ft)`);
      } else if (note.otherSupplierPrice > note.newPrice) {
        parts.push(`most ${supplierLabel} olcsóbb, mint a ${otherLabel} (${note.otherSupplierPrice} Ft)`);
      }
    }

    return parts.join(" — ");
  });

  return `${notes.length} tétel feldolgozva.\n${lines.join("\n")}`;
}

export async function processInvoiceLineItems(
  invoiceId: string,
  supplier: Supplier,
  extraction: ExtractedInvoice
): Promise<{ summaryText: string; highlightText: string | null; pendingLineItems: PendingPriceItem[] }> {
  const observedDate = extraction.invoiceDate ? new Date(extraction.invoiceDate) : new Date();
  const confirmedProducts = await prisma.product.findMany({
    where: { status: ProductStatus.CONFIRMED },
  });

  const notes: PriceChangeNote[] = [];
  const pendingLineItems: PendingPriceItem[] = [];

  for (const item of extraction.lineItems) {
    const match = findBestProductMatch(item.name, confirmedProducts);
    let productId: string;
    let productName: string;

    if (match) {
      productId = match.id;
      productName = match.name;
    } else {
      const created = await prisma.product.create({
        data: {
          name: item.name,
          unit: item.unit ?? undefined,
          status: ProductStatus.PENDING,
        },
      });
      productId = created.id;
      productName = created.name;
    }

    const unitPrice = Math.round(item.unitPrice);

    const [priorSameSupplier, latestOtherSupplier] = await Promise.all([
      prisma.priceObservation.findFirst({
        where: { productId, supplier },
        orderBy: { observedDate: "desc" },
      }),
      prisma.priceObservation.findFirst({
        where: { productId, supplier: { not: supplier } },
        orderBy: { observedDate: "desc" },
      }),
    ]);

    if (priorSameSupplier && isLargePriceChange(unitPrice, priorSameSupplier.unitPrice)) {
      pendingLineItems.push({
        id: randomUUID(),
        productId,
        productName,
        shortName: item.shortName,
        rawText: item.name,
        unit: item.unit,
        newPrice: unitPrice,
        priorPrice: priorSameSupplier.unitPrice,
        observedDate: observedDate.toISOString(),
      });
      continue;
    }

    await prisma.priceObservation.create({
      data: {
        productId,
        supplier,
        unitPrice,
        unit: item.unit ?? undefined,
        observedDate,
        source: PriceSource.INVOICE_PHOTO,
        rawText: item.name,
        invoiceId,
      },
    });

    notes.push(
      buildPriceChangeNote(
        productName,
        item.shortName,
        supplier,
        unitPrice,
        priorSameSupplier,
        latestOtherSupplier
      )
    );
  }

  const highlight = buildHighlightSummary(notes);
  const pendingNote = buildPendingReviewNote(pendingLineItems);
  // A fully-pending invoice (every item flagged) has nothing left for
  // formatPriceChangeSummary to report on - its "not a single item could be
  // processed" fallback would be misleading here, so skip it in that case.
  const detail = notes.length > 0 || pendingLineItems.length === 0 ? formatPriceChangeSummary(notes) : "";
  const summaryText = [pendingNote, highlight, detail].filter(Boolean).join("\n\n");

  return { summaryText, highlightText: highlight || null, pendingLineItems };
}
