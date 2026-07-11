"use client";

import { useEffect, useState } from "react";
import { normalizeProductName } from "@/lib/productMatching";

type Supplier = "SAJTFUTAR" | "BAROMFIUDVAR";

const SUPPLIER_LABEL: Record<Supplier, string> = {
  SAJTFUTAR: "Sajtfutár",
  BAROMFIUDVAR: "Baromfiudvar",
};

type Invoice = {
  id: string;
  supplier: Supplier;
  photoUrl: string;
  status: "UPLOADED" | "PROCESSING" | "PROCESSED" | "FAILED";
  uploadedAt: string;
  summaryText: string | null;
  errorMessage: string | null;
};

type Product = {
  id: string;
  name: string;
  unit: string | null;
  status: "PENDING" | "CONFIRMED";
};

type SupplierPricePoint = {
  price: number;
  date: string;
  trend: "up" | "down" | "same" | null;
};

type PriceComparisonRow = {
  productId: string;
  productName: string;
  bySupplier: Partial<Record<Supplier, SupplierPricePoint>>;
  cheaperSupplier: Supplier | null;
};

const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 0.8;

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", JPEG_QUALITY);
  });
}

function TrendIndicator({ trend }: { trend: SupplierPricePoint["trend"] }) {
  if (trend === "up") return <span className="text-red-600">▲</span>;
  if (trend === "down") return <span className="text-green-600">▼</span>;
  if (trend === "same") return <span className="text-neutral-400">–</span>;
  return null;
}

type ComparisonFilter = "changed" | "both" | "all";

const COMPARISON_FILTER_OPTIONS: { value: ComparisonFilter; label: string }[] = [
  { value: "changed", label: "Árváltozás" },
  { value: "both", label: "Mindkét beszállítónál" },
  { value: "all", label: "Összes" },
];

function hasBothSuppliers(row: PriceComparisonRow): boolean {
  return Object.keys(row.bySupplier).length >= 2;
}

function hasPriceChange(row: PriceComparisonRow): boolean {
  return Object.values(row.bySupplier).some(
    (point) => point?.trend === "up" || point?.trend === "down"
  );
}

