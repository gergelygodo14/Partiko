"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SandwichItem = {
  id: string;
  name: string;
  price: number;
  archived: boolean;
};

const emptyForm = { name: "", price: "" };

export default function SandwichItemsPage() {
  const [items, setItems] = useState<SandwichItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/sandwich-items?all=true");
    setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    const price = parseInt(form.price, 10);
    if (!form.name.trim() || !price) return;

    await fetch("/api/sandwich-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name.trim(), price }),
    });
    setForm(emptyForm);
    await load();
  }

  function startEdit(item: SandwichItem) {
    setEditingId(item.id);
    setEditForm({ name: item.name, price: String(item.price) });
  }

  async function saveEdit(id: string) {
    const price = parseInt(editForm.price, 10);
    await fetch(`/api/sandwich-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editForm.name.trim(), price }),
    });
    setEditingId(null);
    await load();
  }

  async function toggleArchive(item: SandwichItem) {
    if (item.archived) {
      await fetch(`/api/sandwich-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
    } else {
      await fetch(`/api/sandwich-items/${item.id}`, { method: "DELETE" });
    }
    await load();
  }

  const visible = items.filter((i) => showArchived || !i.archived);

  return (
    <div className="space-y-8">
      <Link href="/rendelesek" className="text-sm text-neutral-500 underline">
        ← Vissza a rendelésekhez
      </Link>

      <section>
        <h2 className="text-lg font-semibold mb-3">Új szendvics</h2>
        <form onSubmit={createItem} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Név</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="border border-neutral-300 rounded-xl px-3 py-2.5 text-base"
              placeholder="pl. Hamburger"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Ár (Ft)</label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="border border-neutral-300 rounded-xl px-3 py-2.5 text-base w-28"
              placeholder="700"
            />
          </div>
          <button
            type="submit"
            className="bg-yellow-400 text-black font-semibold text-base px-5 py-3 rounded-xl active:bg-yellow-500"
          >
            Hozzáadás
          </button>
        </form>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Szendvicsek</h2>
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Archiváltak is
          </label>
        </div>

        {loading ? (
          <p className="text-neutral-500">Betöltés...</p>
        ) : (
          <ul className="space-y-2">
            {visible.map((item) => (
              <li
                key={item.id}
                className={`border border-neutral-200 bg-white rounded-2xl p-4 shadow-sm ${
                  item.archived ? "opacity-50" : ""
                }`}
              >
                {editingId === item.id ? (
                  <div className="flex flex-wrap gap-2 items-end">
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className="border border-neutral-300 rounded-xl px-3 py-2 text-base"
                    />
                    <input
                      type="number"
                      value={editForm.price}
                      onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                      className="border border-neutral-300 rounded-xl px-3 py-2 text-base w-24"
                    />
                    <button
                      onClick={() => saveEdit(item.id)}
                      className="bg-yellow-400 text-black font-semibold text-sm px-4 py-2.5 rounded-xl active:bg-yellow-500"
                    >
                      Mentés
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-sm px-4 py-2.5 rounded-xl border border-neutral-300"
                    >
                      Mégse
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="font-semibold text-base">{item.name}</span>
                      <span className="text-xs text-neutral-500 ml-2">
                        {item.price.toLocaleString("hu-HU")} Ft
                        {item.archived ? " · archiválva" : ""}
                      </span>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <button
                        onClick={() => startEdit(item)}
                        className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-neutral-300 active:bg-neutral-100"
                      >
                        Szerkesztés
                      </button>
                      <button
                        onClick={() => toggleArchive(item)}
                        className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-neutral-300 active:bg-neutral-100"
                      >
                        {item.archived ? "Visszaállítás" : "Archiválás"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
