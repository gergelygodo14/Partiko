"use client";

import { useEffect, useState } from "react";

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  unitPrice: number;
  archived: boolean;
};

const emptyForm = { name: "", unit: "kg", unitPrice: "" };

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/ingredients?all=true");
    setIngredients(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createIngredient(e: React.FormEvent) {
    e.preventDefault();
    const unitPrice = parseInt(form.unitPrice, 10);
    if (!form.name.trim() || !form.unit.trim() || !unitPrice) return;

    await fetch("/api/ingredients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name.trim(), unit: form.unit.trim(), unitPrice }),
    });
    setForm(emptyForm);
    await load();
  }

  function startEdit(ing: Ingredient) {
    setEditingId(ing.id);
    setEditForm({ name: ing.name, unit: ing.unit, unitPrice: String(ing.unitPrice) });
  }

  async function saveEdit(id: string) {
    const unitPrice = parseInt(editForm.unitPrice, 10);
    await fetch(`/api/ingredients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name.trim(),
        unit: editForm.unit.trim(),
        unitPrice,
      }),
    });
    setEditingId(null);
    await load();
  }

  async function toggleArchive(ing: Ingredient) {
    if (ing.archived) {
      await fetch(`/api/ingredients/${ing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
    } else {
      await fetch(`/api/ingredients/${ing.id}`, { method: "DELETE" });
    }
    await load();
  }

  const visible = ingredients.filter((i) => showArchived || !i.archived);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-3">Új alapanyag</h2>
        <form onSubmit={createIngredient} className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Név</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
              placeholder="pl. Csirkeszárny"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Mértékegység</label>
            <input
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm w-24"
              placeholder="kg / db / l"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Egységár (Ft)</label>
            <input
              type="number"
              value={form.unitPrice}
              onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
              className="border border-neutral-300 rounded-md px-3 py-2 text-sm w-28"
              placeholder="1350"
            />
          </div>
          <button
            type="submit"
            className="bg-neutral-900 text-white text-sm px-4 py-2 rounded-md"
          >
            Hozzáadás
          </button>
        </form>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Alapanyagok</h2>
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
            {visible.map((ing) => (
              <li
                key={ing.id}
                className={`border border-neutral-200 bg-white rounded-lg p-3 ${
                  ing.archived ? "opacity-50" : ""
                }`}
              >
                {editingId === ing.id ? (
                  <div className="flex flex-wrap gap-2 items-end">
                    <input
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, name: e.target.value }))
                      }
                      className="border border-neutral-300 rounded-md px-2 py-1 text-sm"
                    />
                    <input
                      value={editForm.unit}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, unit: e.target.value }))
                      }
                      className="border border-neutral-300 rounded-md px-2 py-1 text-sm w-20"
                    />
                    <input
                      type="number"
                      value={editForm.unitPrice}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, unitPrice: e.target.value }))
                      }
                      className="border border-neutral-300 rounded-md px-2 py-1 text-sm w-24"
                    />
                    <button
                      onClick={() => saveEdit(ing.id)}
                      className="bg-neutral-900 text-white text-xs px-3 py-1.5 rounded-md"
                    >
                      Mentés
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs px-3 py-1.5 rounded-md border border-neutral-300"
                    >
                      Mégse
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{ing.name}</span>
                      <span className="text-xs text-neutral-500 ml-2">
                        {ing.unit} · {ing.unitPrice.toLocaleString("hu-HU")} Ft/
                        {ing.unit}
                        {ing.archived ? " · archiválva" : ""}
                      </span>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <button
                        onClick={() => startEdit(ing)}
                        className="px-3 py-1.5 rounded-md border border-neutral-300"
                      >
                        Szerkesztés
                      </button>
                      <button
                        onClick={() => toggleArchive(ing)}
                        className="px-3 py-1.5 rounded-md border border-neutral-300"
                      >
                        {ing.archived ? "Visszaállítás" : "Archiválás"}
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
