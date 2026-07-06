import type { CalendarEvent, EventInput } from "@/modules/calendar/domain/event";

export interface CalendarRepoPort {
  listBetween(from: Date, to: Date): Promise<CalendarEvent[]>;
  get(id: string): Promise<CalendarEvent | null>;
  create(input: EventInput): Promise<CalendarEvent>;
  update(id: string, input: EventInput): Promise<CalendarEvent>;
  remove(id: string): Promise<void>;
  /**
   * Events that have a reminder configured, whose reminder hasn't been sent
   * yet, AND whose `start - remindMinutesBefore` moment is <= `now`.
   */
  listPendingReminders(now: Date): Promise<CalendarEvent[]>;
  markReminderSent(id: string, at: Date): Promise<void>;
}
