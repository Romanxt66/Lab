import { describe, it, expect } from "vitest";
import { ok, err, type Result } from "@/shared/kernel/result";
import { AutomationService } from "./application/automation-service";
import type { AutomationRuleRepoPort } from "./application/ports";
import type {
  AutomationRule,
  AutomationRuleInput,
  AutomationRunRecord,
  TriggerType,
} from "./domain/automation";
import { SendNotification } from "@/modules/notifications/application/send-notification";
import type {
  NotificationConfigRepoPort,
  NotificationSenderPort,
} from "@/modules/notifications/application/ports";
import type { NotificationConfig } from "@/modules/notifications/domain/config";
import { CalendarService } from "@/modules/calendar/application/calendar-service";
import type { CalendarRepoPort } from "@/modules/calendar/application/ports";
import type { CalendarEvent, EventInput } from "@/modules/calendar/domain/event";

function makeRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: "r1",
    name: "Avisar caída",
    trigger: "uptime_down",
    active: true,
    actions: [{ type: "telegram", config: { message: "{{monitor}} está caído" } }],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

class FakeRuleRepo implements AutomationRuleRepoPort {
  runs: { ruleId: string; ok: boolean; error: string | null }[] = [];
  constructor(public rules: AutomationRule[] = []) {}
  async list() {
    return this.rules;
  }
  async listActiveForTrigger(trigger: TriggerType) {
    return this.rules.filter((r) => r.active && r.trigger === trigger);
  }
  async get(id: string) {
    return this.rules.find((r) => r.id === id) ?? null;
  }
  async create(input: AutomationRuleInput): Promise<AutomationRule> {
    const r = makeRule({ id: `r${this.rules.length + 1}`, ...input });
    this.rules.push(r);
    return r;
  }
  async update(id: string, input: AutomationRuleInput): Promise<AutomationRule> {
    const r = this.rules.find((x) => x.id === id);
    if (!r) throw new Error("not found");
    Object.assign(r, input);
    return r;
  }
  async remove(id: string) {
    this.rules = this.rules.filter((r) => r.id !== id);
  }
  async logRun(ruleId: string, ok: boolean, error: string | null) {
    this.runs.push({ ruleId, ok, error });
  }
  async listRuns(ruleId: string): Promise<AutomationRunRecord[]> {
    return this.runs
      .filter((r) => r.ruleId === ruleId)
      .map((r) => ({ ok: r.ok, error: r.error, ranAt: new Date() }));
  }
}

const notifConfig: NotificationConfig = {
  id: "c1",
  provider: "telegram",
  recipient: "123",
  credential: "k:AABBCC-Ddefghij_klmnop_qrstuvwxyz",
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

class RecordingSender implements NotificationSenderPort {
  sent: string[] = [];
  async send(_p: string, _r: string, _c: string, m: string): Promise<Result<void>> {
    this.sent.push(m);
    return ok(undefined);
  }
}

class FailSender implements NotificationSenderPort {
  async send(): Promise<Result<void>> {
    return err("network down");
  }
}

class ConfigRepo implements NotificationConfigRepoPort {
  async list() {
    return [notifConfig];
  }
  async getActive() {
    return notifConfig;
  }
  async upsert(): Promise<NotificationConfig> {
    throw new Error("nope");
  }
  async remove() {}
}

class FakeCalendarRepo implements CalendarRepoPort {
  created: EventInput[] = [];
  async listBetween() {
    return [];
  }
  async get() {
    return null;
  }
  async create(input: EventInput): Promise<CalendarEvent> {
    this.created.push(input);
    return { ...input, id: "e1", createdAt: new Date() };
  }
  async update(_id: string, input: EventInput): Promise<CalendarEvent> {
    return { ...input, id: "e1", createdAt: new Date() };
  }
  async remove() {}
  async listPendingReminders() {
    return [];
  }
  async markReminderSent() {}
}

function service(
  rules: AutomationRule[],
  sender: NotificationSenderPort = new RecordingSender(),
) {
  const repo = new FakeRuleRepo(rules);
  const notifier = new SendNotification(sender, new ConfigRepo());
  const calendarRepo = new FakeCalendarRepo();
  const calendar = new CalendarService(calendarRepo);
  return { svc: new AutomationService(repo, notifier, calendar), repo, calendarRepo };
}

describe("AutomationService.trigger", () => {
  it("fills the Telegram template from the trigger's variables", async () => {
    const sender = new RecordingSender();
    const { svc } = service([makeRule()], sender);
    await svc.trigger("uptime_down", { monitor: "API", url: "https://x", motivo: "timeout" });
    expect(sender.sent).toEqual(["API está caído"]);
  });

  it("ignores rules for a different trigger", async () => {
    const sender = new RecordingSender();
    const { svc } = service([makeRule({ trigger: "budget_exceeded" })], sender);
    await svc.trigger("uptime_down", { monitor: "API", url: "", motivo: "" });
    expect(sender.sent).toHaveLength(0);
  });

  it("skips inactive rules", async () => {
    const sender = new RecordingSender();
    const { svc } = service([makeRule({ active: false })], sender);
    await svc.trigger("uptime_down", { monitor: "API", url: "", motivo: "" });
    expect(sender.sent).toHaveLength(0);
  });

  it("creates a calendar event with rendered templates", async () => {
    const { svc, calendarRepo } = service([
      makeRule({
        actions: [
          {
            type: "calendar_event",
            config: { title: "Revisar {{monitor}}", description: "{{url}}", daysFromNow: 1 },
          },
        ],
      }),
    ]);
    await svc.trigger("uptime_down", { monitor: "API", url: "https://x", motivo: "" });
    expect(calendarRepo.created).toHaveLength(1);
    expect(calendarRepo.created[0].title).toBe("Revisar API");
    expect(calendarRepo.created[0].description).toBe("https://x");
  });

  it("logs a failed run when the sender fails, without throwing", async () => {
    const { svc, repo } = service([makeRule()], new FailSender());
    await expect(svc.trigger("uptime_down", { monitor: "API", url: "", motivo: "" })).resolves.toBeUndefined();
    expect(repo.runs).toEqual([{ ruleId: "r1", ok: false, error: "network down" }]);
  });

  it("logs a successful run", async () => {
    const { svc, repo } = service([makeRule()]);
    await svc.trigger("uptime_down", { monitor: "API", url: "", motivo: "" });
    expect(repo.runs).toEqual([{ ruleId: "r1", ok: true, error: null }]);
  });

  it("runs every matching rule independently", async () => {
    const sender = new RecordingSender();
    const { svc } = service(
      [makeRule({ id: "r1" }), makeRule({ id: "r2", name: "Segunda" })],
      sender,
    );
    await svc.trigger("uptime_down", { monitor: "API", url: "", motivo: "" });
    expect(sender.sent).toHaveLength(2);
  });
});

describe("AutomationService.save", () => {
  it("rejects invalid input without touching the repo", async () => {
    const { svc, repo } = service([]);
    const res = await svc.save({
      name: "",
      trigger: "uptime_down",
      active: true,
      actions: [{ type: "telegram", config: { message: "hola" } }],
    });
    expect(res.ok).toBe(false);
    expect(repo.rules).toHaveLength(0);
  });
});
