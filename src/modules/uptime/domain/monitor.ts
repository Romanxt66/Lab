import { type Result, ok, err } from "@/shared/kernel/result";

export type MonitorStatus = "up" | "down" | "unknown";
export type HttpMethod = "GET" | "HEAD";
export const HTTP_METHODS: HttpMethod[] = ["GET", "HEAD"];

export interface UptimeMonitor {
  id: string;
  name: string;
  url: string;
  method: HttpMethod;
  /** 0 = accept any 2xx/3xx. */
  expectedStatus: number;
  intervalSeconds: number;
  timeoutMs: number;
  active: boolean;
  notifyOnFailure: boolean;
  lastStatus: MonitorStatus;
  lastCheckedAt: Date | null;
  lastResponseMs: number | null;
  lastStatusCode: number | null;
  lastError: string | null;
  consecutiveFailures: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MonitorInput {
  name: string;
  url: string;
  method: HttpMethod;
  expectedStatus: number;
  intervalSeconds: number;
  timeoutMs: number;
  active: boolean;
  notifyOnFailure: boolean;
}

/** Client-safe projection (no secrets involved; dates as ISO). */
export interface MonitorDTO {
  id: string;
  name: string;
  url: string;
  method: HttpMethod;
  expectedStatus: number;
  intervalSeconds: number;
  timeoutMs: number;
  active: boolean;
  notifyOnFailure: boolean;
  lastStatus: MonitorStatus;
  lastCheckedAt: string | null;
  lastResponseMs: number | null;
  lastStatusCode: number | null;
  lastError: string | null;
  consecutiveFailures: number;
}

export function toMonitorDTO(m: UptimeMonitor): MonitorDTO {
  return {
    id: m.id,
    name: m.name,
    url: m.url,
    method: m.method,
    expectedStatus: m.expectedStatus,
    intervalSeconds: m.intervalSeconds,
    timeoutMs: m.timeoutMs,
    active: m.active,
    notifyOnFailure: m.notifyOnFailure,
    lastStatus: m.lastStatus,
    lastCheckedAt: m.lastCheckedAt ? m.lastCheckedAt.toISOString() : null,
    lastResponseMs: m.lastResponseMs,
    lastStatusCode: m.lastStatusCode,
    lastError: m.lastError,
    consecutiveFailures: m.consecutiveFailures,
  };
}

const MIN_INTERVAL = 30;
const MAX_TIMEOUT = 60_000;

export function validateMonitorInput(input: MonitorInput): Result<MonitorInput> {
  const name = input.name.trim();
  if (!name) return err("El nombre no puede estar vacío.");

  const url = input.url.trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return err("La URL no es válida (ej. https://midominio.com).");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return err("La URL debe empezar por http:// o https://");
  }

  if (!HTTP_METHODS.includes(input.method)) {
    return err(`Método no soportado: ${input.method}`);
  }
  if (
    !Number.isInteger(input.expectedStatus) ||
    input.expectedStatus < 0 ||
    input.expectedStatus > 599
  ) {
    return err("El código de estado esperado no es válido (0 = cualquiera).");
  }
  if (!Number.isInteger(input.intervalSeconds) || input.intervalSeconds < MIN_INTERVAL) {
    return err(`El intervalo mínimo es ${MIN_INTERVAL} segundos.`);
  }
  if (
    !Number.isInteger(input.timeoutMs) ||
    input.timeoutMs < 1000 ||
    input.timeoutMs > MAX_TIMEOUT
  ) {
    return err("El timeout debe estar entre 1s y 60s.");
  }

  return ok({ ...input, name, url: url.replace(/\/+$/, "") || url });
}

/** Result of an HTTP probe (from the adapter). */
export interface ProbeResult {
  ok: boolean;
  statusCode: number | null;
  responseMs: number | null;
  error: string | null;
}

/**
 * Decide whether a probe means the monitor is up, given its expected status.
 * `expectedStatus === 0` accepts any 2xx/3xx; otherwise the code must match.
 */
export function isUp(expectedStatus: number, probe: ProbeResult): boolean {
  if (!probe.ok || probe.statusCode === null) return false;
  if (expectedStatus === 0) {
    return probe.statusCode >= 200 && probe.statusCode < 400;
  }
  return probe.statusCode === expectedStatus;
}

/** Whether a monitor is due for its next check at `now`. */
export function isDue(
  monitor: Pick<UptimeMonitor, "active" | "intervalSeconds" | "lastCheckedAt">,
  now: Date,
): boolean {
  if (!monitor.active) return false;
  if (!monitor.lastCheckedAt) return true;
  const nextAt = monitor.lastCheckedAt.getTime() + monitor.intervalSeconds * 1000;
  return now.getTime() >= nextAt;
}

export type TransitionAlert = "down" | "recovered" | null;

/**
 * Given the previous status and whether the monitor is now up, compute the new
 * status and whether an alert should fire. Alerts only on a real transition
 * (up→down or down→up); "unknown" → first known state does not alert.
 */
export function transition(
  prev: MonitorStatus,
  nowUp: boolean,
): { status: MonitorStatus; alert: TransitionAlert } {
  const status: MonitorStatus = nowUp ? "up" : "down";
  if (prev === status) return { status, alert: null };
  if (prev === "down" && status === "up") return { status, alert: "recovered" };
  if (prev === "up" && status === "down") return { status, alert: "down" };
  // From "unknown": adopt the state, alert only if it starts down.
  return { status, alert: status === "down" ? "down" : null };
}

/** Uptime percentage over a set of checks (0–100, one decimal). */
export function uptimePercent(checks: { ok: boolean }[]): number {
  if (checks.length === 0) return 0;
  const okCount = checks.filter((c) => c.ok).length;
  return Math.round((okCount / checks.length) * 1000) / 10;
}

export const STATUS_LABELS: Record<MonitorStatus, string> = {
  up: "En línea",
  down: "Caído",
  unknown: "Sin datos",
};

/** A stored check result (domain view). */
export interface CheckRecord {
  ok: boolean;
  statusCode: number | null;
  responseMs: number | null;
  error: string | null;
  checkedAt: Date;
}

export interface CheckDTO {
  ok: boolean;
  statusCode: number | null;
  responseMs: number | null;
  error: string | null;
  checkedAt: string;
}

export function toCheckDTO(c: CheckRecord): CheckDTO {
  return {
    ok: c.ok,
    statusCode: c.statusCode,
    responseMs: c.responseMs,
    error: c.error,
    checkedAt: c.checkedAt.toISOString(),
  };
}
