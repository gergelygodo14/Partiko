"use client";

import { usePathname, useRouter } from "next/navigation";

export default function LogoutButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/bejelentkezes") return null;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/bejelentkezes");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="justify-self-end text-xs text-neutral-400 active:text-neutral-200"
    >
      Kilépés
    </button>
  );
}
