import type { Result } from "@/shared/kernel/result";
import type {
  NotificationConfig,
  NotificationProvider,
} from "@/modules/notifications/domain/config";

/** Sends a message via a specific provider. */
export interface NotificationSenderPort {
  send(
    provider: NotificationProvider,
    recipient: string,
    credential: string,
    message: string,
  ): Promise<Result<void>>;
}

export interface NotificationConfigRepoPort {
  list(): Promise<NotificationConfig[]>;
  getActive(): Promise<NotificationConfig | null>;
  upsert(input: {
    provider: NotificationProvider;
    recipient: string;
    credential: string;
    active: boolean;
  }): Promise<NotificationConfig>;
  remove(id: string): Promise<void>;
}
