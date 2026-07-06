import { type Result, ok, err } from "@/shared/kernel/result";

export type NotificationProvider = "telegram";
export const NOTIFICATION_PROVIDERS: NotificationProvider[] = ["telegram"];

export interface NotificationConfig {
  id: string;
  provider: NotificationProvider;
  /** Telegram: chat_id (may be negative for groups). */
  recipient: string;
  /** Telegram: bot_token (`123456:AABBCC...`). */
  credential: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Client-side projection: never send credentials to the browser. */
export interface NotificationConfigDTO {
  id: string;
  provider: NotificationProvider;
  recipient: string;
  active: boolean;
  hasCredential: boolean;
}

export function toDTO(c: NotificationConfig): NotificationConfigDTO {
  return {
    id: c.id,
    provider: c.provider,
    recipient: c.recipient,
    active: c.active,
    hasCredential: Boolean(c.credential),
  };
}

/** Validate a Telegram bot token shape: `<digits>:<letters/digits/_-…>` */
export function isValidTelegramToken(token: string): boolean {
  return /^\d+:[A-Za-z0-9_-]{20,}$/.test(token.trim());
}

/** Validate a Telegram chat id (integer, optionally negative). */
export function normaliseChatId(raw: string): Result<string> {
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    return err("El chat ID debe ser un número (puede ser negativo).");
  }
  return ok(trimmed);
}
