import "server-only";
import { db } from "@/shared/db";
import type { CoolifyConfigRepoPort } from "@/modules/coolify/application/ports";
import type { CoolifyConfig } from "@/modules/coolify/domain/config";

type Row = {
  id: string;
  baseUrl: string;
  token: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: Row): CoolifyConfig {
  return { ...row };
}

/** Prisma-backed repo. Table: `lab_coolify_config`. One active row expected. */
export class PrismaCoolifyConfigRepo implements CoolifyConfigRepoPort {
  async getActive(): Promise<CoolifyConfig | null> {
    const row = await db.coolifyConfig.findFirst({
      where: { active: true },
      orderBy: { createdAt: "desc" },
    });
    return row ? toDomain(row) : null;
  }

  /** Reuse the row for a given baseUrl; deactivate any others. */
  async upsert(input: {
    baseUrl: string;
    token: string;
  }): Promise<CoolifyConfig> {
    const existing = await db.coolifyConfig.findFirst({
      where: { baseUrl: input.baseUrl },
    });
    const saved = existing
      ? await db.coolifyConfig.update({
          where: { id: existing.id },
          data: { token: input.token, active: true },
        })
      : await db.coolifyConfig.create({
          data: { baseUrl: input.baseUrl, token: input.token, active: true },
        });

    await db.coolifyConfig.updateMany({
      where: { id: { not: saved.id }, active: true },
      data: { active: false },
    });
    return toDomain(saved);
  }

  async remove(id: string): Promise<void> {
    await db.coolifyConfig.delete({ where: { id } });
  }
}
