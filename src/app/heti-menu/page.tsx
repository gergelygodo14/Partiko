"use client";

import { useCallback, useEffect, useState } from "react";
import Loading from "@/components/Loading";
import { addDaysStr, mondayOf, todayStr } from "@/lib/dates";
import { DAY_NAMES, emptyWeek, type MenuDay } from "@/lib/weeklyMenu";

type DishLetter = "a" | "b" | "c";
type Slot = { day: number; letter: DishLetter };

// How long the letter badge must be held before a drag arms - long enough
// that a normal tap or a scroll-starting touch doesn't accidentally pick up
// a dish, short enough to still feel responsive.
const LONG_PRESS_MS = 450;
// If the finger moves more than this before the long-press timer fires,
// treat it as a scroll attempt and cancel arming the drag.
const MOVE_CANCEL_PX = 10;

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hu-HU", {
    month: "2-digit",
    day: "2-digit",
  });
}

function slotsEqual(a: Slot | null, b: Slot | null): boolean {
  return !!a && !!b && a.day === b.day && a.letter === b.letter;
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
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestionPicker, setSuggestionPicker] = useState<{
    day: number;
    letter: DishLetter;
    options: string[];
  } | null>(null);
  const [dragSource, setDragSource] = useState<Slot | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<Slot | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

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

  // Exchanges both the dish text and its GM flag between two slots - a
  // "move" reads as swapping whatever already sits in the target spot back
  // into the source, rather than overwriting/losing it.
  function swapDishes(source: Slot, target: Slot) {
    if (slotsEqual(source, target)) return;
    setDays((prev) => {
      const next = prev.map((d) => ({ ...d }));
      const sourceGmKey = `${source.letter}GM` as const;
      const targetGmKey = `${target.letter}GM` as const;
      const sourceText = prev[source.day][source.letter];
      const sourceGm = prev[source.day][sourceGmKey];
      const targetText = prev[target.day][target.letter];
      const targetGm = prev[target.day][targetGmKey];

      if (source.day === target.day) {
        const merged = { ...next[source.day] };
        (merged as MenuDay)[source.letter] = targetText;
        (merged as MenuDay)[sourceGmKey] = targetGm;
        (merged as MenuDay)[target.letter] = sourceText;
        (merged as MenuDay)[targetGmKey] = sourceGm;
        next[source.day] = merged;
      } else {
        next[source.day] = { ...next[source.day], [source.letter]: targetText, [sourceGmKey]: targetGm };
        next[target.day] = { ...next[target.day], [target.letter]: sourceText, [targetGmKey]: sourceGm };
      }
      return next;
    });
  }

  // Long-press-to-drag for swapping two dishes on mobile: holding the
  // letter badge for LONG_PRESS_MS arms the drag, then whichever day/letter
  // row the finger is over on release becomes the swap target. Uses plain
  // pointer events (no library) since this is a small, well-defined
  // "swap two slots" gesture, not a general sortable list.
  function handleLetterPointerDown(e: React.PointerEvent, day: number, letter: DishLetter) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const source: Slot = { day, letter };
    let armed = false;

    const timer = setTimeout(() => {
      armed = true;
      setDragSource(source);
      setDragPos({ x: startX, y: startY });
    }, LONG_PRESS_MS);

    function findSlot(x: number, y: number): Slot | null {
      const el = document.elementFromPoint(x, y);
      const slotEl = el instanceof Element ? el.closest<HTMLElement>("[data-slot-day]") : null;
      if (!slotEl?.dataset.slotDay || !slotEl.dataset.slotLetter) return null;
      return {
        day: Number(slotEl.dataset.slotDay),
        letter: slotEl.dataset.slotLetter as DishLetter,
      };
    }

    function onMove(ev: PointerEvent) {
      if (!armed) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > MOVE_CANCEL_PX) {
          clearTimeout(timer);
          cleanup();
        }
        return;
      }
      ev.preventDefault();
      setDragPos({ x: ev.clientX, y: ev.clientY });
      setDragOverSlot(findSlot(ev.clientX, ev.clientY));
    }

    function onUp(ev: PointerEvent) {
      clearTimeout(timer);
      if (armed) {
        const target = findSlot(ev.clientX, ev.clientY);
        if (target) swapDishes(source, target);
        setDragSource(null);
        setDragOverSlot(null);
        setDragPos(null);
      }
      cleanup();
    }

    function cleanup() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  async function suggestDish(dayIndex: number, letter: "a" | "b" | "c") {
    const key = `${dayIndex}-${letter}`;
    setSuggestingKey(key);
    setSuggestError(null);
    try {
      const avoidDishes = days.flatMap((d) => [d.a, d.b, d.c]);
      const otherLetters = (["a", "b", "c"] as const).filter((l) => l !== letter);
      const sameDayDishes = otherLetters.map((l) => days[dayIndex][l]);
      // Every other already-decided dish across the whole week (not just the
      // same day) - lets the model avoid thematic/word repetition (e.g.
      // "Székelygulyás" one day, "Székelykáposzta" a couple days later),
      // which exact-name exclusion alone can't catch since the names differ.
      const weekDishes = avoidDishes.filter((d) => d.trim() !== "");
      const res = await fetch("/api/weekly-menu/suggest-dish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, avoidDishes, sameDayDishes, weekDishes }),
      });
      // Previously read straight off `data.dishes` with no `res.ok`/parse-
      // failure handling - any server error (rate limit, timeout, bad AI
      // response) or a non-JSON body (e.g. a platform timeout page) meant
      // this just silently did nothing, which is exactly what got reported
      // as "I click the button and nothing happens" (2026-08-13). Now every
      // failure surfaces as a visible message instead of vanishing.
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(
          (data && typeof data.error === "string" && data.error) || `Hiba történt (${res.status})`
        );
      }
      if (Array.isArray(data.dishes) && data.dishes.length > 0) {
        setSuggestionPicker({ day: dayIndex, letter, options: data.dishes });
      } else {
        throw new Error("Az AI nem adott vissza javaslatot");
      }
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : "Hiba történt az AI javaslat lekérésekor");
    } finally {
      setSuggestingKey(null);
    }
  }

  function chooseSuggestion(dish: string) {
    if (suggestionPicker) {
      updateDay(suggestionPicker.day, { [suggestionPicker.letter]: dish } as Partial<MenuDay>);
    }
    setSuggestionPicker(null);
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
      {dragSource && dragPos && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-1/2 bg-ink text-white text-sm font-semibold px-3 py-2 rounded-xl shadow-lg max-w-[70vw] truncate"
          style={{ left: dragPos.x, top: dragPos.y }}
        >
          {dragSource.letter.toUpperCase()}. {days[dragSource.day][dragSource.letter] || "(üres)"}
        </div>
      )}

      {suggestionPicker && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4"
          onClick={() => setSuggestionPicker(null)}
        >
          <div
            className="w-full sm:max-w-sm bg-surface rounded-2xl border border-surface-border shadow-lg p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-semibold text-sm text-muted">
              {DAY_NAMES[suggestionPicker.day]} · {suggestionPicker.letter.toUpperCase()}. — válassz egyet
            </div>
            <div className="space-y-2">
              {suggestionPicker.options.map((dish, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => chooseSuggestion(dish)}
                  className="w-full text-left border border-strong rounded-xl px-3.5 py-2.5 active:bg-surface-alt"
                >
                  {dish}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSuggestionPicker(null)}
              className="w-full text-sm text-muted px-3 py-2"
            >
              Mégse
            </button>
          </div>
        </div>
      )}

      {suggestError && (
        <div className="flex items-start justify-between gap-3 border border-red-300 dark:border-red-800/60 bg-red-50 dark:bg-red-950/40 rounded-xl px-3.5 py-2.5 text-sm text-red-700 dark:text-red-400">
          <span>Az AI javaslat nem sikerült: {suggestError}</span>
          <button
            type="button"
            onClick={() => setSuggestError(null)}
            className="shrink-0 font-semibold"
            aria-label="Bezárás"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setWeekStart(addDaysStr(weekStart, -7))}
          className="px-4 py-3 rounded-xl border bg-umber/8 border-umber/40 active:bg-umber/15"
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
              className="text-xs text-muted underline"
            >
              Ugrás a jelenlegi hétre
            </button>
          )}
        </div>
        <button
          onClick={() => setWeekStart(addDaysStr(weekStart, 7))}
          className="px-4 py-3 rounded-xl border bg-umber/8 border-umber/40 active:bg-umber/15"
          aria-label="Következő hét"
        >
          →
        </button>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          {DAY_NAMES.map((name, i) => (
            <div
              key={name}
              className="border border-surface-border bg-surface rounded-2xl p-4 shadow-sm space-y-3"
            >
              <div className="font-semibold">
                {name} <span className="text-faint font-normal text-sm">({formatDate(addDaysStr(weekStart, i))})</span>
              </div>
              {(["a", "b", "c"] as const).map((letter) => (
                <div
                  key={letter}
                  data-slot-day={i}
                  data-slot-letter={letter}
                  className={`flex items-center gap-2 rounded-xl transition-colors ${
                    slotsEqual(dragOverSlot, { day: i, letter }) && !slotsEqual(dragSource, { day: i, letter })
                      ? "bg-gold/15 ring-2 ring-gold"
                      : ""
                  }`}
                >
                  <span
                    onPointerDown={(e) => handleLetterPointerDown(e, i, letter)}
                    style={{ touchAction: "none" }}
                    className={`font-semibold w-5 shrink-0 cursor-grab select-none rounded ${
                      slotsEqual(dragSource, { day: i, letter }) ? "bg-gold text-ink" : ""
                    }`}
                  >
                    {letter.toUpperCase()}.
                  </span>
                  <input
                    type="text"
                    value={days[i][letter]}
                    onChange={(e) => updateDay(i, { [letter]: e.target.value } as Partial<MenuDay>)}
                    placeholder="étel neve"
                    className="flex-1 border border-strong rounded-xl px-3 py-2.5 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => suggestDish(i, letter)}
                    disabled={suggestingKey === `${i}-${letter}`}
                    title="AI ötlet erre a fogásra"
                    className="shrink-0 px-2.5 py-2.5 rounded-xl border bg-umber/8 border-umber/40 text-xs font-semibold active:bg-umber/15 disabled:opacity-50"
                  >
                    {suggestingKey === `${i}-${letter}` ? "…" : "AI"}
                  </button>
                  <label className="flex items-center gap-1.5 text-sm text-muted shrink-0">
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

      <div className="border border-surface-border bg-surface rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm">
          {published ? (
            <span className="text-green-700 dark:text-green-400 font-semibold">
              Közzétéve ✓{" "}
              {publishedAt && (
                <span className="text-faint font-normal">
                  ({new Date(publishedAt).toLocaleString("hu-HU")})
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted">Még nincs közzétéve az ügyfeleknek</span>
          )}
        </div>
        <button
          onClick={() => setPublishState(!published)}
          disabled={publishing || loading}
          className={`px-5 py-3 rounded-xl font-semibold text-base disabled:opacity-50 ${
            published
              ? "border bg-umber/8 border-umber/40 active:bg-umber/15"
              : "bg-gold text-ink active:bg-gold-dark"
          }`}
        >
          {published ? "Visszavonás" : "Közzététel"}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={save}
          disabled={saving || loading}
          className="flex-1 border bg-umber/8 border-umber/40 font-semibold text-base px-5 py-3 rounded-xl active:bg-umber/15 disabled:opacity-50"
        >
          {savedMessage ? "Elmentve ✓" : "Mentés"}
        </button>
        <button
          onClick={saveAndDownload}
          disabled={saving || loading}
          className="flex-1 bg-gold text-ink font-semibold text-base px-5 py-3 rounded-xl active:bg-gold-dark disabled:opacity-50"
        >
          Letöltés (.docx)
        </button>
      </div>
    </div>
  );
}
