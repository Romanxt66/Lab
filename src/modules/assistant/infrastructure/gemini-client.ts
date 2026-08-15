import "server-only";
import { type Result, ok, err } from "@/shared/kernel/result";
import { assertGeminiConfigured } from "@/shared/env";
import type {
  LlmClientPort,
  LlmContentBlock,
  LlmMessage,
  LlmRequest,
  LlmResponse,
} from "@/modules/assistant/application/ports";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_OUTPUT_TOKENS = 1024;
const TIMEOUT_MS = 30_000;

// -- Gemini's own wire shapes (camelCase, per ai.google.dev/api/generate-content) --

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; id?: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; id?: string; response: Record<string, unknown> };
  /** Gemini 3 thinking models require this to be echoed back verbatim. */
  thoughtSignature?: string;
}
interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}
interface GeminiResponseBody {
  candidates?: { content?: GeminiContent; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

function toGeminiRole(role: LlmMessage["role"]): "user" | "model" {
  return role === "assistant" ? "model" : "user";
}

function blockToPart(b: LlmContentBlock): GeminiPart {
  // A signature, when present, must sit as a sibling of the block it came
  // with — dropping it makes Gemini 3 reject the next tool-calling turn.
  if (b.type === "text") {
    return b.signature ? { text: b.text, thoughtSignature: b.signature } : { text: b.text };
  }
  if (b.type === "tool_use") {
    const part: GeminiPart = { functionCall: { name: b.name, id: b.id, args: b.input } };
    if (b.signature) part.thoughtSignature = b.signature;
    return part;
  }
  return { functionResponse: { name: b.name, id: b.tool_use_id, response: { content: b.content } } };
}

function toGeminiContents(messages: LlmMessage[]): GeminiContent[] {
  return messages.map((m) => ({
    role: toGeminiRole(m.role),
    parts: typeof m.content === "string" ? [{ text: m.content }] : m.content.map(blockToPart),
  }));
}

let syntheticId = 0;

function partToBlock(p: GeminiPart): LlmContentBlock | null {
  if (p.functionCall) {
    return {
      type: "tool_use",
      id: p.functionCall.id ?? `call_${syntheticId++}`,
      name: p.functionCall.name,
      input: p.functionCall.args ?? {},
      signature: p.thoughtSignature,
    };
  }
  if (typeof p.text === "string") {
    return { type: "text", text: p.text, signature: p.thoughtSignature };
  }
  return null;
}

/** 503 (overloaded) and 429 (rate limited) are transient on the free tier. */
const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 700;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Drop the internal retry flag so callers see a plain Result. */
function stripRetryable(r: Result<LlmResponse> & { retryable?: boolean }): Result<LlmResponse> {
  return r.ok ? r : err(r.error);
}

/** LlmClientPort over Gemini's generateContent REST endpoint — no SDK dependency. */
export class GeminiRestClient implements LlmClientPort {
  async send(req: LlmRequest): Promise<Result<LlmResponse>> {
    let cfg;
    try {
      cfg = assertGeminiConfigured();
    } catch (e) {
      return err(e instanceof Error ? e.message : "Asistente no configurado.");
    }

    let last: Result<LlmResponse> = err("El asistente no respondió.");
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const res = await this.attempt(req, cfg);
      if (res.ok || !res.retryable) return res.ok ? res : stripRetryable(res);
      last = stripRetryable(res);
      if (attempt < MAX_ATTEMPTS - 1) await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
    return last;
  }

  private async attempt(
    req: LlmRequest,
    cfg: { apiKey: string; model: string },
  ): Promise<Result<LlmResponse> & { retryable?: boolean }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${API_BASE}/${cfg.model}:generateContent`, {
        method: "POST",
        headers: {
          "x-goog-api-key": cfg.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: toGeminiContents(req.messages),
          tools:
            req.tools.length > 0
              ? [
                  {
                    functionDeclarations: req.tools.map((t) => ({
                      name: t.name,
                      description: t.description,
                      parameters: t.input_schema,
                    })),
                  },
                ]
              : undefined,
          generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
        }),
        signal: controller.signal,
      });

      const body = (await res.json().catch(() => ({}))) as GeminiResponseBody;
      if (!res.ok) {
        const retryable = RETRYABLE_STATUS.has(res.status);
        const message = retryable
          ? "El asistente está saturado ahora mismo. Inténtalo de nuevo en un momento."
          : (body.error?.message ?? `La API de Gemini respondió HTTP ${res.status}.`);
        return { ...err(message), retryable };
      }
      if (body.promptFeedback?.blockReason) {
        return err(`Gemini bloqueó la respuesta (${body.promptFeedback.blockReason}).`);
      }

      const candidate = body.candidates?.[0];
      const parts = candidate?.content?.parts ?? [];
      const content = parts.map(partToBlock).filter((b): b is LlmContentBlock => b !== null);
      const hasToolUse = content.some((b) => b.type === "tool_use");

      return ok({ content, stopReason: hasToolUse ? "tool_use" : "end_turn" });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return err("El asistente tardó demasiado en responder (30s).");
      }
      return {
        ...err(e instanceof Error ? e.message : "Error de red hablando con el asistente."),
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
