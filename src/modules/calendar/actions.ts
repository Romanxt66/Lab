"use server";

import { type Result, ok } from "@/shared/kernel/result";
import { getCalendarService } from "@/shared/di/container";
import { toDTO, type EventDTO } from "@/modules/calendar/domain/event";

export async function listMonthAction(
  year: number,
  month: number,
): Promise<EventDTO[]> {
  const events = await getCalendarService().listMonth(year, month);
  return events.map(toDTO);
}

export interface SaveEventInput {
  id?: string;
  title: string;
  description?: string;
  /** ISO datetime strings from the client. */
  start: string;
  end?: string | null;
  allDay: boolean;
  location?: string;
  color?: string | null;
  /** null / undefined = no reminder. */
  remindMinutesBefore?: number | null;
}

export async function saveEventAction(
  input: SaveEventInput,
): Promise<Result<EventDTO>> {
  const parsed = {
    title: input.title,
    description: input.description ?? null,
    start: new Date(input.start),
    end: input.end ? new Date(input.end) : null,
    allDay: input.allDay,
    location: input.location ?? null,
    color: input.color ?? null,
    remindMinutesBefore:
      typeof input.remindMinutesBefore === "number"
        ? input.remindMinutesBefore
        : null,
  };
  const svc = getCalendarService();
  const res = input.id
    ? await svc.update(input.id, parsed)
    : await svc.create(parsed);
  return res.ok ? ok(toDTO(res.value)) : res;
}

export async function deleteEventAction(id: string): Promise<void> {
  await getCalendarService().remove(id);
}
