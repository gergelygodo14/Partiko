import type { Metadata } from "next";
import Image from "next/image";
import { Geist, Geist_Mono, Pacifico } from "next/font/google";
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

const pacifico = Pacifico({
  variable: "--font-pacifico",
  weight: "400",
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
      className={`${geistSans.variable} ${geistMono.variable} ${pacifico.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-50">
        <header className="bg-black sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-2 grid grid-cols-[1fr_auto_1fr] items-center">
            <Image
              src="/logo-penguin-yellow.png"
              alt=""
              width={661}
              height={680}
              priority
              className="h-9 w-auto justify-self-start"
            />
            <span
              className="text-yellow-400 text-3xl leading-none"
              style={{ fontFamily: "var(--font-pacifico)" }}
            >
              Partiko
            </span>
            <div aria-hidden="true" />
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
