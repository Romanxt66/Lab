import { describe, it, expect } from "vitest";
import { ok, err, type Result } from "@/shared/kernel/result";
import { cronMatches, isValidCron } from "./domain/cron";
import { RunJob } from "./application/run-job";
import type {
  ScheduledJobRepoPort,
  JobRunRepoPort,
  ScheduledJob,
  JobAction,
  JobActionHandler,
} from "./application/ports";

describe("cron domain", () => {
  it("validates field counts and ranges", () => {
    expect(isValidCron("*/5 * * * *")).toBe(true);
    expect(isValidCron("0 9 * * 1")).toBe(true);
    expect(isValidCron("* * * *")).toBe(false); // 4 fields
    expect(isValidCron("60 * * * *")).toBe(false); // minute out of range
  });

  it("matches specific times", () => {
    // Monday 2024-01-01 09:00 local
    const d = new Date(2024, 0, 1, 9, 0);
    expect(cronMatches("0 9 * * *", d)).toBe(true);
    expect(cronMatches("0 10 * * *", d)).toBe(false);
    expect(cronMatches("0 9 * * 1", d)).toBe(true); // Monday
  });

  it("handles step and range", () => {
    expect(cronMatches("*/15 * * * *", new Date(2024, 0, 1, 0, 30))).toBe(true);
    expect(cronMatches("*/15 * * * *", new Date(2024, 0, 1, 0, 31))).toBe(false);
    expect(cronMatches("0 9-17 * * *", new Date(2024, 0, 1, 12, 0))).toBe(true);
  });
});

// --- Fakes ---
function makeJob(over: Partial<ScheduledJob> = {}): ScheduledJob {
  return {
    id: "j1",
    name: "test",
    cron: "* * * * *",
    action: "scrape" as JobAction,
    params: JSON.stringify({ url: "https://a.com" }),
    enabled: true,
    createdAt: new Date(),
    ...over,
  };
}

class FakeJobRepo implements ScheduledJobRepoPort {
  constructor(private job: ScheduledJob | null) {}
  async list() { return this.job ? [this.job] : []; }
  async listEnabled() { return this.job ? [this.job] : []; }
  async get(id: string) { return this.job && this.job.id === id ? this.job : null; }
  async create(): Promise<ScheduledJob> { throw new Error("nope"); }
  async update(): Promise<ScheduledJob> { throw new Error("nope"); }
  async remove() {}
}

class FakeRunRepo implements JobRunRepoPort {
  recorded: { status: string; output?: string }[] = [];
  async record(e: { jobId: string; status: "success" | "error"; output?: string }) {
    this.recorded.push({ status: e.status, output: e.output });
  }
  async listRecent() { return []; }
}

describe("RunJob", () => {
  const handlers = (impl: JobActionHandler): Record<JobAction, JobActionHandler> => ({
    scrape: impl,
    email: async () => ok("noop"),
  });

  it("dispatches to the action handler and records success", async () => {
    const runRepo = new FakeRunRepo();
    let received: unknown;
    const res = await new RunJob(
      new FakeJobRepo(makeJob()),
      runRepo,
      handlers(async (p) => {
        received = p;
        return ok("2 resultados");
      }),
    ).execute("j1");

    expect(res.ok && res.value).toBe("2 resultados");
    expect(received).toEqual({ url: "https://a.com" });
    expect(runRepo.recorded).toEqual([{ status: "success", output: "2 resultados" }]);
  });

  it("records error when the handler fails", async () => {
    const runRepo = new FakeRunRepo();
    const res = await new RunJob(
      new FakeJobRepo(makeJob()),
      runRepo,
      handlers(async () => err("boom")),
    ).execute("j1");
    expect(res.ok).toBe(false);
    expect(runRepo.recorded[0].status).toBe("error");
  });

  it("returns error for unknown job id", async () => {
    const res = await new RunJob(
      new FakeJobRepo(null),
      new FakeRunRepo(),
      handlers(async () => ok("x")),
    ).execute("missing");
    expect(res.ok).toBe(false);
  });
});
