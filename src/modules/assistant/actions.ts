"use server";

import { type Result } from "@/shared/kernel/result";
import { getAssistantService } from "@/shared/di/container";
import { getCurrentUser } from "@/modules/auth/current-user";
import type { ChatMessage, ChatReply } from "@/modules/assistant/domain/chat";

export async function sendAssistantMessageAction(
  history: ChatMessage[],
  message: string,
): Promise<Result<ChatReply>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  return getAssistantService(user.role).chat(history, message, {
    uid: user.uid,
    role: user.role,
  });
}
