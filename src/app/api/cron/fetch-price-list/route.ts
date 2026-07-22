import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { fetchPriceListEmails } from "@/lib/priceListEmailFetch";
import { parsePriceListBuffer } from "@/lib/priceListParsing";
import { buildPriceListNotificationText, ingestPriceList } from "@/lib/priceListIngestion";
import { sendTelegramMessage } from "@/lib/telegram";

export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export const GET = withApiErrorHandling(async (request: NextRequest) => {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const emails = await fetchPriceListEmails();
  const results = [];

  for (const email of emails) {
    const parsed = await parsePriceListBuffer(email.attachmentBuffer);
    const outcome = await ingestPriceList(email.emailMessageId, email.supplier, parsed);
    results.push({ supplier: email.supplier, emailMessageId: email.emailMessageId, ...outcome });

    if (outcome.status === "imported") {
      try {
        const text = buildPriceListNotificationText(email.supplier, outcome.productCount);
        const sent = await sendTelegramMessage(text);
        if (!sent.ok) {
          console.error("Telegram price-list notification failed:", sent.error);
        }
      } catch (e) {
        console.error("Telegram price-list notification failed:", e);
      }
    }
  }

  return NextResponse.json({ checked: emails.length, results });
});
