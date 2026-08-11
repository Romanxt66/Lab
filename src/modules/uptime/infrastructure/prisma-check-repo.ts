import "server-only";
import { db } from "@/shared/db";
import type { CheckRepoPort } from "@/modules/uptime/application/ports";
import type { CheckRecord } from "@/modules/uptime/domain/monitor";

export class PrismaCheckRepo implements CheckRepoPort {
  async add(monitorId: string, result: CheckRecord): Promise<void> {
    await db.uptimeCheck.create({
      data: {
        monitorId,
        ok: result.ok,
        statusCode: result.statusCode,
        responseMs: result.responseMs,
        error: result.error,
        checkedAt: result.checkedAt,
      },
    });
  }

  async listForMonitor(
    monitorId: string,
    limit: number,
  ): Promise<CheckRecord[]> {
    const rows = await db.uptimeCheck.findMany({
      where: { monitorId },
      orderBy: { checkedAt: "desc" },
      take: limit,
    });
    return rows.map((r) => ({
      ok: r.ok,
      statusCode: r.statusCode,
      responseMs: r.responseMs,
      error: r.error,
      checkedAt: r.checkedAt,
    }));
  }
}
