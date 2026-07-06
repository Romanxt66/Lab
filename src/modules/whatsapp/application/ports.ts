import type { Result } from "@/shared/kernel/result";
import type {
  WhatsAppConfig,
  WhatsAppProvider,
} from "@/modules/whatsapp/domain/config";

/** Sends a message to a phone via a specific provider. */
export interface WhatsAppNotifierPort {
  send(
    provider: WhatsAppProvider,
    phone: string,
    apiKey: string,
    message: string,
  ): Promise<Result<void>>;
}

/** Persistence of the WhatsApp configuration (typically one active row). */
export interface WhatsAppConfigRepoPort {
  list(): Promise<WhatsAppConfig[]>;
  getActive(): Promise<WhatsAppConfig | null>;
  upsert(input: {
    provider: WhatsAppProvider;
    phone: string;
    apiKey: string;
    active: boolean;
  }): Promise<WhatsAppConfig>;
  remove(id: string): Promise<void>;
}
