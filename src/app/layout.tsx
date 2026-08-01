import type { Metadata } from "next";
import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import UpdateNotifier from "@/components/UpdateNotifier";
import BottomNav from "@/components/BottomNav";
import LogoutButton from "@/components/LogoutButton";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

// Runs before hydration (blocking, in <head>) so the page never flashes the
// wrong theme: applies a saved choice immediately, or falls back to the OS
// preference on a first visit. ThemeToggle only ever mirrors/toggles
// whatever this already set - it never picks a theme itself.
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('partiko_theme');var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Partiko",
  description: "Alapanyag-nyilvántartó",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="hu"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-paper">
        <header className="bg-ink sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-2 grid grid-cols-[1fr_auto_1fr] items-center">
            <Image
              src="/logo-icon.png"
              alt=""
              width={2924}
              height={3540}
              priority
              className="h-9 w-auto justify-self-start"
            />
            <Image
              src="/logo-wordmark.png"
              alt="Partiko"
              width={3510}
              height={530}
              priority
              className="h-8 w-auto"
            />
            <div className="flex items-center gap-3 justify-self-end">
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 pb-28">
          {children}
        </main>
        <UpdateNotifier />
        <BottomNav />
      </body>
    </html>
  );
}
