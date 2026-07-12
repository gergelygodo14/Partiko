const TELEGRAM_API_BASE = "https://api.telegram.org";

export type TelegramSendResult = { ok: true } | { ok: false; error: string };

// Never throws - a Telegram outage or missing config must not break whatever
// triggered the notification (e.g. an incoming customer order).
export async function sendTelegramMessage(text: string): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID nincs beállítva" };
  }

  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Telegram API ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ismeretlen hiba" };
  }
}
