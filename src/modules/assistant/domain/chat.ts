/**
 * Client-server chat contract: plain text turns only. The tool-use round
 * trips (Anthropic's tool_use/tool_result blocks) stay internal to the
 * server-side loop — the browser never sees them, only the final reply.
 */
export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatReply {
  reply: string;
  /** Names of tools the assistant used to answer, for a small trust cue in the UI. */
  toolsUsed: string[];
  /** Tool slug the client should navigate to, when the user asked to be taken somewhere. */
  navigateTo?: string;
}

const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;

/** Keep only the most recent turns and guard against absurdly long input. */
export function trimHistory(history: ChatMessage[]): ChatMessage[] {
  return history.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
    role: m.role,
    content: m.content.slice(0, MAX_MESSAGE_LENGTH),
  }));
}
