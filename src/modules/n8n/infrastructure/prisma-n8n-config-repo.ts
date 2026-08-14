import "server-only";
import { db } from "@/shared/db";
import type { N8nConfigRepoPort } from "@/modules/n8n/application/ports";
import type { N8nConfig } from "@/modules/n8n/domain/config";

/** N8nConfigRepoPort backed by Prisma. Table: `lab_n8n_config`. One active row expected. */
export class PrismaN8nConfigRepo implements N8nConfigRepoPort {
  async getActive(): Promise<N8nConfig | null> {
    return db.n8nConfig.findFirst({ where: { active: true }, orderBy: { createdAt: "desc" } });
  }

  /** Reuse the row for a given baseUrl; deactivate any others. */
  async upsert(input: { baseUrl: string; apiKey: string }): Promise<N8nConfig> {
    const existing = await db.n8nConfig.findFirst({ where: { baseUrl: input.baseUrl } });
    const saved = existing
      ? await db.n8nConfig.update({
          where: { id: existing.id },
          data: { apiKey: input.apiKey, active: true },
        })
      : await db.n8nConfig.create({
          data: { baseUrl: input.baseUrl, apiKey: input.apiKey, active: true },
        });

    await db.n8nConfig.updateMany({
      where: { id: { not: saved.id }, active: true },
      data: { active: false },
    });
    return saved;
  }

  async remove(id: string): Promise<void> {
    await db.n8nConfig.delete({ where: { id } });
  }
}
