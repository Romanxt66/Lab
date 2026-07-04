import { type Result, ok } from "@/shared/kernel/result";
import {
  validateEvent,
  type CalendarEvent,
  type EventInput,
} from "@/modules/calendar/domain/event";
import type { CalendarRepoPort } from "./ports";

/**
 * CalendarService: use-cases for managing events. Validation lives in the
 * domain; persistence behind the repo port. Depends on no framework.
 */
export class CalendarService {
  constructor(private readonly repo: CalendarRepoPort) {}

  /** All events overlapping the given month (1-based month). */
  listMonth(year: number, month: number): Promise<CalendarEvent[]> {
    // Pad by a week each side so events visible in the leading/trailing days
    // of the month grid are included.
    const from = new Date(year, month - 1, 1);
    from.setDate(from.getDate() - 7);
    const to = new Date(year, month, 1);
    to.setDate(to.getDate() + 7);
    return this.repo.listBetween(from, to);
  }

  async create(input: EventInput): Promise<Result<CalendarEvent>> {
    const valid = validateEvent(input);
    if (!valid.ok) return valid;
    return ok(await this.repo.create(valid.value));
  }

  async update(id: string, input: EventInput): Promise<Result<CalendarEvent>> {
    const valid = validateEvent(input);
    if (!valid.ok) return valid;
    return ok(await this.repo.update(id, valid.value));
  }

  remove(id: string): Promise<void> {
    return this.repo.remove(id);
  }
}
