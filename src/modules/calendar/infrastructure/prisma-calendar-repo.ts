import "server-only";
import { db } from "@/shared/db";
import type { CalendarRepoPort } from "@/modules/calendar/application/ports";
import type {
  CalendarEvent,
  EventInput,
} from "@/modules/calendar/domain/event";

function data(input: EventInput) {
  return {
    title: input.title,
    description: input.description ?? null,
    start: input.start,
    end: input.end ?? null,
    allDay: input.allDay,
    location: input.location ?? null,
    color: input.color ?? null,
    remindMinutesBefore: input.remindMinutesBefore ?? null,
  };
}

/** CalendarRepoPort backed by Prisma (table `calendario`). */
export class PrismaCalendarRepo implements CalendarRepoPort {
  listBetween(from: Date, to: Date): Promise<CalendarEvent[]> {
    return db.calendario.findMany({
      where: { start: { gte: from, lt: to } },
      orderBy: { start: "asc" },
    });
  }

  get(id: string): Promise<CalendarEvent | null> {
    return db.calendario.findUnique({ where: { id } });
  }

  create(input: EventInput): Promise<CalendarEvent> {
    return db.calendario.create({ data: data(input) });
  }

  update(id: string, input: EventInput): Promise<CalendarEvent> {
    return db.calendario.update({ where: { id }, data: data(input) });
  }

  async remove(id: string): Promise<void> {
    await db.calendario.delete({ where: { id } });
  }

  /**
   * Return events where a reminder is due: reminder is configured, not yet
   * sent, and the "remind at" moment has already passed. We also skip past
   * events (start too far behind) to avoid flooding after downtime.
   */
  async listPendingReminders(now: Date): Promise<CalendarEvent[]> {
    const rows = await db.calendario.findMany({
      where: {
        remindMinutesBefore: { not: null },
        reminderSentAt: null,
        start: {
          // Ignore events whose start is more than a day in the past.
          gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { start: "asc" },
    });
    return rows.filter((r) => {
      const minutes = r.remindMinutesBefore ?? 0;
      const remindAt = new Date(r.start.getTime() - minutes * 60_000);
      return remindAt.getTime() <= now.getTime();
    });
  }

  async markReminderSent(id: string, at: Date): Promise<void> {
    await db.calendario.update({
      where: { id },
      data: { reminderSentAt: at },
    });
  }
}
