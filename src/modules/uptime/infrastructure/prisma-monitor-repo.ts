import "server-only";
import { db } from "@/shared/db";
import type { CheckPatch, MonitorRepoPort } from "@/modules/uptime/application/ports";
import type {
  HttpMethod,
  MonitorInput,
  MonitorStatus,
  UptimeMonitor,
} from "@/modules/uptime/domain/monitor";

type Row = {
  id: string;
  name: string;
  url: string;
  method: string;
  expectedStatus: number;
  intervalSeconds: number;
  timeoutMs: number;
  active: boolean;
  notifyOnFailure: boolean;
  lastStatus: string;
  lastCheckedAt: Date | null;
  lastResponseMs: number | null;
  lastStatusCode: number | null;
  lastError: string | null;
  consecutiveFailures: number;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: Row): UptimeMonitor {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    method: row.method as HttpMethod,
    expectedStatus: row.expectedStatus,
    intervalSeconds: row.intervalSeconds,
    timeoutMs: row.timeoutMs,
    active: row.active,
    notifyOnFailure: row.notifyOnFailure,
    lastStatus: row.lastStatus as MonitorStatus,
    lastCheckedAt: row.lastCheckedAt,
    lastResponseMs: row.lastResponseMs,
    lastStatusCode: row.lastStatusCode,
    lastError: row.lastError,
    consecutiveFailures: row.consecutiveFailures,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toData(input: MonitorInput) {
  return {
    name: input.name,
    url: input.url,
    method: input.method,
    expectedStatus: input.expectedStatus,
    intervalSeconds: input.intervalSeconds,
    timeoutMs: input.timeoutMs,
    active: input.active,
    notifyOnFailure: input.notifyOnFailure,
  };
}

export class PrismaMonitorRepo implements MonitorRepoPort {
  async list(): Promise<UptimeMonitor[]> {
    const rows = await db.uptimeMonitor.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(toDomain);
  }
  async listActive(): Promise<UptimeMonitor[]> {
    const rows = await db.uptimeMonitor.findMany({ where: { active: true } });
    return rows.map(toDomain);
  }
  async get(id: string): Promise<UptimeMonitor | null> {
    const row = await db.uptimeMonitor.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }
  async create(input: MonitorInput): Promise<UptimeMonitor> {
    const row = await db.uptimeMonitor.create({ data: toData(input) });
    return toDomain(row);
  }
  async update(id: string, input: MonitorInput): Promise<UptimeMonitor> {
    const row = await db.uptimeMonitor.update({ where: { id }, data: toData(input) });
    return toDomain(row);
  }
  async remove(id: string): Promise<void> {
    await db.uptimeMonitor.delete({ where: { id } });
  }
  async applyCheck(id: string, patch: CheckPatch): Promise<void> {
    await db.uptimeMonitor.update({
      where: { id },
      data: {
        lastStatus: patch.lastStatus,
        lastCheckedAt: patch.lastCheckedAt,
        lastResponseMs: patch.lastResponseMs,
        lastStatusCode: patch.lastStatusCode,
        lastError: patch.lastError,
        consecutiveFailures: patch.consecutiveFailures,
      },
    });
  }
}
