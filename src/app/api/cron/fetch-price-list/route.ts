import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling } from "@/lib/apiRoute";
import { fetchPriceListEmails } from "@/lib/priceListEmailFetch";
import { parsePriceListBuffer } from "@/lib/priceListParsing";
import { ingestPriceList } from "@/lib/priceListIngestion";

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
  }

  return NextResponse.json({ checked: emails.length, results });
});
