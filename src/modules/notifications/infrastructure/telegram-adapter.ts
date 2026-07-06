import "server-only";
import { type Result, ok, err } from "@/shared/kernel/result";
import type { NotificationSenderPort } from "@/modules/notifications/application/ports";
import type { NotificationProvider } from "@/modules/notifications/domain/config";

/**
 * Telegram Bot API adapter.
 *
 * Docs: https://core.telegram.org/bots/api#sendmessage
 *   POST https://api.telegram.org/bot<TOKEN>/sendMessage
 *   Body: { chat_id, text, parse_mode: "MarkdownV2" | "HTML" | undefined }
 */
export class TelegramAdapter implements NotificationSenderPort {
  async send(
    provider: NotificationProvider,
    recipient: string,
    credential: string,
    message: string,
  ): Promise<Result<void>> {
    if (provider !== "telegram") {
      return err(`Provider no soportado: ${provider}`);
    }

    const url = `https://api.telegram.org/bot${credential}/sendMessage`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: recipient,
          text: message,
          disable_web_page_preview: true,
        }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Telegram error payload: { ok:false, error_code, description }
        const description =
          (body && typeof body === "object" && "description" in body
            ? String((body as { description: unknown }).description)
            : "") || `HTTP ${res.status}`;

        if (/chat not found/i.test(description)) {
          return err(
            "Telegram: chat no encontrado. Envía primero un mensaje a tu bot para que pueda escribirte, y verifica el chat ID.",
          );
        }
        if (/unauthorized/i.test(description)) {
          return err(
            "Telegram: el bot token no es válido. Créalo con @BotFather y cópialo exacto.",
          );
        }
        return err(`Telegram rechazó el envío: ${description}`);
      }
      return ok(undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return err(`No se pudo contactar a Telegram: ${msg}`);
    }
  }
}
