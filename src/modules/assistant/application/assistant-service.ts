import { type Result, ok, err } from "@/shared/kernel/result";
import { trimHistory, type ChatMessage, type ChatReply } from "@/modules/assistant/domain/chat";
import type {
  LlmClientPort,
  LlmContentBlock,
  LlmMessage,
  LlmToolUseBlock,
} from "./ports";
import type { AssistantTool, ToolContext, ToolEffects } from "./tools";

const MAX_TOOL_ROUNDS = 6;

const SYSTEM_PROMPT = `Eres el asistente integrado de "Lab", un panel personal de herramientas y automatizaciones (finanzas, calendario, inventario, monitoreo de uptime, usuarios, automatizaciones). Respondes en español, de forma breve y directa.

Usa las herramientas disponibles para responder con datos reales en vez de inventar cifras. Si necesitas un id (de cuenta, categoría, aplicación, conexión, etc.) que no tienes, primero llama a la herramienta de listado correspondiente.

Cuando el usuario pida ver, abrir o ir a una sección del Lab, usa navigate_to_module para llevarlo allí, y confírmalo en una frase corta.

Antes de ejecutar una acción que modifique datos (crear, aprobar, rechazar, activar/desactivar algo), confirma en tu respuesta anterior qué vas a hacer exactamente, a menos que el usuario ya haya sido explícito e inequívoco. Después de ejecutar una acción, confirma claramente qué se hizo.

Si una herramienta devuelve un error de autorización, explícaselo al usuario sin rodeos — no lo intentes de otra forma.`;

function isToolUse(b: LlmContentBlock): b is LlmToolUseBlock {
  return b.type === "tool_use";
}

function textOf(content: LlmContentBlock[]): string {
  return content
    .filter((b): b is Extract<LlmContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/**
 * Runs the LLM tool-use loop: send the conversation, execute any tool_use
 * blocks the model asks for via the tool registry, feed the results back,
 * repeat until the model returns plain text (or the round cap is hit, as a
 * hard stop against a runaway loop). Provider-agnostic — whatever adapter is
 * injected as `client` does the wire-format translation.
 */
export class AssistantService {
  constructor(
    private readonly client: LlmClientPort,
    private readonly tools: AssistantTool[],
  ) {}

  async chat(
    history: ChatMessage[],
    userMessage: string,
    session: Omit<ToolContext, "effects">,
  ): Promise<Result<ChatReply>> {
    const trimmed = trimHistory(history);
    if (!userMessage.trim()) return err("Escribe un mensaje.");

    // Tools requesting a client-side effect (e.g. navigation) write here.
    const effects: ToolEffects = {};
    const ctx: ToolContext = { ...session, effects };

    const messages: LlmMessage[] = [
      ...trimmed.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userMessage.trim() },
    ];

    const toolDefs = this.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));

    const toolsUsed: string[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const res = await this.client.send({
        system: SYSTEM_PROMPT,
        messages,
        tools: toolDefs,
      });
      if (!res.ok) return res;

      const { content, stopReason } = res.value;
      if (stopReason !== "tool_use") {
        return ok({
          reply: textOf(content) || "(sin respuesta)",
          toolsUsed,
          navigateTo: effects.navigateTo,
        });
      }

      messages.push({ role: "assistant", content });

      const toolUses = content.filter(isToolUse);
      const results = await Promise.all(
        toolUses.map(async (block) => {
          const tool = this.tools.find((t) => t.name === block.name);
          const text = tool
            ? await tool.execute(block.input, ctx).catch(
                (e) => `Error interno: ${e instanceof Error ? e.message : String(e)}`,
              )
            : `Herramienta desconocida: ${block.name}`;
          if (tool) toolsUsed.push(tool.name);
          return { id: block.id, name: block.name, text };
        }),
      );

      messages.push({
        role: "user",
        content: results.map((r) => ({
          type: "tool_result" as const,
          tool_use_id: r.id,
          name: r.name,
          content: r.text,
        })),
      });
    }

    return err("El asistente encadenó demasiadas herramientas sin responder. Intenta de nuevo.");
  }
}
