// The reference sheet's own row labels (exact case, its internal shorthand)
// rather than the nicer full catalog name used everywhere else in the app -
// the owner asked for the kitchen printout specifically to read exactly like
// what they already hand-write, not the customer-facing product names.
//
// Lives in its own dependency-free module (rather than next to the .xlsx
// generator that first needed it) because the order-entry grid renders these
// same labels client-side: importing them from generateSandwichOrdersXlsx.ts
// would drag the whole exceljs package into the browser bundle.
export const EXCEL_LABEL_BY_ITEM_NAME: Record<string, string> = {
  "Sonkás bagel": "BAGEL",
  "Fasírtos-pfefferonis szendvics": "fasírtos-pfeff",
  "Grillezett csirkemell papucs": "grill papucs",
  "Hamburger": "hamburger",
  "Molnárka (kicsi) kolbászos": "molnárka,kolb",
  "Molnárka (kicsi) sonkás": "molnárka,sonkás",
  "Molnárka (kicsi) szalámis": "molnárka szalámis",
  "Csirkemelles bigkifli": "BIGKIFLI",
  "Fetasajtos bigkifli": "BIGKIFLI fetás",
  "Nagyi kifli": "nagyi",
  "Pleskavica": "pleskavica",
  "Dupla szalámis pogácsa": "pogácsa",
  "Rántott húsos vekni": "rántott húsos",
  "Rántott húsos vekni (teljes kiőrlésű)": "RHZS TK",
  "Sajtburger": "sajtburger",
  "Rántott húsos papucs": "RHZS PAPUCS",
  "Dupla sajtburger": "DUPLA SAJTBURG",
  "Mini burger": "miniburger",
  "Pötyi pogi (dupla rántott húsos pogácsa)": "PÖTYI",
  "Csirkés tortilla": "TORTILLA",
  "Extra szendvics": "EXTRA",
  "Mediterrán karajos vekni": "Karajos vekni",
  "Szegedi sonkás vekni": "Szegedi sonkás",
  "Piccante szalámis (olasz, csípős)": "PICCANTE",
  "Csirkés panini": "Csirkés panini",
  "Tépett húsos szendvics": "Tépett húsos",
};

/** The kitchen's shorthand for a catalog item, falling back to the full
 *  catalog name for items added since the reference sheet was written. */
export function excelLabelFor(itemName: string): string {
  return EXCEL_LABEL_BY_ITEM_NAME[itemName] ?? itemName;
}
