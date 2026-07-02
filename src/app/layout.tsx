import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import UpdateNotifier from "@/components/UpdateNotifier";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

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
      <body className="min-h-full flex flex-col bg-neutral-50">
        <header className="bg-black sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <span className="font-bold text-xl tracking-tight text-yellow-400">
              Partiko
            </span>
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
