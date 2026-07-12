"use client";

import { useEffect, useState } from "react";

const CHECK_INTERVAL_MS = 60_000;

export default function UpdateNotifier() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const currentBuildId = process.env.NEXT_PUBLIC_BUILD_ID;
    if (!currentBuildId || currentBuildId === "dev") return;

    async function checkVersion() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const data = await res.json();
        if (data.buildId && data.buildId !== currentBuildId) {
          setUpdateAvailable(true);
        }
      } catch {
        // hálózati hiba esetén csendben kihagyjuk, a következő körben újra próbálja
      }
    }

    const interval = setInterval(checkVersion, CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkVersion();
    });
    checkVersion();

    return () => clearInterval(interval);
  }, []);

  if (!updateAvailable) return null;

  return (
    <button
      onClick={() => window.location.reload()}
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white text-sm px-4 py-3 rounded-full shadow-lg border-4 border-yellow-400 flex items-center gap-2"
    >
      Új verzió érhető el – kattints a frissítéshez
    </button>
  );
}
