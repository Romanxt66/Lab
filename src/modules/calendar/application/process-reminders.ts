import type { CalendarRepoPort } from "./ports";
import type { SendNotification } from "@/modules/notifications/application/send-notification";
import type { CalendarEvent } from "@/modules/calendar/domain/event";

export interface ReminderRunSummary {
  processed: number;
  sent: number;
  failed: number;
  errors: string[];
}

/**
 * ProcessCalendarReminders: find events whose reminder is due, dispatch a
 * notification, and mark them as notified. Idempotent thanks to
 * `reminderSentAt`. Runs every minute from the scheduler.
 */
export class ProcessCalendarReminders {
  constructor(
    private readonly calendar: CalendarRepoPort,
    private readonly notifier: SendNotification,
  ) {}

  async execute(now: Date = new Date()): Promise<ReminderRunSummary> {
    const pending = await this.calendar.listPendingReminders(now);
    const summary: ReminderRunSummary = {
      processed: pending.length,
      sent: 0,
      failed: 0,
      errors: [],
    };

    for (const event of pending) {
      const res = await this.notifier.execute(formatReminder(event));
      if (res.ok) {
        summary.sent++;
        await this.calendar.markReminderSent(event.id, now);
      } else {
        summary.failed++;
        summary.errors.push(`${event.title}: ${res.error}`);
      }
    }

    return summary;
  }
}

function formatReminder(event: CalendarEvent): string {
  const time = event.allDay
    ? "todo el día"
    : event.start.toLocaleTimeString("es", {
        hour: "2-digit",
        minute: "2-digit",
      });
  const parts: string[] = [`⏰ Recordatorio: ${event.title}`];
  parts.push(`🕒 ${time}`);
  if (event.location) parts.push(`📍 ${event.location}`);
  if (event.description) parts.push(`📝 ${event.description.slice(0, 200)}`);
  return parts.join("\n");
}
