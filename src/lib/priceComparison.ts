import { prisma } from "@/lib/db";
import type { Supplier } from "@/generated/prisma/client";

export type SupplierPricePoint = {
  price: number;
  date: string;
  trend: "up" | "down" | "same" | null;
};

export type ProductPriceComparisonRow = {
  productId: string;
  productName: string;
  bySupplier: Partial<Record<Supplier, SupplierPricePoint>>;
  cheaperSupplier: Supplier | null;
};

export async function getPriceComparison(): Promise<ProductPriceComparisonRow[]> {
  const products = await prisma.product.findMany({
    where: { status: "CONFIRMED" },
    include: {
      priceObservations: { orderBy: { observedDate: "desc" } },
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
      let trend: SupplierPricePoint["trend"] = null;
      if (previous) {
        trend =
          latest.unitPrice > previous.unitPrice
            ? "up"
            : latest.unitPrice < previous.unitPrice
              ? "down"
              : "same";
      }
      bySupplier[supplier] = {
        price: latest.unitPrice,
        date: latest.observedDate.toISOString().slice(0, 10),
        trend,
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
      bySupplier,
      cheaperSupplier,
    };
  });
}
