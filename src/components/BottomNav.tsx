"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function IconPencil() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="w-6 h-6">
      <path
        d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconList() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="w-6 h-6">
      <path
        d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="w-6 h-6">
      <path
        d="M4 20V10M12 20V4M20 20v-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="w-6 h-6">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

function IconCart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="w-6 h-6">
      <path
        d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="20.5" r="1.5" fill="currentColor" />
      <circle cx="17.5" cy="20.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconReceipt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="w-6 h-6">
      <path
        d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5V3Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 8h6M9 12h6M9 16h3" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

function IconTrendUp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" className="w-6 h-6">
      <path
        d="M3 16l6-6 4 4 8-9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15 5h6v6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
      <circle cx="5" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}

// Kept fixed on mobile, per the owner's request - the rest live behind "Több".
const primaryItems = [
  { href: "/", label: "Rögzítés", Icon: IconPencil },
  { href: "/heti-menu", label: "Heti menü", Icon: IconCalendar },
  { href: "/rendelesek", label: "Rendelések", Icon: IconCart },
  { href: "/riportok", label: "Riportok", Icon: IconTrendUp },
];

const moreItems = [
  { href: "/alapanyagok", label: "Alapanyagok", Icon: IconList },
  { href: "/osszesites", label: "Összesítő", Icon: IconChart },
  { href: "/szamlak", label: "Számlák", Icon: IconReceipt },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export default function BottomNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  if (pathname === "/bejelentkezes") return null;

  const moreActive = moreItems.some((item) => isActive(pathname, item.href));

  return (
    <nav
      ref={navRef}
      className="fixed bottom-0 left-0 right-0 z-40 bg-ink pb-[env(safe-area-inset-bottom)]"
      aria-label="Fő navigáció"
    >
      <div className="relative max-w-3xl mx-auto">
        {menuOpen && (
          <div className="absolute bottom-full right-0 mb-2 rounded-2xl bg-ink border border-white/10 shadow-lg overflow-hidden min-w-[180px]">
            {moreItems.map(({ href, label, Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                    active ? "text-gold" : "text-neutral-300 active:text-gold"
                  }`}
                >
                  <Icon />
                  {label}
                </Link>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-5">
          {primaryItems.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-1 py-3 min-h-[64px] transition-colors ${
                  active ? "text-gold" : "text-neutral-400 active:text-gold"
                }`}
              >
                <Icon />
                <span className="text-[11px] font-medium leading-none">{label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            className={`flex flex-col items-center justify-center gap-1 py-3 min-h-[64px] transition-colors ${
              moreActive || menuOpen ? "text-gold" : "text-neutral-400 active:text-gold"
            }`}
          >
            <IconMore />
            <span className="text-[11px] font-medium leading-none">Több</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
