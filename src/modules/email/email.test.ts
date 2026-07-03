import { describe, it, expect } from "vitest";
import { ok, err, type Result } from "@/shared/kernel/result";
import { SendEmail } from "./application/send-email";
import type {
  MailSenderPort,
  EmailLogPort,
} from "./application/ports";
import type { EmailMessage } from "./domain/email";
import { extractVariables, renderTemplate } from "./domain/template";
import { parseRecipients } from "./domain/email";

// --- In-memory fakes (no SMTP, no DB) — the point of hexagonal architecture ---

class FakeSender implements MailSenderPort {
  sent: EmailMessage[] = [];
  constructor(private failFor: Set<string> = new Set()) {}
  async send(msg: EmailMessage): Promise<Result<void>> {
    if (msg.to.some((t) => this.failFor.has(t))) return err("rechazado");
    this.sent.push(msg);
    return ok(undefined);
  }
}

class FakeLog implements EmailLogPort {
  entries: { to: string; status: string }[] = [];
  async record(e: { to: string; status: "sent" | "failed" }) {
    this.entries.push({ to: e.to, status: e.status });
  }
}

describe("template domain", () => {
  it("extracts unique variables", () => {
    expect(extractVariables("Hola {{a}} y {{b}}, {{a}}")).toEqual(["a", "b"]);
  });
  it("renders and leaves missing vars empty", () => {
    expect(renderTemplate("Hola {{n}}!", { n: "Ana" })).toBe("Hola Ana!");
    expect(renderTemplate("Hola {{n}}!", {})).toBe("Hola !");
  });
});

describe("parseRecipients", () => {
  it("splits and validates, deduping", () => {
    const r = parseRecipients("a@x.com, a@x.com; malo\nb@y.com");
    expect(r.valid).toEqual(["a@x.com", "b@y.com"]);
    expect(r.invalid).toEqual(["malo"]);
  });
});

describe("SendEmail use-case", () => {
  it("renders variables and sends one message per recipient", async () => {
    const sender = new FakeSender();
    const log = new FakeLog();
    const res = await new SendEmail(sender, log).execute({
      to: ["a@x.com", "b@y.com"],
      subject: "Hola {{n}}",
      body: "Cuerpo {{n}}",
      variables: { n: "Ana" },
    });
    expect(res.ok && res.value.sent).toBe(2);
    expect(sender.sent[0].subject).toBe("Hola Ana");
    expect(sender.sent).toHaveLength(2);
    expect(log.entries.filter((e) => e.status === "sent")).toHaveLength(2);
  });

  it("reports partial failures but still succeeds if some sent", async () => {
    const sender = new FakeSender(new Set(["bad@x.com"]));
    const res = await new SendEmail(sender).execute({
      to: ["ok@x.com", "bad@x.com"],
      subject: "s",
      body: "b",
    });
    expect(res.ok && res.value).toEqual({ sent: 1, failed: 1 });
  });

  it("fails validation before sending when subject is empty", async () => {
    const sender = new FakeSender();
    const res = await new SendEmail(sender).execute({
      to: ["a@x.com"],
      subject: "   ",
      body: "b",
    });
    expect(res.ok).toBe(false);
    expect(sender.sent).toHaveLength(0);
  });
});
