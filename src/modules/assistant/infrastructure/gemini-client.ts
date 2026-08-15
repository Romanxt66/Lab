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
  if (b.type === "text") return { text: b.text };
  if (b.type === "tool_use") return { functionCall: { name: b.name, id: b.id, args: b.input } };
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
    };
  }
  if (typeof p.text === "string") return { type: "text", text: p.text };
  return null;
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
        return err(body.error?.message ?? `La API de Gemini respondió HTTP ${res.status}.`);
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
      return err(e instanceof Error ? e.message : "Error de red hablando con el asistente.");
    } finally {
      clearTimeout(timer);
    }
  }
}
