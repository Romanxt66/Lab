import type {
  CheckRecord,
  HttpMethod,
  MonitorInput,
  MonitorStatus,
  ProbeResult,
  UptimeMonitor,
} from "@/modules/uptime/domain/monitor";

/** Performs the actual HTTP request. Adapters live in `infrastructure/`. */
export interface HttpProbePort {
  probe(
    url: string,
    method: HttpMethod,
    timeoutMs: number,
  ): Promise<ProbeResult>;
}

/** Fields updated on a monitor after a check. */
export interface CheckPatch {
  lastStatus: MonitorStatus;
  lastCheckedAt: Date;
  lastResponseMs: number | null;
  lastStatusCode: number | null;
  lastError: string | null;
  consecutiveFailures: number;
}

export interface MonitorRepoPort {
  list(): Promise<UptimeMonitor[]>;
  listActive(): Promise<UptimeMonitor[]>;
  get(id: string): Promise<UptimeMonitor | null>;
  create(input: MonitorInput): Promise<UptimeMonitor>;
  update(id: string, input: MonitorInput): Promise<UptimeMonitor>;
  remove(id: string): Promise<void>;
  applyCheck(id: string, patch: CheckPatch): Promise<void>;
}

export interface CheckRepoPort {
  add(monitorId: string, result: CheckRecord): Promise<void>;
  listForMonitor(monitorId: string, limit: number): Promise<CheckRecord[]>;
}
