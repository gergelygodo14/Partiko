"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

const navItems = [
  { href: "/", label: "Rögzítés", Icon: IconPencil },
  { href: "/alapanyagok", label: "Alapanyagok", Icon: IconList },
  { href: "/osszesites", label: "Összesítő", Icon: IconChart },
  { href: "/heti-menu", label: "Heti menü", Icon: IconCalendar },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-black pb-[env(safe-area-inset-bottom)]"
      aria-label="Fő navigáció"
    >
      <div className="max-w-3xl mx-auto grid grid-cols-4">
        {navItems.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-1 py-3 min-h-[64px] transition-colors ${
                active ? "text-yellow-400" : "text-neutral-400 active:text-yellow-300"
              }`}
            >
              <Icon />
              <span className="text-[11px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
