import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalisePhone } from "./domain/config";
import { SendWhatsAppMessage } from "./application/send-message";
import { CallMeBotAdapter } from "./infrastructure/callmebot-adapter";
import type {
  WhatsAppConfigRepoPort,
  WhatsAppNotifierPort,
} from "./application/ports";
import type { WhatsAppConfig } from "./domain/config";
import { ok, err, type Result } from "@/shared/kernel/result";

describe("normalisePhone", () => {
  it("strips spaces, dashes and +", () => {
    const r = normalisePhone("+57 300-123 4567");
    expect(r.ok && r.value).toBe("573001234567");
  });
  it("rejects too short", () => {
    expect(normalisePhone("12").ok).toBe(false);
  });
  it("rejects too long", () => {
    expect(normalisePhone("1234567890123456").ok).toBe(false);
  });
});

// --- Fakes ---
const activeConfig: WhatsAppConfig = {
  id: "c1",
  provider: "callmebot",
  phone: "573001234567",
  apiKey: "1234567",
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

class FakeRepo implements WhatsAppConfigRepoPort {
  constructor(private config: WhatsAppConfig | null) {}
  async list() {
    return this.config ? [this.config] : [];
  }
  async getActive() {
    return this.config;
  }
  async upsert(): Promise<WhatsAppConfig> {
    throw new Error("nope");
  }
  async remove() {}
}

class FakeNotifier implements WhatsAppNotifierPort {
  calls: { phone: string; message: string }[] = [];
  constructor(private shouldFail = false) {}
  async send(_p: string, phone: string, _k: string, message: string): Promise<Result<void>> {
    if (this.shouldFail) return err("fail");
    this.calls.push({ phone, message });
    return ok(undefined);
  }
}

describe("SendWhatsAppMessage", () => {
  it("rejects when no active config", async () => {
    const r = await new SendWhatsAppMessage(
      new FakeNotifier(),
      new FakeRepo(null),
    ).execute("hola");
    expect(r.ok).toBe(false);
  });

  it("rejects empty message", async () => {
    const r = await new SendWhatsAppMessage(
      new FakeNotifier(),
      new FakeRepo(activeConfig),
    ).execute("   ");
    expect(r.ok).toBe(false);
  });

  it("delegates to notifier with active config", async () => {
    const notifier = new FakeNotifier();
    const r = await new SendWhatsAppMessage(
      notifier,
      new FakeRepo(activeConfig),
    ).execute("hola");
    expect(r.ok).toBe(true);
    expect(notifier.calls).toEqual([
      { phone: "573001234567", message: "hola" },
    ]);
  });
});

describe("CallMeBotAdapter", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("hits the CallMeBot endpoint with phone/text/apikey", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("Message queued", { status: 200 }));
    const r = await new CallMeBotAdapter().send(
      "callmebot",
      "573001234567",
      "1234567",
      "hola",
    );
    expect(r.ok).toBe(true);
    const url = new URL((spy.mock.calls[0]![0] as string));
    expect(url.origin + url.pathname).toBe(
      "https://api.callmebot.com/whatsapp.php",
    );
    expect(url.searchParams.get("phone")).toBe("573001234567");
    expect(url.searchParams.get("text")).toBe("hola");
    expect(url.searchParams.get("apikey")).toBe("1234567");
  });

  it("returns a specific error on invalid apikey", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("APIKey is invalid", { status: 200 }),
    );
    const r = await new CallMeBotAdapter().send(
      "callmebot",
      "573001234567",
      "bad",
      "hola",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/API key/i);
  });

  it("returns a specific error on non-activated phone", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("You need to activate this phone first", { status: 200 }),
    );
    const r = await new CallMeBotAdapter().send(
      "callmebot",
      "573001234567",
      "1234567",
      "hola",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/activado/i);
  });
});
