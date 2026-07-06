import { describe, it, expect } from "vitest";
import { ProcessCalendarReminders } from "./application/process-reminders";
import type { CalendarRepoPort } from "./application/ports";
import type { CalendarEvent, EventInput } from "./domain/event";
import { ok, err, type Result } from "@/shared/kernel/result";
import { SendNotification } from "@/modules/notifications/application/send-notification";
import type {
  NotificationConfigRepoPort,
  NotificationSenderPort,
} from "@/modules/notifications/application/ports";
import type { NotificationConfig } from "@/modules/notifications/domain/config";

class FakeCalRepo implements CalendarRepoPort {
  marked: { id: string; at: Date }[] = [];
  constructor(private pending: CalendarEvent[]) {}
  async listBetween() {
    return [];
  }
  async get() {
    return null;
  }
  async create(_i: EventInput): Promise<CalendarEvent> {
    throw new Error("nope");
  }
  async update(_id: string, _i: EventInput): Promise<CalendarEvent> {
    throw new Error("nope");
  }
  async remove() {}
  async listPendingReminders() {
    return this.pending;
  }
  async markReminderSent(id: string, at: Date) {
    this.marked.push({ id, at });
  }
}

const config: NotificationConfig = {
  id: "c1",
  provider: "telegram",
  recipient: "123",
  credential: "k:AABBCC-Ddefghij_klmnop_qrstuvwxyz",
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

class OkSender implements NotificationSenderPort {
  sent: string[] = [];
  async send(_p: string, _r: string, _c: string, m: string): Promise<Result<void>> {
    this.sent.push(m);
    return ok(undefined);
  }
}

class FailSender implements NotificationSenderPort {
  async send(): Promise<Result<void>> {
    return err("network");
  }
}

class Repo implements NotificationConfigRepoPort {
  async list() {
    return [config];
  }
  async getActive() {
    return config;
  }
  async upsert(): Promise<NotificationConfig> {
    throw new Error("nope");
  }
  async remove() {}
}

function event(over: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: over.id ?? "e1",
    title: over.title ?? "Reunión",
    description: null,
    start: over.start ?? new Date(),
    end: null,
    allDay: false,
    location: null,
    color: null,
    remindMinutesBefore: over.remindMinutesBefore ?? 15,
    createdAt: new Date(),
  };
}

describe("ProcessCalendarReminders", () => {
  it("sends and marks the pending reminders", async () => {
    const cal = new FakeCalRepo([
      event({ id: "a", title: "A" }),
      event({ id: "b", title: "B" }),
    ]);
    const sender = new OkSender();
    const svc = new ProcessCalendarReminders(
      cal,
      new SendNotification(sender, new Repo()),
    );
    const summary = await svc.execute(new Date());
    expect(summary.processed).toBe(2);
    expect(summary.sent).toBe(2);
    expect(summary.failed).toBe(0);
    expect(cal.marked.map((m) => m.id).sort()).toEqual(["a", "b"]);
    expect(sender.sent[0]).toMatch(/Recordatorio: A/);
  });

  it("does not mark reminders that failed to send", async () => {
    const cal = new FakeCalRepo([event({ id: "x", title: "X" })]);
    const svc = new ProcessCalendarReminders(
      cal,
      new SendNotification(new FailSender(), new Repo()),
    );
    const summary = await svc.execute(new Date());
    expect(summary.sent).toBe(0);
    expect(summary.failed).toBe(1);
    expect(cal.marked).toHaveLength(0);
  });
});