export default function SzamlakPage() {
  const [supplier, setSupplier] = useState<Supplier>("BAROMFIUDVAR");
  const [comparisonFilter, setComparisonFilter] = useState<ComparisonFilter>("changed");
  const [uploading, setUploading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [comparison, setComparison] = useState<PriceComparisonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mergeTarget, setMergeTarget] = useState<Record<string, string>>({});
  const [mergeSearch, setMergeSearch] = useState<Record<string, string>>({});

  async function loadAll() {
    setLoading(true);
    const [invoicesRes, pendingRes, comparisonRes] = await Promise.all([
      fetch("/api/szamlak/invoices"),
      fetch("/api/szamlak/products?status=PENDING"),
      fetch("/api/szamlak/price-comparison"),
    ]);
    setInvoices(await invoicesRes.json());
    setPendingProducts(await pendingRes.json());
    setComparison(await comparisonRes.json());
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    const compressed = await compressImage(file);
    const formData = new FormData();
    formData.append("supplier", supplier);
    formData.append("photo", compressed, "invoice.jpg");
    await fetch("/api/szamlak/invoices", { method: "POST", body: formData });
    setUploading(false);
    await loadAll();
  }

  async function confirmProduct(id: string) {
    await fetch(`/api/szamlak/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONFIRMED" }),
    });
    await loadAll();
  }

  async function mergeProduct(id: string) {
    const intoProductId = mergeTarget[id];
    if (!intoProductId) return;
    await fetch(`/api/szamlak/products/${id}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intoProductId }),
    });
    await loadAll();
  }

  const confirmedProducts = comparison.map((row) => ({ id: row.productId, name: row.productName }));

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-3">Számla feltöltése</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Beszállító</label>
            <select
              value={supplier}
              onChange={(e) => setSupplier(e.target.value as Supplier)}
              className="border border-neutral-300 rounded-xl px-3 py-2.5 text-base"
            >
              <option value="BAROMFIUDVAR">Baromfiudvar</option>
              <option value="SAJTFUTAR">Sajtfutár</option>
            </select>
          </div>
          <label className="bg-yellow-400 text-black font-semibold text-base px-5 py-3 rounded-xl active:bg-yellow-500 cursor-pointer">
            {uploading ? "Feltöltés..." : "Számla feltöltése"}
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      </section>

      {pendingProducts.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Jóváhagyásra váró termékek</h2>
          <ul className="space-y-2">
            {pendingProducts.map((p) => {
              const search = (mergeSearch[p.id] ?? "").trim();
              const selected = confirmedProducts.find((cp) => cp.id === mergeTarget[p.id]);
              const matches = search
                ? confirmedProducts.filter((cp) =>
                    normalizeProductName(cp.name).includes(normalizeProductName(search))
                  )
                : [];

              return (
                <li
                  key={p.id}
                  className="border border-neutral-200 bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-semibold text-base">{p.name}</span>
                    <button
                      onClick={() => confirmProduct(p.id)}
                      className="px-4 py-2.5 rounded-xl bg-yellow-400 text-black font-semibold active:bg-yellow-500 self-start"
                    >
                      Új termékként jóváhagyás
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex flex-wrap gap-2 items-center">
                      <input
                        type="text"
                        value={mergeSearch[p.id] ?? ""}
                        onChange={(e) => {
                          setMergeSearch((m) => ({ ...m, [p.id]: e.target.value }));
                          setMergeTarget((m) => ({ ...m, [p.id]: "" }));
                        }}
                        placeholder="Termék keresése összevonáshoz..."
                        className="border border-neutral-300 rounded-xl px-3 py-2.5 flex-1 min-w-[180px]"
                      />
                      <button
                        onClick={() => mergeProduct(p.id)}
                        disabled={!mergeTarget[p.id]}
                        className="px-4 py-2.5 rounded-xl border border-neutral-300 active:bg-neutral-100 disabled:opacity-40"
                      >
                        Összevonás
                      </button>
                    </div>
                    {selected && (
                      <p className="text-xs text-neutral-500">Kiválasztva: {selected.name}</p>
                    )}
                    {search && !selected && (
                      <ul className="border border-neutral-200 rounded-xl divide-y divide-neutral-200 max-h-56 overflow-y-auto">
                        {matches.length === 0 ? (
                          <li className="px-3 py-2 text-neutral-400">Nincs találat</li>
                        ) : (
                          matches.slice(0, 20).map((cp) => (
                            <li key={cp.id}>
                              <button
                                onClick={() => {
                                  setMergeTarget((m) => ({ ...m, [p.id]: cp.id }));
                                  setMergeSearch((m) => ({ ...m, [p.id]: cp.name }));
                                }}
                                className="w-full text-left px-3 py-2 active:bg-neutral-100"
                              >
                                {cp.name}
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">Ár-összehasonlítás</h2>
        {loading ? (
          <p className="text-neutral-500">Betöltés...</p>
        ) : comparison.length === 0 ? (
          <p className="text-neutral-500">Még nincs jóváhagyott termék árelőzménye.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-3 text-sm">
              {COMPARISON_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setComparisonFilter(opt.value)}
                  className={
                    comparisonFilter === opt.value
                      ? "px-3 py-1.5 rounded-full bg-yellow-400 text-black font-semibold"
                      : "px-3 py-1.5 rounded-full border border-neutral-300 text-neutral-600 active:bg-neutral-100"
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {(() => {
              const filteredComparison = comparison.filter((row) => {
                if (comparisonFilter === "both") return hasBothSuppliers(row);
                if (comparisonFilter === "changed") return hasPriceChange(row);
                return true;
              });

              if (filteredComparison.length === 0) {
                return (
                  <p className="text-neutral-500">Nincs a szűrésnek megfelelő termék.</p>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left text-xs text-neutral-500">
                        <th className="py-2 pr-3">Termék</th>
                        <th className="py-2 pr-3">Sajtfutár</th>
                        <th className="py-2 pr-3">Baromfiudvar</th>
                        <th className="py-2 pr-3">Olcsóbb</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredComparison.map((row) => (
                        <tr key={row.productId} className="border-t border-neutral-200">
                          <td className="py-2 pr-3 font-medium">{row.productName}</td>
                          <td className="py-2 pr-3">
                            {row.bySupplier.SAJTFUTAR ? (
                              <>
                                {row.bySupplier.SAJTFUTAR.price.toLocaleString("hu-HU")} Ft{" "}
                                <TrendIndicator trend={row.bySupplier.SAJTFUTAR.trend} />
                              </>
                            ) : (
                              "–"
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            {row.bySupplier.BAROMFIUDVAR ? (
                              <>
                                {row.bySupplier.BAROMFIUDVAR.price.toLocaleString("hu-HU")} Ft{" "}
                                <TrendIndicator trend={row.bySupplier.BAROMFIUDVAR.trend} />
                              </>
                            ) : (
                              "–"
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            {row.cheaperSupplier ? SUPPLIER_LABEL[row.cheaperSupplier] : "–"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Feltöltött számlák</h2>
        {loading ? (
          <p className="text-neutral-500">Betöltés...</p>
        ) : invoices.length === 0 ? (
          <p className="text-neutral-500">Még nincs feltöltött számla.</p>
        ) : (
          <ul className="space-y-2">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="border border-neutral-200 bg-white rounded-2xl p-4 shadow-sm"
              >
                <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
                  <span>
                    {SUPPLIER_LABEL[inv.supplier]} ·{" "}
                    {new Date(inv.uploadedAt).toLocaleDateString("hu-HU")}
                  </span>
                  <span
                    className={
                      inv.status === "FAILED"
                        ? "text-red-600"
                        : inv.status === "PROCESSED"
                          ? "text-green-600"
                          : "text-neutral-500"
                    }
                  >
                    {inv.status === "PROCESSED"
                      ? "Feldolgozva"
                      : inv.status === "FAILED"
                        ? "Hiba"
                        : "Feldolgozás alatt"}
                  </span>
                </div>
                {inv.summaryText && (
                  <p className="text-sm whitespace-pre-line">{inv.summaryText}</p>
                )}
                {inv.errorMessage && (
                  <p className="text-sm text-red-600">{inv.errorMessage}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
