"use server";

import { type Result, ok, err } from "@/shared/kernel/result";
import {
  getSendNotification,
  getNotificationConfigRepo,
} from "@/shared/di/container";
import {
  isValidTelegramToken,
  normaliseChatId,
  toDTO,
  type NotificationConfigDTO,
} from "@/modules/notifications/domain/config";

export async function getActiveNotificationConfigAction(): Promise<NotificationConfigDTO | null> {
  const c = await getNotificationConfigRepo().getActive();
  return c ? toDTO(c) : null;
}

export async function saveTelegramConfigAction(input: {
  botToken: string;
  chatId: string;
}): Promise<Result<NotificationConfigDTO>> {
  const chatIdRes = normaliseChatId(input.chatId);
  if (!chatIdRes.ok) return chatIdRes;
  const token = input.botToken.trim();
  if (!isValidTelegramToken(token)) {
    return err(
      "El bot token no tiene el formato esperado (deberías ver algo como 123456:AABBCC...).",
    );
  }
  const saved = await getNotificationConfigRepo().upsert({
    provider: "telegram",
    recipient: chatIdRes.value,
    credential: token,
    active: true,
  });
  return ok(toDTO(saved));
}

export async function deleteNotificationConfigAction(id: string): Promise<void> {
  await getNotificationConfigRepo().remove(id);
}

export async function sendNotificationTestAction(): Promise<Result<void>> {
  return getSendNotification().execute(
    "✅ Prueba desde Lab.\nSi ves este mensaje, la integración con Telegram funciona.",
  );
}

/**
 * Helper: list the recent chats that have talked to the given bot token, so
 * the UI can auto-suggest the chat ID without the user hunting for it.
 * Uses Telegram's getUpdates. Not idempotent (Telegram clears updates after
 * they're read), but fine for one-shot detection.
 */
export async function detectTelegramChatIdsAction(
  botToken: string,
): Promise<
  Result<Array<{ id: string; title: string }>>
> {
  const token = botToken.trim();
  if (!isValidTelegramToken(token)) {
    return err("Introduce primero un bot token válido.");
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates`,
      { method: "GET" },
    );
    const data = (await res.json()) as {
      ok: boolean;
      result?: Array<{ message?: { chat?: { id?: number | string; title?: string; first_name?: string; username?: string } } }>;
      description?: string;
    };
    if (!res.ok || !data.ok) {
      return err(`Telegram: ${data.description ?? `HTTP ${res.status}`}`);
    }
    const map = new Map<string, string>();
    for (const upd of data.result ?? []) {
      const chat = upd.message?.chat;
      if (!chat?.id) continue;
      const id = String(chat.id);
      const title =
        chat.title ||
        [chat.first_name, chat.username && `@${chat.username}`]
          .filter(Boolean)
          .join(" ") ||
        `Chat ${id}`;
      map.set(id, title);
    }
    return ok(Array.from(map, ([id, title]) => ({ id, title })));
  } catch (e) {
    return err(e instanceof Error ? e.message : "Error contactando Telegram.");
  }
}
