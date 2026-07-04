import type { CalendarEvent, EventInput } from "@/modules/calendar/domain/event";

export interface CalendarRepoPort {
  listBetween(from: Date, to: Date): Promise<CalendarEvent[]>;
  get(id: string): Promise<CalendarEvent | null>;
  create(input: EventInput): Promise<CalendarEvent>;
  update(id: string, input: EventInput): Promise<CalendarEvent>;
  remove(id: string): Promise<void>;
}
