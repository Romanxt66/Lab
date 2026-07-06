import { type Result, ok, err } from "@/shared/kernel/result";

export interface EventInput {
  title: string;
  description?: string | null;
  start: Date;
  end?: Date | null;
  allDay: boolean;
  location?: string | null;
  color?: string | null;
  /** null = no reminder. */
  remindMinutesBefore?: number | null;
}

export interface CalendarEvent extends EventInput {
  id: string;
  createdAt: Date;
  reminderSentAt?: Date | null;
}

/** Serializable form sent to the client (dates as ISO strings). */
export interface EventDTO {
  id: string;
  title: string;
  description: string | null;
  start: string;
  end: string | null;
  allDay: boolean;
  location: string | null;
  color: string | null;
  remindMinutesBefore: number | null;
}

export function toDTO(e: CalendarEvent): EventDTO {
  return {
    id: e.id,
    title: e.title,
    description: e.description ?? null,
    start: e.start.toISOString(),
    end: e.end ? e.end.toISOString() : null,
    allDay: e.allDay,
    location: e.location ?? null,
    color: e.color ?? null,
    remindMinutesBefore: e.remindMinutesBefore ?? null,
  };
}

/** Validate raw event input from the UI. */
export function validateEvent(input: EventInput): Result<EventInput> {
  if (!input.title.trim()) return err("El evento necesita un título.");
  if (Number.isNaN(input.start.getTime())) {
    return err("La fecha de inicio no es válida.");
  }
  if (input.end && Number.isNaN(input.end.getTime())) {
    return err("La fecha de fin no es válida.");
  }
  if (input.end && input.end.getTime() < input.start.getTime()) {
    return err("El fin no puede ser anterior al inicio.");
  }
  return ok({ ...input, title: input.title.trim() });
}
