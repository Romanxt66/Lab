import { describe, it, expect } from "vitest";
import { validateEvent, type CalendarEvent, type EventInput } from "./domain/event";
import { CalendarService } from "./application/calendar-service";
import type { CalendarRepoPort } from "./application/ports";

describe("validateEvent", () => {
  const base: EventInput = {
    title: "Reunión",
    start: new Date("2026-07-10T09:00:00"),
    allDay: false,
  };
  it("accepts a valid event and trims the title", () => {
    const r = validateEvent({ ...base, title: "  Hola  " });
    expect(r.ok && r.value.title).toBe("Hola");
  });
  it("rejects empty title", () => {
    expect(validateEvent({ ...base, title: "  " }).ok).toBe(false);
  });
  it("rejects end before start", () => {
    const r = validateEvent({
      ...base,
      end: new Date("2026-07-10T08:00:00"),
    });
    expect(r.ok).toBe(false);
  });
});

class FakeRepo implements CalendarRepoPort {
  from?: Date;
  to?: Date;
  created: EventInput[] = [];
  async listBetween(from: Date, to: Date): Promise<CalendarEvent[]> {
    this.from = from;
    this.to = to;
    return [];
  }
  async get() {
    return null;
  }
  async create(input: EventInput): Promise<CalendarEvent> {
    this.created.push(input);
    return { ...input, id: "e1", createdAt: new Date() };
  }
  async update(id: string, input: EventInput): Promise<CalendarEvent> {
    return { ...input, id, createdAt: new Date() };
  }
  async remove() {}
}

describe("CalendarService", () => {
  it("validates before creating", async () => {
    const repo = new FakeRepo();
    const res = await new CalendarService(repo).create({
      title: "",
      start: new Date(),
      allDay: false,
    });
    expect(res.ok).toBe(false);
    expect(repo.created).toHaveLength(0);
  });

  it("queries a padded range for the month", async () => {
    const repo = new FakeRepo();
    await new CalendarService(repo).listMonth(2026, 7); // July 2026
    // Range should start before Jul 1 and end after Aug 1 (7-day padding).
    expect(repo.from!.getTime()).toBeLessThan(new Date(2026, 6, 1).getTime());
    expect(repo.to!.getTime()).toBeGreaterThan(new Date(2026, 7, 1).getTime());
  });
});
