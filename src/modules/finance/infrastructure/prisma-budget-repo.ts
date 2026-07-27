import "server-only";
import { db } from "@/shared/db";
import type { BudgetRepoPort } from "@/modules/finance/application/ports";
import type { Budget, BudgetInput } from "@/modules/finance/domain/budget";

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
  categoryId: string;
  amount: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: Row): Budget {
  return {
    id: row.id,
    categoryId: row.categoryId,
    amount: toNumber(row.amount),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaBudgetRepo implements BudgetRepoPort {
  async list(): Promise<Budget[]> {
    const rows = await db.budget.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(toDomain);
  }

  async upsert(input: BudgetInput): Promise<Budget> {
    const row = await db.budget.upsert({
      where: { categoryId: input.categoryId },
      create: { categoryId: input.categoryId, amount: input.amount },
      update: { amount: input.amount },
    });
    return toDomain(row);
  }

  async remove(categoryId: string): Promise<void> {
    await db.budget.deleteMany({ where: { categoryId } });
  }
}
