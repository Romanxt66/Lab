import { type Result } from "@/shared/kernel/result";

/**
 * Minimal shape of Anthropic's Messages API (only what the tool-use loop
 * needs) — kept here so the rest of the module never imports an SDK.
 */

export interface AnthropicTextBlock {
  type: "text";
  text: string;
}

export interface AnthropicToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AnthropicToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

export interface AnthropicToolDef {
  name: string;
  description: string;
  input_schema: object;
}

export interface AnthropicRequest {
  system: string;
  messages: AnthropicMessage[];
  tools: AnthropicToolDef[];
}

export interface AnthropicResponse {
  content: AnthropicContentBlock[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | string;
}

export interface AnthropicClientPort {
  send(req: AnthropicRequest): Promise<Result<AnthropicResponse>>;
}
