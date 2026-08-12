import { type Result, ok } from "@/shared/kernel/result";
import {
  validateMonitorInput,
  isUp,
  isDue,
  transition,
  uptimePercent,
  type CheckRecord,
  type MonitorInput,
  type ProbeResult,
  type UptimeMonitor,
} from "@/modules/uptime/domain/monitor";
import type { SendNotification } from "@/modules/notifications/application/send-notification";
import type { AutomationService } from "@/modules/automations/application/automation-service";
import type {
  CheckRepoPort,
  HttpProbePort,
  MonitorRepoPort,
} from "./ports";

export interface MonitorDetail {
  monitor: UptimeMonitor;
  checks: CheckRecord[];
  uptime24h: number;
}

export interface RunSummary {
  checked: number;
  down: number;
  recovered: number;
  errors: string[];
}

/**
 * Orchestrates uptime monitoring: CRUD plus the periodic check that probes due
 * monitors, records results and alerts on transitions. The check flow is pure
 * domain (isUp/transition) wrapped around the probe + repo side effects.
 */
export class UptimeService {
  constructor(
    private readonly monitors: MonitorRepoPort,
    private readonly checks: CheckRepoPort,
    private readonly probe: HttpProbePort,
    private readonly notifier: SendNotification,
    private readonly automations: AutomationService,
  ) {}

  list(): Promise<UptimeMonitor[]> {
    return this.monitors.list();
  }

  async detail(id: string): Promise<MonitorDetail | null> {
    const monitor = await this.monitors.get(id);
    if (!monitor) return null;
    const checks = await this.checks.listForMonitor(id, 100);
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const last24 = checks.filter((c) => c.checkedAt.getTime() >= since);
    return { monitor, checks, uptime24h: uptimePercent(last24) };
  }

  async save(
    input: MonitorInput & { id?: string },
  ): Promise<Result<UptimeMonitor>> {
    const valid = validateMonitorInput(input);
    if (!valid.ok) return valid;
    return ok(
      input.id
        ? await this.monitors.update(input.id, valid.value)
        : await this.monitors.create(valid.value),
    );
  }

  async remove(id: string): Promise<void> {
    await this.monitors.remove(id);
  }

  /** Probe one monitor immediately (manual "check now"). */
  async checkNow(id: string): Promise<Result<UptimeMonitor>> {
    const monitor = await this.monitors.get(id);
    if (!monitor) return { ok: false, error: "El monitor ya no existe." };
    await this.runOne(monitor, new Date());
    const updated = await this.monitors.get(id);
    return updated ? ok(updated) : { ok: false, error: "No se pudo releer el monitor." };
  }

  /** Probe every active monitor that's due. Called on a cron tick. */
  async runDueChecks(now = new Date()): Promise<RunSummary> {
    const summary: RunSummary = { checked: 0, down: 0, recovered: 0, errors: [] };
    const active = await this.monitors.listActive();
    for (const monitor of active) {
      if (!isDue(monitor, now)) continue;
      try {
        const alert = await this.runOne(monitor, now);
        summary.checked++;
        if (alert === "down") summary.down++;
        if (alert === "recovered") summary.recovered++;
      } catch (e) {
        summary.errors.push(
          `${monitor.name}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    return summary;
  }

  /** Probe a single monitor, persist the result and alert on a transition. */
  private async runOne(
    monitor: UptimeMonitor,
    now: Date,
  ): Promise<"down" | "recovered" | null> {
    const probe = await this.probe.probe(
      monitor.url,
      monitor.method,
      monitor.timeoutMs,
    );
    const nowUp = isUp(monitor.expectedStatus, probe);
    const { status, alert } = transition(monitor.lastStatus, nowUp);

    const result: CheckRecord = {
      ok: nowUp,
      statusCode: probe.statusCode,
      responseMs: probe.responseMs,
      error: probe.error,
      checkedAt: now,
    };

    await this.monitors.applyCheck(monitor.id, {
      lastStatus: status,
      lastCheckedAt: now,
      lastResponseMs: probe.responseMs,
      lastStatusCode: probe.statusCode,
      lastError: probe.error,
      consecutiveFailures: nowUp ? 0 : monitor.consecutiveFailures + 1,
    });
    await this.checks.add(monitor.id, result);

    if (alert && monitor.notifyOnFailure) {
      await this.notifier.execute(this.alertMessage(monitor, alert, probe));
    }
    if (alert) {
      await this.automations.trigger(
        alert === "down" ? "uptime_down" : "uptime_recovered",
        {
          monitor: monitor.name,
          url: monitor.url,
          motivo: probe.error ?? (probe.statusCode ? `HTTP ${probe.statusCode}` : ""),
        },
      );
    }
    return alert;
  }

  private alertMessage(
    monitor: UptimeMonitor,
    alert: "down" | "recovered",
    probe: ProbeResult,
  ): string {
    if (alert === "recovered") {
      return (
        `✅ *${monitor.name}* se ha recuperado\n` +
        `${monitor.url}\n` +
        (probe.statusCode ? `HTTP ${probe.statusCode}` : "") +
        (probe.responseMs != null ? ` · ${probe.responseMs} ms` : "")
      );
    }
    const reason = probe.error
      ? probe.error
      : probe.statusCode
        ? `HTTP ${probe.statusCode}`
        : "sin respuesta";
    return (
      `🔴 *${monitor.name}* está caído\n` +
      `${monitor.url}\n` +
      `Motivo: ${reason}`
    );
  }
}
