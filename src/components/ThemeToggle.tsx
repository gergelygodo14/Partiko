"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "partiko_theme";
type Theme = "light" | "dark";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="w-5 h-5">
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" />
      <path
        d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="w-5 h-5">
      <path
        d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z"
        stroke="currentColor"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Reads the theme the inline head script (layout.tsx) already applied to
// <html> before hydration - never decides a theme itself, just mirrors and
// toggles it, so there's no flash/mismatch between what's on screen and
// what this button shows.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Világos mód bekapcsolása" : "Sötét mód bekapcsolása"}
      className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-neutral-300 active:text-gold active:bg-white/10"
    >
      {/* Invisible until the real theme is known client-side, but still
          occupies its slot so the header layout doesn't shift on mount. */}
      <span className={theme === null ? "invisible" : ""}>
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  );
}
