// Shared by invoiceProcessing.ts (photo OCR - holds a jump this large back
// for manual review, since the risk there is an AI misread) and
// priceListIngestion.ts (structured Baromfiudvar email price list - no
// misread risk, so a jump this large is saved as usual but now also
// triggers an immediate Telegram alert instead of waiting to be noticed on
// the /szamlak page - owner request, 2026-09-06).
export const LARGE_PRICE_CHANGE_THRESHOLD = 0.2;

export function isLargePriceChange(newPrice: number, priorPrice: number): boolean {
  if (priorPrice === 0) return false;
  return Math.abs(newPrice - priorPrice) / priorPrice >= LARGE_PRICE_CHANGE_THRESHOLD;
}
