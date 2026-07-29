/**
 * Client-safe projections of Coolify resources. The Coolify API returns rich,
 * sometimes-varying objects; we map a resilient subset and keep it flat so it
 * serialises cleanly to the browser.
 */

export type RunState = "running" | "stopped" | "degraded" | "unknown";

export interface CoolifyApp {
  uuid: string;
  name: string;
  description: string | null;
  /** Public URL(s) if configured, e.g. "https://app.example.com". */
  fqdn: string | null;
  /** Raw status string from Coolify, e.g. "running:healthy". */
  status: string;
  /** Parsed run state derived from `status`. */
  state: RunState;
  /** Whether Coolify reports the container as healthy. */
  healthy: boolean | null;
  gitRepository: string | null;
  gitBranch: string | null;
  buildPack: string | null;
  projectName: string | null;
  environmentName: string | null;
}

export interface CoolifyProject {
  uuid: string;
  name: string;
  description: string | null;
}

export interface CoolifyEnvironment {
  uuid: string;
  name: string;
}

export type BuildPack = "nixpacks" | "static" | "dockerfile" | "dockercompose";

export const BUILD_PACKS: { id: BuildPack; label: string }[] = [
  { id: "nixpacks", label: "Nixpacks (auto)" },
  { id: "static", label: "Estático" },
  { id: "dockerfile", label: "Dockerfile" },
  { id: "dockercompose", label: "Docker Compose" },
];

export interface CoolifyServer {
  uuid: string;
  name: string;
  ip: string | null;
  reachable: boolean | null;
}

export interface CoolifyResource {
  uuid: string;
  name: string;
  type: string; // "database" | "service" | …
  status: string;
  state: RunState;
}

export interface CoolifyOverview {
  apps: CoolifyApp[];
  projects: CoolifyProject[];
  servers: CoolifyServer[];
  databases: CoolifyResource[];
  services: CoolifyResource[];
}

export interface CoolifyEnv {
  uuid: string;
  key: string;
  value: string;
  isBuildTime: boolean;
  isPreview: boolean;
  isLiteral: boolean;
}

/**
 * Parse Coolify's "state:health" status string into a coarse run state.
 * Examples: "running:healthy", "running:unhealthy", "exited:unhealthy",
 * "stopped", "restarting". Pure and defensive.
 */
export function parseState(status: string | null | undefined): {
  state: RunState;
  healthy: boolean | null;
} {
  const raw = (status ?? "").toLowerCase().trim();
  if (!raw) return { state: "unknown", healthy: null };
  const [phase, health] = raw.split(":");
  const healthy =
    health === undefined ? null : health.includes("healthy") && !health.includes("unhealthy");

  if (phase.startsWith("running")) {
    return { state: healthy === false ? "degraded" : "running", healthy };
  }
  if (
    phase.startsWith("exited") ||
    phase.startsWith("stopped") ||
    phase.startsWith("dead")
  ) {
    return { state: "stopped", healthy };
  }
  if (phase.startsWith("restarting") || phase.startsWith("starting")) {
    return { state: "degraded", healthy };
  }
  return { state: "unknown", healthy };
}

export const STATE_LABELS: Record<RunState, string> = {
  running: "En marcha",
  stopped: "Detenida",
  degraded: "Con problemas",
  unknown: "Desconocido",
};
