import type { RunState } from "@/modules/coolify/domain/resource";

/** Dot + text colors per run state (accent-agnostic, uses semantic tokens). */
export const STATE_DOT: Record<RunState, string> = {
  running: "bg-success",
  stopped: "bg-muted-foreground/50",
  degraded: "bg-[oklch(0.7_0.14_75)]",
  unknown: "bg-muted-foreground/40",
};

export const STATE_TEXT: Record<RunState, string> = {
  running: "text-success",
  stopped: "text-muted-foreground",
  degraded: "text-[oklch(0.7_0.14_75)]",
  unknown: "text-muted-foreground",
};
