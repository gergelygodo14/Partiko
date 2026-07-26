"use client";

import { useState } from "react";
import ReadyMealOrdersTab from "./ReadyMealOrdersTab";
import SandwichOrdersTab from "./SandwichOrdersTab";

type Feature = "keszetel" | "szendvics";

export default function OrdersPage() {
  // Defaults to "keszetel" so the first paint stays pixel-identical to the
  // page's behavior before this split - nothing changes for the ready-meal
  // side unless the owner explicitly taps the other button.
  const [feature, setFeature] = useState<Feature>("keszetel");

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          onClick={() => setFeature("keszetel")}
          className={`flex-1 px-4 py-4 rounded-2xl font-semibold text-base ${
            feature === "keszetel"
              ? "bg-yellow-400 text-black"
              : "border border-neutral-300 active:bg-neutral-100"
          }`}
        >
          Készétel rendelések
        </button>
        <button
          onClick={() => setFeature("szendvics")}
          className={`flex-1 px-4 py-4 rounded-2xl font-semibold text-base ${
            feature === "szendvics"
              ? "bg-yellow-400 text-black"
              : "border border-neutral-300 active:bg-neutral-100"
          }`}
        >
          Szendvics rendelések
        </button>
      </div>

      {feature === "keszetel" ? <ReadyMealOrdersTab /> : <SandwichOrdersTab />}
    </div>
  );
}
