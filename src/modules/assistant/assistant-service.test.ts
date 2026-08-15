import { describe, it, expect } from "vitest";
import { ok, err, type Result } from "@/shared/kernel/result";
import { AssistantService } from "./application/assistant-service";
import type { LlmClientPort, LlmRequest, LlmResponse } from "./application/ports";
import type { AssistantTool, ToolContext } from "./application/tools";

class ScriptedClient implements LlmClientPort {
  calls: LlmRequest[] = [];
  private i = 0;
  constructor(private readonly responses: Result<LlmResponse>[]) {}
  async send(req: LlmRequest): Promise<Result<LlmResponse>> {
    this.calls.push(req);
    const res = this.responses[this.i];
    this.i++;
    return res;
  }
}

function textResponse(text: string): Result<LlmResponse> {
  return ok({ content: [{ type: "text", text }], stopReason: "end_turn" });
}

function toolUseResponse(name: string, id: string, input: Record<string, unknown> = {}): Result<LlmResponse> {
  return ok({ content: [{ type: "tool_use", id, name, input }], stopReason: "tool_use" });
}

const echoTool: AssistantTool = {
  name: "echo",
  description: "echoes input",
  inputSchema: { type: "object" },
  execute: async (input) => `echoed:${JSON.stringify(input)}`,
};

const throwingTool: AssistantTool = {
  name: "boom",
  description: "always throws",
  inputSchema: { type: "object" },
  execute: async () => {
    throw new Error("kaboom");
  },
};

const ctx: Omit<ToolContext, "effects"> = { uid: "u1", role: "user" };

describe("AssistantService.chat", () => {
  it("returns the model's text reply directly when no tool is used", async () => {
    const client = new ScriptedClient([textResponse("Hola, ¿en qué ayudo?")]);
    const svc = new AssistantService(client, [echoTool]);
    const res = await svc.chat([], "hola", ctx);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.reply).toBe("Hola, ¿en qué ayudo?");
      expect(res.value.toolsUsed).toEqual([]);
    }
  });

  it("executes a requested tool and feeds the result back", async () => {
    const client = new ScriptedClient([
      toolUseResponse("echo", "t1", { a: 1 }),
      textResponse("Listo."),
    ]);
    const svc = new AssistantService(client, [echoTool]);
    const res = await svc.chat([], "usa echo", ctx);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.reply).toBe("Listo.");
      expect(res.value.toolsUsed).toEqual(["echo"]);
    }
    // Second call must include the tool_result for the first tool_use.
    const secondReq = client.calls[1];
    const lastMsg = secondReq.messages.at(-1);
    expect(lastMsg?.role).toBe("user");
    expect(lastMsg?.content).toEqual([
      { type: "tool_result", tool_use_id: "t1", name: "echo", content: 'echoed:{"a":1}' },
    ]);
  });

  it("reports an unknown tool name back to the model instead of crashing", async () => {
    const client = new ScriptedClient([
      toolUseResponse("does_not_exist", "t1"),
      textResponse("No pude."),
    ]);
    const svc = new AssistantService(client, [echoTool]);
    const res = await svc.chat([], "hola", ctx);
    expect(res.ok).toBe(true);
    const lastMsg = client.calls[1].messages.at(-1);
    expect(lastMsg?.content).toEqual([
      {
        type: "tool_result",
        tool_use_id: "t1",
        name: "does_not_exist",
        content: "Herramienta desconocida: does_not_exist",
      },
    ]);
  });

  it("turns a throwing tool into an error tool_result instead of failing the chat", async () => {
    const client = new ScriptedClient([toolUseResponse("boom", "t1"), textResponse("ok")]);
    const svc = new AssistantService(client, [throwingTool]);
    const res = await svc.chat([], "hola", ctx);
    expect(res.ok).toBe(true);
    const lastMsg = client.calls[1].messages.at(-1);
    expect(lastMsg?.content).toEqual([
      { type: "tool_result", tool_use_id: "t1", name: "boom", content: "Error interno: kaboom" },
    ]);
  });

  it("stops after the round cap instead of looping forever", async () => {
    const responses = Array.from({ length: 10 }, () => toolUseResponse("echo", "t1"));
    const client = new ScriptedClient(responses);
    const svc = new AssistantService(client, [echoTool]);
    const res = await svc.chat([], "hola", ctx);
    expect(res.ok).toBe(false);
    expect(client.calls.length).toBe(6);
  });

  it("propagates a client-level error immediately", async () => {
    const client = new ScriptedClient([err("Asistente no configurado.")]);
    const svc = new AssistantService(client, [echoTool]);
    const res = await svc.chat([], "hola", ctx);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("Asistente no configurado.");
  });

  it("rejects an empty message without calling the client", async () => {
    const client = new ScriptedClient([]);
    const svc = new AssistantService(client, [echoTool]);
    const res = await svc.chat([], "   ", ctx);
    expect(res.ok).toBe(false);
    expect(client.calls).toHaveLength(0);
  });
});
