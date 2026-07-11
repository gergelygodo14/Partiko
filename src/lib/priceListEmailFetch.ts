import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { Supplier } from "@/generated/prisma/client";

export type FetchedPriceListEmail = {
  emailMessageId: string;
  supplier: Supplier;
  attachmentBuffer: Buffer;
  receivedDate: Date;
};

const SENDER_BY_SUPPLIER: Partial<Record<Supplier, string>> = {
  BAROMFIUDVAR: "arkozlo@baromfiudvar.hu",
};

const LOOKBACK_DAYS = 10;

export async function fetchPriceListEmails(): Promise<FetchedPriceListEmail[]> {
  const user = process.env.GMAIL_IMAP_USER;
  const pass = process.env.GMAIL_IMAP_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("Hiányzó GMAIL_IMAP_USER / GMAIL_IMAP_APP_PASSWORD környezeti változó");
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const results: FetchedPriceListEmail[] = [];
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      for (const [supplier, from] of Object.entries(SENDER_BY_SUPPLIER) as [Supplier, string][]) {
        const uids = await client.search({ from, since }, { uid: true });
        if (!uids || uids.length === 0) continue;

        for await (const message of client.fetch(uids, { source: true }, { uid: true })) {
          if (!message.source) continue;
          const parsed = await simpleParser(message.source);
          if (!parsed.messageId) continue;

          const xlsxAttachment = parsed.attachments.find((a) =>
            a.filename?.toLowerCase().endsWith(".xlsx")
          );
          if (!xlsxAttachment) continue;

          results.push({
            emailMessageId: parsed.messageId,
            supplier,
            attachmentBuffer: xlsxAttachment.content,
            receivedDate: parsed.date ?? new Date(),
          });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return results;
}
