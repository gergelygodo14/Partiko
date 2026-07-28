// How many portions of each raw-meat type go into one of a given sandwich -
// confirmed with the owner. Most items use 1 portion; Pötyi pogi (a "double"
// breaded-meat pogácsa) and the tortilla/panini items use 2.
const MEAT_MULTIPLIERS: Record<string, { rantottHus?: number; tortillaHus?: number; grillHus?: number }> = {
  "Rántott húsos vekni": { rantottHus: 1 },
  "Rántott húsos vekni (teljes kiőrlésű)": { rantottHus: 1 },
  "Rántott húsos papucs": { rantottHus: 1 },
  "Pötyi pogi (dupla rántott húsos pogácsa)": { rantottHus: 2 },
  "Csirkés tortilla": { tortillaHus: 2 },
  "Csirkés panini": { tortillaHus: 2 },
  "Grillezett csirkemell papucs": { grillHus: 1 },
  "Csirkemelles bigkifli": { grillHus: 1 },
  "Fetasajtos bigkifli": { grillHus: 1 },
};

// Grill hús isn't prepped as discrete portions like the other two meats - it's
// raw chicken breast weighed out per sandwich, confirmed with the owner as
// 4dkg per portion.
const GRILL_HUS_DKG_PER_PORTION = 4;

export type MeatPrepTotals = { rantottHusDb: number; tortillaHusDb: number; grillHusDkg: number };

// Kitchen-prep quantities ("how much raw meat to cook") derived from a
// period's per-item order totals - not a stored value, always recomputed
// from whatever period (week/month) is currently being viewed.
export function computeMeatPrep(byItem: { itemName: string; quantity: number }[]): MeatPrepTotals {
  let rantottHusDb = 0;
  let tortillaHusDb = 0;
  let grillHusPortions = 0;
  for (const item of byItem) {
    const multiplier = MEAT_MULTIPLIERS[item.itemName];
    if (!multiplier) continue;
    rantottHusDb += (multiplier.rantottHus ?? 0) * item.quantity;
    tortillaHusDb += (multiplier.tortillaHus ?? 0) * item.quantity;
    grillHusPortions += (multiplier.grillHus ?? 0) * item.quantity;
  }
  return { rantottHusDb, tortillaHusDb, grillHusDkg: grillHusPortions * GRILL_HUS_DKG_PER_PORTION };
}
