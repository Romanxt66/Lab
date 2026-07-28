import "server-only";
import { db } from "@/shared/db";
import type { GitHubConfigRepoPort } from "@/modules/github/application/ports";
import type { GitHubConfig } from "@/modules/github/domain/config";

type Row = {
  id: string;
  username: string;
  token: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: Row): GitHubConfig {
  return { ...row };
}

/** Prisma-backed repo. Table: `lab_github_config`. */
export class PrismaGitHubConfigRepo implements GitHubConfigRepoPort {
  async getActive(): Promise<GitHubConfig | null> {
    const row = await db.gitHubConfig.findFirst({
      where: { active: true },
      orderBy: { createdAt: "desc" },
    });
    return row ? toDomain(row) : null;
  }

  /**
   * A single active connection. We reuse the row for a given username (so
   * re-saving updates the token instead of piling up rows), then deactivate
   * any other rows.
   */
  async upsert(input: {
    username: string;
    token: string | null;
  }): Promise<GitHubConfig> {
    const existing = await db.gitHubConfig.findFirst({
      where: { username: input.username },
    });
    const saved = existing
      ? await db.gitHubConfig.update({
          where: { id: existing.id },
          data: { token: input.token, active: true },
        })
      : await db.gitHubConfig.create({
          data: { username: input.username, token: input.token, active: true },
        });

    await db.gitHubConfig.updateMany({
      where: { id: { not: saved.id }, active: true },
      data: { active: false },
    });
    return toDomain(saved);
  }

  async remove(id: string): Promise<void> {
    await db.gitHubConfig.delete({ where: { id } });
  }
}
