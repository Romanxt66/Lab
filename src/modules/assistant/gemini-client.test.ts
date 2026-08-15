import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GeminiRestClient } from "./infrastructure/gemini-client";
import type { LlmRequest } from "./application/ports";

/** `gemini-client.ts` imports "server-only", which throws outside a server build. */
vi.mock("server-only", () => ({}));
vi.mock("@/shared/env", () => ({
  assertGeminiConfigured: () => ({ apiKey: "test-key", model: "gemini-flash-latest" }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const baseRequest: LlmRequest = {
  system: "sys",
  messages: [{ role: "user", content: "hola" }],
  tools: [{ name: "t", description: "d", input_schema: { type: "object" } }],
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Advances fake timers so the retry backoff resolves without a real wait. */
async function runWithTimers<T>(p: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return p;
}

function bodyOf(call: number): Record<string, unknown> {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string) as Record<string, unknown>;
}

describe("GeminiRestClient thought signatures", () => {
  it("captures thoughtSignature from a functionCall part", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        candidates: [
          {
            content: {
              role: "model",
              parts: [
                {
                  functionCall: { name: "t", id: "c1", args: { a: 1 } },
                  thoughtSignature: "SIG_A",
                },
              ],
            },
          },
        ],
      }),
    );

    const res = await runWithTimers(new GeminiRestClient().send(baseRequest));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.content[0]).toEqual({
        type: "tool_use",
        id: "c1",
        name: "t",
        input: { a: 1 },
        signature: "SIG_A",
      });
    }
  });

  it("echoes the signature back on the next turn's functionCall part", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }));

    await runWithTimers(
      new GeminiRestClient().send({
        ...baseRequest,
        messages: [
          { role: "user", content: "hola" },
          {
            role: "assistant",
            content: [
              { type: "tool_use", id: "c1", name: "t", input: { a: 1 }, signature: "SIG_A" },
            ],
          },
          {
            role: "user",
            content: [{ type: "tool_result", tool_use_id: "c1", name: "t", content: "res" }],
          },
        ],
      }),
    );

    const contents = bodyOf(0).contents as { role: string; parts: Record<string, unknown>[] }[];
    const modelTurn = contents.find((c) => c.role === "model");
    expect(modelTurn?.parts[0].thoughtSignature).toBe("SIG_A");
    expect(modelTurn?.parts[0].functionCall).toEqual({ name: "t", id: "c1", args: { a: 1 } });
  });

  it("omits thoughtSignature entirely when the block has none", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }));

    await runWithTimers(
      new GeminiRestClient().send({
        ...baseRequest,
        messages: [
          { role: "assistant", content: [{ type: "tool_use", id: "c1", name: "t", input: {} }] },
        ],
      }),
    );

    const contents = bodyOf(0).contents as { parts: Record<string, unknown>[] }[];
    expect("thoughtSignature" in contents[0].parts[0]).toBe(false);
  });
});

describe("GeminiRestClient retries", () => {
  it("retries a 503 overload and succeeds on a later attempt", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { message: "overloaded" } }, 503))
      .mockResolvedValueOnce(jsonResponse({ candidates: [{ content: { parts: [{ text: "listo" }] } }] }));

    const res = await runWithTimers(new GeminiRestClient().send(baseRequest));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.content[0]).toEqual({ type: "text", text: "listo", signature: undefined });
  });

  it("gives up after the attempt cap with a friendly overload message", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: "overloaded" } }, 503));

    const res = await runWithTimers(new GeminiRestClient().send(baseRequest));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/saturado/i);
  });

  it("does not retry a non-transient error like a bad API key", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: "API key not valid" } }, 400));

    const res = await runWithTimers(new GeminiRestClient().send(baseRequest));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("API key not valid");
  });

  it("never leaks the internal retryable flag to callers", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: "overloaded" } }, 503));
    const res = await runWithTimers(new GeminiRestClient().send(baseRequest));
    expect("retryable" in res).toBe(false);
  });
});
