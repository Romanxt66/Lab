import "server-only";
import { db } from "@/shared/db";
import type { RecurringRepoPort } from "@/modules/finance/application/ports";
import type {
  Frequency,
  RecurringPayment,
  RecurringPaymentInput,
} from "@/modules/finance/domain/recurring";
import type { TransactionKind } from "@/modules/finance/domain/transaction";

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  const maybeToNumber = (v as { toNumber?: () => number })?.toNumber;
  return typeof maybeToNumber === "function"
    ? maybeToNumber.call(v)
    : Number(v);
}

type Row = {
  id: string;
  name: string;
  accountId: string;
  categoryId: string | null;
  kind: string;
  amount: unknown;
  frequency: string;
  nextRunAt: Date;
  remindDaysBefore: number | null;
  reminderSentAt: Date | null;
  active: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: Row): RecurringPayment {
  return {
    id: row.id,
    name: row.name,
    accountId: row.accountId,
    categoryId: row.categoryId,
    kind: row.kind as TransactionKind,
    amount: toNumber(row.amount),
    frequency: row.frequency as Frequency,
    nextRunAt: row.nextRunAt,
    remindDaysBefore: row.remindDaysBefore,
    reminderSentAt: row.reminderSentAt,
    active: row.active,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toData(input: RecurringPaymentInput) {
  return {
    name: input.name,
    accountId: input.accountId,
    categoryId: input.categoryId,
    kind: input.kind,
    amount: input.amount,
    frequency: input.frequency,
    nextRunAt: input.nextRunAt,
    remindDaysBefore: input.remindDaysBefore,
    active: input.active,
    notes: input.notes,
  };
}

export class PrismaRecurringRepo implements RecurringRepoPort {
  async list(activeOnly = false): Promise<RecurringPayment[]> {
    const rows = await db.recurringPayment.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { nextRunAt: "asc" },
    });
    return rows.map(toDomain);
  }

  async get(id: string): Promise<RecurringPayment | null> {
    const row = await db.recurringPayment.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async create(input: RecurringPaymentInput): Promise<RecurringPayment> {
    const row = await db.recurringPayment.create({ data: toData(input) });
    return toDomain(row);
  }

  async update(
    id: string,
    input: RecurringPaymentInput,
  ): Promise<RecurringPayment> {
    // Editing resets the reminder flag so the new schedule can notify again.
    const row = await db.recurringPayment.update({
      where: { id },
      data: { ...toData(input), reminderSentAt: null },
    });
    return toDomain(row);
  }

  async remove(id: string): Promise<void> {
    await db.recurringPayment.delete({ where: { id } });
  }

  async markProcessed(id: string, newNextRunAt: Date): Promise<void> {
    await db.recurringPayment.update({
      where: { id },
      data: { nextRunAt: newNextRunAt, reminderSentAt: null },
    });
  }

  async markReminded(id: string, at: Date): Promise<void> {
    await db.recurringPayment.update({
      where: { id },
      data: { reminderSentAt: at },
    });
  }
}
