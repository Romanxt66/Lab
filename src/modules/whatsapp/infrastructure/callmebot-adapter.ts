import "server-only";
import { type Result, ok, err } from "@/shared/kernel/result";
import type { WhatsAppNotifierPort } from "@/modules/whatsapp/application/ports";
import type { WhatsAppProvider } from "@/modules/whatsapp/domain/config";

/**
 * CallMeBot adapter.
 *
 * CallMeBot is a free relay: the user activates their phone once by sending
 * `I allow callmebot to send me messages` from WhatsApp, receives a 6–8 digit
 * apikey, and can then send messages by hitting a simple GET endpoint.
 *
 * Docs: https://www.callmebot.com/blog/free-api-whatsapp-messages/
 */
export class CallMeBotAdapter implements WhatsAppNotifierPort {
  async send(
    provider: WhatsAppProvider,
    phone: string,
    apiKey: string,
    message: string,
  ): Promise<Result<void>> {
    if (provider !== "callmebot") {
      return err(`Provider no soportado: ${provider}`);
    }

    const url = new URL("https://api.callmebot.com/whatsapp.php");
    url.searchParams.set("phone", phone);
    url.searchParams.set("text", message);
    url.searchParams.set("apikey", apiKey);

    try {
      const res = await fetch(url.toString(), { method: "GET" });
      const body = await res.text().catch(() => "");
      // CallMeBot returns 200 with an HTML body describing status. "Message
      // queued" / "Message sent" indicate success; other bodies mean an error.
      if (!res.ok) {
        return err(`CallMeBot HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      if (/APIKey is invalid/i.test(body)) {
        return err("La API key de CallMeBot no es válida.");
      }
      if (/You need to activate/i.test(body)) {
        return err(
          "El número no está activado en CallMeBot. Sigue las instrucciones para activarlo primero.",
        );
      }
      if (/Message queued|Message Sent|APIKey/i.test(body) === false) {
        // Unknown body, but 200 — treat as success and log the body.
        console.warn("[callmebot] unexpected 200 body:", body.slice(0, 200));
      }
      return ok(undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return err(`No se pudo contactar a CallMeBot: ${msg}`);
    }
  }
}
