import "server-only";
import { db } from "@/shared/db";
import type { WhatsAppConfigRepoPort } from "@/modules/whatsapp/application/ports";
import type {
  WhatsAppConfig,
  WhatsAppProvider,
} from "@/modules/whatsapp/domain/config";

type Row = {
  id: string;
  provider: string;
  phone: string;
  apiKey: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: Row): WhatsAppConfig {
  return { ...row, provider: row.provider as WhatsAppProvider };
}

/** Prisma-backed repo. Table: `lab_whatsapp_config`. */
export class PrismaWhatsAppConfigRepo implements WhatsAppConfigRepoPort {
  async list(): Promise<WhatsAppConfig[]> {
    const rows = await db.whatsAppConfig.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomain);
  }

  async getActive(): Promise<WhatsAppConfig | null> {
    const row = await db.whatsAppConfig.findFirst({
      where: { active: true },
      orderBy: { createdAt: "desc" },
    });
    return row ? toDomain(row) : null;
  }

  /**
   * Simple policy for personal use: there's one active config at a time. If
   * the caller marks a config as active, we deactivate the others.
   */
  async upsert(input: {
    provider: WhatsAppProvider;
    phone: string;
    apiKey: string;
    active: boolean;
  }): Promise<WhatsAppConfig> {
    // Find an existing row for the same phone number to update in place; else
    // create a new one.
    const existing = await db.whatsAppConfig.findFirst({
      where: { phone: input.phone },
    });
    const saved = existing
      ? await db.whatsAppConfig.update({
          where: { id: existing.id },
          data: {
            provider: input.provider,
            apiKey: input.apiKey,
            active: input.active,
          },
        })
      : await db.whatsAppConfig.create({ data: input });

    if (saved.active) {
      await db.whatsAppConfig.updateMany({
        where: { id: { not: saved.id }, active: true },
        data: { active: false },
      });
    }
    return toDomain(saved);
  }

  async remove(id: string): Promise<void> {
    await db.whatsAppConfig.delete({ where: { id } });
  }
}
