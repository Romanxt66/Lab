import { type Result } from "@/shared/kernel/result";

/**
 * Minimal, provider-neutral shape for a tool-use chat turn — modelled after
 * Anthropic's Messages API blocks (the first provider this module used), but
 * generic enough that any LLM adapter (Gemini, etc.) can translate to/from
 * it without leaking its own wire format into the rest of the module.
 */

export interface LlmTextBlock {
  type: "text";
  text: string;
}

export interface LlmToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LlmToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  /** Some providers (Gemini) match tool results by name rather than id. */
  name: string;
  content: string;
}

export type LlmContentBlock = LlmTextBlock | LlmToolUseBlock | LlmToolResultBlock;

export interface LlmMessage {
  role: "user" | "assistant";
  content: string | LlmContentBlock[];
}

export interface LlmToolDef {
  name: string;
  description: string;
  input_schema: object;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  tools: LlmToolDef[];
}

export interface LlmResponse {
  content: LlmContentBlock[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | string;
}

export interface LlmClientPort {
  send(req: LlmRequest): Promise<Result<LlmResponse>>;
}
