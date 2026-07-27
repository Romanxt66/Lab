import { type Result, ok, err } from "@/shared/kernel/result";
import type { TransactionKind } from "./transaction";

export type Frequency = "weekly" | "monthly" | "yearly";
export const FREQUENCIES: Frequency[] = ["weekly", "monthly", "yearly"];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: "Semanal",
  monthly: "Mensual",
  yearly: "Anual",
};

export interface RecurringPayment {
  id: string;
  name: string;
  accountId: string;
  categoryId: string | null;
  kind: TransactionKind;
  amount: number;
  frequency: Frequency;
  nextRunAt: Date;
  remindDaysBefore: number | null;
  reminderSentAt: Date | null;
  active: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurringPaymentInput {
  name: string;
  accountId: string;
  categoryId: string | null;
  kind: TransactionKind;
  amount: number;
  frequency: Frequency;
  nextRunAt: Date;
  remindDaysBefore: number | null;
  active: boolean;
  notes: string | null;
}

export interface RecurringPaymentDTO {
  id: string;
  name: string;
  accountId: string;
  categoryId: string | null;
  kind: TransactionKind;
  amount: number;
  frequency: Frequency;
  nextRunAt: string;
  remindDaysBefore: number | null;
  active: boolean;
  notes: string | null;
}

export function toRecurringDTO(r: RecurringPayment): RecurringPaymentDTO {
  return {
    id: r.id,
    name: r.name,
    accountId: r.accountId,
    categoryId: r.categoryId,
    kind: r.kind,
    amount: r.amount,
    frequency: r.frequency,
    nextRunAt: r.nextRunAt.toISOString(),
    remindDaysBefore: r.remindDaysBefore,
    active: r.active,
    notes: r.notes,
  };
}

export function validateRecurringInput(
  input: RecurringPaymentInput,
): Result<RecurringPaymentInput> {
  const name = input.name.trim();
  if (!name) return err("El nombre no puede estar vacío.");
  if (!input.accountId) return err("Elige una cuenta.");
  if (input.kind !== "income" && input.kind !== "expense") {
    return err(`Tipo desconocido: ${input.kind}`);
  }
  if (!FREQUENCIES.includes(input.frequency)) {
    return err(`Frecuencia desconocida: ${input.frequency}`);
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return err("El importe debe ser mayor que 0.");
  }
  if (Number.isNaN(input.nextRunAt.getTime())) {
    return err("La fecha del próximo cargo no es válida.");
  }
  if (
    input.remindDaysBefore != null &&
    (!Number.isInteger(input.remindDaysBefore) || input.remindDaysBefore < 0)
  ) {
    return err("Los días de aviso deben ser un entero ≥ 0.");
  }
  return ok({
    ...input,
    name,
    amount: Math.round(input.amount * 100) / 100,
    notes: input.notes?.trim() || null,
  });
}

/**
 * Advance a date by one period of the given frequency. Pure and deterministic.
 * Monthly/yearly use calendar arithmetic (JS Date normalises overflow, e.g.
 * Jan 31 + 1 month → Mar 3 in non-leap years — acceptable for a personal
 * ledger; day-of-month drift is a known trade-off of calendar recurrence).
 */
export function advance(date: Date, frequency: Frequency): Date {
  const d = new Date(date);
  switch (frequency) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      return d;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      return d;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      return d;
  }
}

/**
 * Roll `nextRunAt` forward until it is strictly after `now`, returning every
 * occurrence that was due at or before `now` plus the new next date. This lets
 * the processor back-fill missed payments (e.g. server was down for a week).
 *
 * `maxCatchUp` caps how many occurrences we generate in one pass, so a payment
 * whose nextRunAt is years in the past can't spin forever.
 */
export function dueOccurrences(
  nextRunAt: Date,
  frequency: Frequency,
  now: Date,
  maxCatchUp = 60,
): { occurrences: Date[]; newNextRunAt: Date } {
  const occurrences: Date[] = [];
  let cursor = new Date(nextRunAt);
  while (cursor.getTime() <= now.getTime() && occurrences.length < maxCatchUp) {
    occurrences.push(new Date(cursor));
    cursor = advance(cursor, frequency);
  }
  return { occurrences, newNextRunAt: cursor };
}

/**
 * Whether a reminder should fire now: reminders are enabled, the payment is
 * active, we haven't already sent one for the current nextRunAt, and we're
 * within the reminder window (remindDaysBefore days before nextRunAt).
 */
export function shouldRemind(payment: RecurringPayment, now: Date): boolean {
  if (!payment.active) return false;
  if (payment.remindDaysBefore == null) return false;
  if (payment.reminderSentAt) return false;
  const windowStart = new Date(payment.nextRunAt);
  windowStart.setDate(windowStart.getDate() - payment.remindDaysBefore);
  return now.getTime() >= windowStart.getTime() &&
    now.getTime() < payment.nextRunAt.getTime();
}
