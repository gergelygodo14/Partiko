import { prisma } from "@/lib/db";
import type { Supplier } from "@/generated/prisma/client";

export type SupplierPricePoint = {
  price: number;
  date: string;
  trend: "up" | "down" | "same" | null;
  previousPrice: number | null;
  // Set when `price` was computed by dividing a box/case price by the
  // product's packSize - carries the original raw price+unit so the UI can
  // show "5986 Ft/doboz alapján" instead of silently only showing the math.
  normalizedFrom: { price: number; unit: string | null } | null;
};

export type ProductPriceComparisonRow = {
  productId: string;
  productName: string;
  packSize: number | null;
  bySupplier: Partial<Record<Supplier, SupplierPricePoint>>;
  cheaperSupplier: Supplier | null;
};

const BOX_UNIT_WORDS = new Set(["doboz", "karton", "csomag"]);

function isBoxUnit(unit: string | null): boolean {
  return unit !== null && BOX_UNIT_WORDS.has(unit.trim().toLowerCase());
}

// When a product has a known packSize (pieces per box) and an observation's
// unit is a box-style unit, converts the price to an effective per-piece
// price so it's comparable against a supplier that prices the same product
// per piece - e.g. one supplier invoices "1 doboz" at 5986 Ft while another
// invoices "1 db" at 46 Ft; with packSize=150 both become ~40 Ft/db.
function effectivePrice(
  unitPrice: number,
  unit: string | null,
  packSize: number | null
): { price: number; normalizedFrom: SupplierPricePoint["normalizedFrom"] } {
  if (packSize && packSize > 0 && isBoxUnit(unit)) {
    return { price: Math.round(unitPrice / packSize), normalizedFrom: { price: unitPrice, unit } };
  }
  return { price: unitPrice, normalizedFrom: null };
}

export async function getPriceComparison(): Promise<ProductPriceComparisonRow[]> {
  const products = await prisma.product.findMany({
    where: { status: "CONFIRMED" },
    include: {
      // Same-day observations happen (e.g. a manual invoice-photo upload and
      // an emailed price-list landing on the same calendar date) - break
      // ties by createdAt so the actually-most-recently-recorded price wins,
      // not whichever row Postgres happens to return first.
      priceObservations: { orderBy: [{ observedDate: "desc" }, { createdAt: "desc" }] },
    },
  });

  return products.map((product) => {
    const grouped = new Map<Supplier, typeof product.priceObservations>();
    for (const obs of product.priceObservations) {
      const list = grouped.get(obs.supplier) ?? [];
      list.push(obs);
      grouped.set(obs.supplier, list);
    }

    const bySupplier: ProductPriceComparisonRow["bySupplier"] = {};
    for (const [supplier, obsList] of grouped) {
      const [latest, previous] = obsList;
      const latestEff = effectivePrice(latest.unitPrice, latest.unit, product.packSize);
      const previousEff = previous
        ? effectivePrice(previous.unitPrice, previous.unit, product.packSize)
        : null;

      let trend: SupplierPricePoint["trend"] = null;
      if (previousEff) {
        trend =
          latestEff.price > previousEff.price
            ? "up"
            : latestEff.price < previousEff.price
              ? "down"
              : "same";
      }
      bySupplier[supplier] = {
        price: latestEff.price,
        date: latest.observedDate.toISOString().slice(0, 10),
        trend,
        previousPrice: previousEff ? previousEff.price : null,
        normalizedFrom: latestEff.normalizedFrom,
      };
    }

    let cheaperSupplier: Supplier | null = null;
    const entries = Object.entries(bySupplier) as [Supplier, SupplierPricePoint][];
    if (entries.length >= 2) {
      cheaperSupplier = entries.reduce((a, b) => (a[1].price <= b[1].price ? a : b))[0];
    }

    return {
      productId: product.id,
      productName: product.name,
      packSize: product.packSize,
      bySupplier,
      cheaperSupplier,
    };
  });
}
