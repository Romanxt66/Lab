import { type Result, ok, err } from "@/shared/kernel/result";
import type {
  WhatsAppNotifierPort,
  WhatsAppConfigRepoPort,
} from "./ports";

/**
 * SendWhatsAppMessage use-case. Looks up the active config and delegates to
 * the notifier port. Depends on no framework, so it can be tested with fakes.
 */
export class SendWhatsAppMessage {
  constructor(
    private readonly notifier: WhatsAppNotifierPort,
    private readonly repo: WhatsAppConfigRepoPort,
  ) {}

  async execute(message: string): Promise<Result<void>> {
    if (!message.trim()) return err("El mensaje está vacío.");
    const config = await this.repo.getActive();
    if (!config) {
      return err(
        "No hay una configuración de WhatsApp activa. Configúrala primero.",
      );
    }
    if (!config.apiKey) {
      return err("La configuración no tiene una API key.");
    }
    return this.notifier.send(
      config.provider,
      config.phone,
      config.apiKey,
      message,
    );
  }
}
