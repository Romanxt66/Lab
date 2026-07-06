import { type Result, ok, err } from "@/shared/kernel/result";
import type {
  NotificationSenderPort,
  NotificationConfigRepoPort,
} from "./ports";

/**
 * SendNotification use-case. Looks up the active config and delegates to the
 * sender port. Depends on nothing framework-specific — testable with fakes.
 */
export class SendNotification {
  constructor(
    private readonly sender: NotificationSenderPort,
    private readonly repo: NotificationConfigRepoPort,
  ) {}

  async execute(message: string): Promise<Result<void>> {
    if (!message.trim()) return err("El mensaje está vacío.");
    const config = await this.repo.getActive();
    if (!config) {
      return err(
        "No hay una configuración de notificaciones activa. Configúrala en Notificaciones.",
      );
    }
    if (!config.credential) return err("La configuración no tiene credencial.");
    if (!config.recipient) return err("La configuración no tiene destinatario.");
    return this.sender.send(
      config.provider,
      config.recipient,
      config.credential,
      message,
    );
  }
}

/** Trivially wraps SendNotification.execute so any caller can send verbatim. */
export function ok_(): Result<void> {
  return ok(undefined);
}
