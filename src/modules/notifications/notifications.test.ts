import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidTelegramToken, normaliseChatId } from "./domain/config";
import { SendNotification } from "./application/send-notification";
import { TelegramAdapter } from "./infrastructure/telegram-adapter";
import type {
  NotificationConfigRepoPort,
  NotificationSenderPort,
} from "./application/ports";
import type { NotificationConfig } from "./domain/config";
import { ok, err, type Result } from "@/shared/kernel/result";

describe("isValidTelegramToken", () => {
  it("accepts a well-formed token", () => {
    expect(isValidTelegramToken("123456789:AABBCC-Ddefghij_klmnop_qrstuvwxyz")).toBe(true);
  });
  it("rejects garbage", () => {
    expect(isValidTelegramToken("nope")).toBe(false);
    expect(isValidTelegramToken("123:short")).toBe(false);
  });
});

describe("normaliseChatId", () => {
  it("accepts positive and negative integers", () => {
    expect(normaliseChatId("123").ok).toBe(true);
    expect(normaliseChatId("-100123").ok).toBe(true);
  });
  it("rejects non-integers", () => {
    expect(normaliseChatId("abc").ok).toBe(false);
    expect(normaliseChatId("12.3").ok).toBe(false);
  });
});

// --- Fakes ---
const activeConfig: NotificationConfig = {
  id: "c1",
  provider: "telegram",
  recipient: "123456",
  credential: "1234:AABBCC-Ddefghij_klmnop_qrstuvwxyz",
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

class FakeRepo implements NotificationConfigRepoPort {
  constructor(private config: NotificationConfig | null) {}
  async list() {
    return this.config ? [this.config] : [];
  }
  async getActive() {
    return this.config;
  }
  async upsert(): Promise<NotificationConfig> {
    throw new Error("nope");
  }
  async remove() {}
}

class FakeSender implements NotificationSenderPort {
  calls: { recipient: string; message: string }[] = [];
  constructor(private shouldFail = false) {}
  async send(_p: string, recipient: string, _c: string, message: string): Promise<Result<void>> {
    if (this.shouldFail) return err("fail");
    this.calls.push({ recipient, message });
    return ok(undefined);
  }
}

describe("SendNotification", () => {
  it("rejects when no active config", async () => {
    const r = await new SendNotification(
      new FakeSender(),
      new FakeRepo(null),
    ).execute("hola");
    expect(r.ok).toBe(false);
  });

  it("rejects empty message", async () => {
    const r = await new SendNotification(
      new FakeSender(),
      new FakeRepo(activeConfig),
    ).execute("   ");
    expect(r.ok).toBe(false);
  });

  it("delegates to sender with the active config", async () => {
    const sender = new FakeSender();
    const r = await new SendNotification(
      sender,
      new FakeRepo(activeConfig),
    ).execute("hola");
    expect(r.ok).toBe(true);
    expect(sender.calls).toEqual([{ recipient: "123456", message: "hola" }]);
  });
});

describe("TelegramAdapter", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("POSTs to Telegram sendMessage", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 }),
    );
    const r = await new TelegramAdapter().send(
      "telegram",
      "123",
      "999:AAA-Ddefghij_klmnop_qrstuvwxyz",
      "hola",
    );
    expect(r.ok).toBe(true);
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe(
      "https://api.telegram.org/bot999:AAA-Ddefghij_klmnop_qrstuvwxyz/sendMessage",
    );
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.chat_id).toBe("123");
    expect(body.text).toBe("hola");
  });

  it("returns a friendly error when chat is not found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          error_code: 400,
          description: "Bad Request: chat not found",
        }),
        { status: 400 },
      ),
    );
    const r = await new TelegramAdapter().send(
      "telegram",
      "999",
      "1:AAA-Ddefghij_klmnop_qrstuvwxyz",
      "hola",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/chat/i);
  });

  it("returns a friendly error on unauthorized token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          error_code: 401,
          description: "Unauthorized",
        }),
        { status: 401 },
      ),
    );
    const r = await new TelegramAdapter().send(
      "telegram",
      "1",
      "bad:AAA-Ddefghij_klmnop_qrstuvwxyz",
      "hola",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/token/i);
  });
});
