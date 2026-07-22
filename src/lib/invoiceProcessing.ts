import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { PriceSource, ProductStatus, type Supplier } from "@/generated/prisma/client";
import { findBestProductMatch } from "@/lib/productMatching";

const anthropic = new Anthropic();
const MODEL = "claude-sonnet-5";

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

const LINE_ITEM_SCHEMA = {
  type: "object",
  properties: {
    invoiceDate: { anyOf: [{ type: "string", format: "date" }, { type: "null" }] },
    lineItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          shortName: { type: "string" },
          unit: { anyOf: [{ type: "string" }, { type: "null" }] },
          quantity: { type: "number" },
          unitPrice: { type: "number" },
        },
        required: ["name", "shortName", "unit", "quantity", "unitPrice"],
        additionalProperties: false,
      },
    },
  },
  required: ["invoiceDate", "lineItems"],
  additionalProperties: false,
} as const;

export async function extractInvoiceLineItems(imageUrl: string): Promise<ExtractedInvoice> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: LINE_ITEM_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          {
            type: "text",
            text: "Ez egy beszállítói számla fotója. Olvasd ki a tételsorokat (termék neve, mennyiségi egység, mennyiség, nettó egységár forintban) és a számla dátumát, ha szerepel rajta — a dátumot ISO 8601 formátumban add vissza (ÉÉÉÉ-HH-NN). Minden tételhez add meg a `shortName` mezőt is: egy rövid, köznyelvi magyar elnevezés (1-3 szó, pl. \"Csirkemell\", \"Tejföl\", \"Zsemlemorzsa\"), NEM a teljes, gyakran hosszú gyári/nagykereskedelmi terméknév (pl. \"FRISS CSIRKE MELLFILÉ FELEZETT FINOM CSIBE LÉDIG 12 KG/# HU1512EK\" helyett csak \"Csirkemell\") — ezt egy tömör árváltozás-összesítéshez használjuk. Csak a megadott séma szerinti JSON-t add vissza.",
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  if (!textBlock) {
    throw new Error("Az AI nem adott vissza szöveges választ");
  }
  return JSON.parse(textBlock.text) as ExtractedInvoice;
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
): Promise<{ summaryText: string; highlightText: string | null }> {
  const observedDate = extraction.invoiceDate ? new Date(extraction.invoiceDate) : new Date();
  const confirmedProducts = await prisma.product.findMany({
    where: { status: ProductStatus.CONFIRMED },
  });

  const notes: PriceChangeNote[] = [];

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
  const detail = formatPriceChangeSummary(notes);
  return {
    summaryText: highlight ? `${highlight}\n\n${detail}` : detail,
    highlightText: highlight || null,
  };
}
