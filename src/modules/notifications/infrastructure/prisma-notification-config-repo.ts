import "server-only";
import { db } from "@/shared/db";
import type { NotificationConfigRepoPort } from "@/modules/notifications/application/ports";
import type {
  NotificationConfig,
  NotificationProvider,
} from "@/modules/notifications/domain/config";

type Row = {
  id: string;
  provider: string;
  recipient: string;
  credential: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: Row): NotificationConfig {
  return { ...row, provider: row.provider as NotificationProvider };
}

/** Prisma-backed repo. Table: `lab_notification_config`. */
export class PrismaNotificationConfigRepo
  implements NotificationConfigRepoPort
{
  async list(): Promise<NotificationConfig[]> {
    const rows = await db.notificationConfig.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomain);
  }

  async getActive(): Promise<NotificationConfig | null> {
    const row = await db.notificationConfig.findFirst({
      where: { active: true },
      orderBy: { createdAt: "desc" },
    });
    return row ? toDomain(row) : null;
  }

  /**
   * At most one active row for a given (provider, recipient). When the caller
   * marks a row active, we deactivate the others.
   */
  async upsert(input: {
    provider: NotificationProvider;
    recipient: string;
    credential: string;
    active: boolean;
  }): Promise<NotificationConfig> {
    const existing = await db.notificationConfig.findFirst({
      where: { provider: input.provider, recipient: input.recipient },
    });
    const saved = existing
      ? await db.notificationConfig.update({
          where: { id: existing.id },
          data: {
            credential: input.credential,
            active: input.active,
          },
        })
      : await db.notificationConfig.create({ data: input });

    if (saved.active) {
      await db.notificationConfig.updateMany({
        where: { id: { not: saved.id }, active: true },
        data: { active: false },
      });
    }
    return toDomain(saved);
  }

  async remove(id: string): Promise<void> {
    await db.notificationConfig.delete({ where: { id } });
  }
}
