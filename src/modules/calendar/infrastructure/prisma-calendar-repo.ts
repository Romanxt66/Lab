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
}
