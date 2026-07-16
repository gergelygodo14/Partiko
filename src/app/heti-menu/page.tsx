"use client";

import { useCallback, useEffect, useState } from "react";
import { addDaysStr, mondayOf, todayStr } from "@/lib/dates";
import { DAY_NAMES, emptyWeek, type MenuDay } from "@/lib/weeklyMenu";

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hu-HU", {
    month: "2-digit",
    day: "2-digit",
  });
}

export default function WeeklyMenuPage() {
  const [weekStart, setWeekStart] = useState(mondayOf(todayStr()));
  const [days, setDays] = useState<MenuDay[]>(emptyWeek());
  const [published, setPublished] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);
  const [suggestingKey, setSuggestingKey] = useState<string | null>(null);

  const load = useCallback(async (week: string) => {
    setLoading(true);
    const res = await fetch(`/api/weekly-menu?week=${week}`);
    const data = await res.json();
    setDays(data.days);
    setPublished(data.published);
    setPublishedAt(data.publishedAt);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(weekStart);
  }, [weekStart, load]);

  function updateDay(dayIndex: number, patch: Partial<MenuDay>) {
    setDays((prev) =>
      prev.map((d, i) => (i === dayIndex ? { ...d, ...patch } : d))
    );
  }

  async function suggestDish(dayIndex: number, letter: "a" | "b" | "c") {
    const key = `${dayIndex}-${letter}`;
    setSuggestingKey(key);
    try {
      const avoidDishes = days.flatMap((d) => [d.a, d.b, d.c]);
      const otherLetters = (["a", "b", "c"] as const).filter((l) => l !== letter);
      const sameDayDishes = otherLetters.map((l) => days[dayIndex][l]);
      const res = await fetch("/api/weekly-menu/suggest-dish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, avoidDishes, sameDayDishes }),
      });
      const data = await res.json();
      if (typeof data.dish === "string") {
        updateDay(dayIndex, { [letter]: data.dish } as Partial<MenuDay>);
      }
    } finally {
      setSuggestingKey(null);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/weekly-menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, days }),
      });
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function saveAndDownload() {
    setSaving(true);
    try {
      await fetch("/api/weekly-menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, days }),
      });
      window.location.href = `/api/weekly-menu/generate?week=${weekStart}`;
    } finally {
      setSaving(false);
    }
  }

  async function setPublishState(next: boolean) {
    setPublishing(true);
    try {
      if (next) {
        // Save current edits first so publishing can't expose stale content.
        await fetch("/api/weekly-menu", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekStart, days }),
        });
      }
      const res = await fetch("/api/weekly-menu/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, published: next }),
      });
      const data = await res.json();
      setPublished(data.published);
      setPublishedAt(data.publishedAt);
    } finally {
      setPublishing(false);
    }
  }

  const weekEnd = addDaysStr(weekStart, 4);
  const isCurrentWeek = weekStart === mondayOf(todayStr());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setWeekStart(addDaysStr(weekStart, -7))}
          className="px-4 py-3 rounded-xl border border-neutral-300 active:bg-neutral-100"
          aria-label="Előző hét"
        >
          ←
        </button>
        <div className="text-center">
          <div className="font-semibold">
            {formatDate(weekStart)} – {formatDate(weekEnd)}
          </div>
          {!isCurrentWeek && (
            <button
              onClick={() => setWeekStart(mondayOf(todayStr()))}
              className="text-xs text-neutral-500 underline"
            >
              Ugrás a jelenlegi hétre
            </button>
          )}
        </div>
        <button
          onClick={() => setWeekStart(addDaysStr(weekStart, 7))}
          className="px-4 py-3 rounded-xl border border-neutral-300 active:bg-neutral-100"
          aria-label="Következő hét"
        >
          →
        </button>
      </div>

      {loading ? (
        <p className="text-neutral-500">Betöltés...</p>
      ) : (
        <div className="space-y-4">
          {DAY_NAMES.map((name, i) => (
            <div
              key={name}
              className="border border-neutral-200 bg-white rounded-2xl p-4 shadow-sm space-y-3"
            >
              <div className="font-semibold">
                {name} <span className="text-neutral-400 font-normal text-sm">({formatDate(addDaysStr(weekStart, i))})</span>
              </div>
              {(["a", "b", "c"] as const).map((letter) => (
                <div key={letter} className="flex items-center gap-2">
                  <span className="font-semibold w-5 shrink-0">
                    {letter.toUpperCase()}.
                  </span>
                  <input
                    type="text"
                    value={days[i][letter]}
                    onChange={(e) => updateDay(i, { [letter]: e.target.value } as Partial<MenuDay>)}
                    placeholder="étel neve"
                    className="flex-1 border border-neutral-300 rounded-xl px-3 py-2.5 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => suggestDish(i, letter)}
                    disabled={suggestingKey === `${i}-${letter}`}
                    title="AI ötlet erre a fogásra"
                    className="shrink-0 px-2.5 py-2.5 rounded-xl border border-neutral-300 text-xs font-semibold active:bg-neutral-100 disabled:opacity-50"
                  >
                    {suggestingKey === `${i}-${letter}` ? "…" : "AI"}
                  </button>
                  <label className="flex items-center gap-1.5 text-sm text-neutral-600 shrink-0">
                    <input
                      type="checkbox"
                      checked={days[i][`${letter}GM` as `${typeof letter}GM`]}
                      onChange={(e) =>
                        updateDay(i, {
                          [`${letter}GM`]: e.target.checked,
                        } as Partial<MenuDay>)
                      }
                    />
                    GM
                  </label>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="border border-neutral-200 bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm">
          {published ? (
            <span className="text-green-700 font-semibold">
              Közzétéve ✓{" "}
              {publishedAt && (
                <span className="text-neutral-400 font-normal">
                  ({new Date(publishedAt).toLocaleString("hu-HU")})
                </span>
              )}
            </span>
          ) : (
            <span className="text-neutral-500">Még nincs közzétéve az ügyfeleknek</span>
          )}
        </div>
        <button
          onClick={() => setPublishState(!published)}
          disabled={publishing || loading}
          className={`px-5 py-3 rounded-xl font-semibold text-base disabled:opacity-50 ${
            published
              ? "border border-neutral-300 active:bg-neutral-100"
              : "bg-yellow-400 text-black active:bg-yellow-500"
          }`}
        >
          {published ? "Visszavonás" : "Közzététel"}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={save}
          disabled={saving || loading}
          className="flex-1 border border-neutral-300 font-semibold text-base px-5 py-3 rounded-xl active:bg-neutral-100 disabled:opacity-50"
        >
          {savedMessage ? "Elmentve ✓" : "Mentés"}
        </button>
        <button
          onClick={saveAndDownload}
          disabled={saving || loading}
          className="flex-1 bg-yellow-400 text-black font-semibold text-base px-5 py-3 rounded-xl active:bg-yellow-500 disabled:opacity-50"
        >
          Letöltés (.docx)
        </button>
      </div>
    </div>
  );
}
