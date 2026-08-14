import "server-only";
import { type Result, ok, err } from "@/shared/kernel/result";
import { assertAnthropicConfigured } from "@/shared/env";
import type {
  AnthropicClientPort,
  AnthropicContentBlock,
  AnthropicRequest,
  AnthropicResponse,
} from "@/modules/assistant/application/ports";

const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS = 1024;
const TIMEOUT_MS = 30_000;

interface RawResponse {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
  error?: { message?: string };
}

/** AnthropicClientPort over the Messages API — plain fetch, no SDK dependency. */
export class AnthropicRestClient implements AnthropicClientPort {
  async send(req: AnthropicRequest): Promise<Result<AnthropicResponse>> {
    let cfg;
    try {
      cfg = assertAnthropicConfigured();
    } catch (e) {
      return err(e instanceof Error ? e.message : "Asistente no configurado.");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "x-api-key": cfg.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: MAX_TOKENS,
          system: req.system,
          messages: req.messages,
          tools: req.tools,
        }),
        signal: controller.signal,
      });

      const body = (await res.json().catch(() => ({}))) as RawResponse;
      if (!res.ok) {
        return err(body.error?.message ?? `La API de Anthropic respondió HTTP ${res.status}.`);
      }
      return ok({
        content: body.content ?? [],
        stopReason: body.stop_reason ?? "end_turn",
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return err("El asistente tardó demasiado en responder (30s).");
      }
      return err(e instanceof Error ? e.message : "Error de red hablando con el asistente.");
    } finally {
      clearTimeout(timer);
    }
  }
}
