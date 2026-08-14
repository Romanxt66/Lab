import "server-only";
import { type Result, ok, err } from "@/shared/kernel/result";
import type { WebhookPort } from "@/modules/automations/application/ports";

const TIMEOUT_MS = 15_000;

/** WebhookPort over plain `fetch` — POSTs a JSON body, e.g. to an n8n webhook node. */
export class FetchWebhookAdapter implements WebhookPort {
  async post(url: string, body: Record<string, unknown>): Promise<Result<void>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) return err(`Webhook respondió HTTP ${res.status}`);
      return ok(undefined);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return err(`El webhook superó el tiempo límite (${TIMEOUT_MS / 1000}s).`);
      }
      return err(e instanceof Error ? e.message : "Error de red llamando al webhook.");
    } finally {
      clearTimeout(timer);
    }
  }
}
