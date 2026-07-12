import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTelegramMessage } from "@/lib/telegram";

describe("sendTelegramMessage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("skips the network call and reports not-configured when env vars are missing", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await sendTelegramMessage("hello");

    expect(result.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to the Telegram Bot API with the configured token and chat id", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "12345");
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await sendTelegramMessage("Új rendelés érkezett");

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-token/sendMessage",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body).toEqual({ chat_id: "12345", text: "Új rendelés érkezett" });
  });

  it("reports failure when the Telegram API responds with a non-OK status", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "12345");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => "chat not found" })
    );

    const result = await sendTelegramMessage("hello");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("chat not found");
  });

  it("reports failure instead of throwing when fetch itself rejects", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "12345");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await sendTelegramMessage("hello");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("network down");
  });
});
