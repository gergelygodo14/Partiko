"use client";

import { useState } from "react";

/** Tap the number to type it directly, instead of pressing "+" thirty times.
 *
 *  Ported from the customer ordering app (partiko-szendvics), which is a
 *  separate Next.js project with no shared package - copying is the intended
 *  way to reuse it.
 *
 *  Uses type="text" + inputMode="numeric" rather than type="number": the repo
 *  hit real problems with number inputs and Hungarian locale separators, and a
 *  text input also avoids the scroll-wheel-changes-the-value trap on desktop. */
export default function EditableQty({
  value,
  onCommit,
  ariaLabel,
  className = "",
  placeholder = "",
}: {
  value: number;
  onCommit: (value: number) => void;
  ariaLabel: string;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function commit() {
    const digits = draft.replace(/\D/g, "");
    onCommit(digits === "" ? 0 : Math.max(0, parseInt(digits, 10)));
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        type="text"
        inputMode="numeric"
        autoFocus
        aria-label={ariaLabel}
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setEditing(false);
        }}
        className={`${className} border border-yellow-400 rounded-md outline-none bg-white`}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => {
        setDraft(value > 0 ? String(value) : "");
        setEditing(true);
      }}
      className={className}
    >
      {value > 0 ? value : <span className="text-neutral-300">{placeholder}</span>}
    </button>
  );
}
