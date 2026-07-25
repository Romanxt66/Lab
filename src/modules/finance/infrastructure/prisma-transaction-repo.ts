import "server-only";
import { db } from "@/shared/db";
import type { TransactionRepoPort } from "@/modules/finance/application/ports";
import type {
  FinancialTransaction,
  TransactionInput,
  TransactionKind,
} from "@/modules/finance/domain/transaction";

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
  accountId: string;
  categoryId: string | null;
  kind: string;
  amount: unknown;
  occurredAt: Date;
  notes: string | null;
  createdAt: Date;
};

function toDomain(row: Row): FinancialTransaction {
  return {
    id: row.id,
    accountId: row.accountId,
    categoryId: row.categoryId,
    kind: row.kind as TransactionKind,
    amount: toNumber(row.amount),
    occurredAt: row.occurredAt,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

export class PrismaTransactionRepo implements TransactionRepoPort {
  async list(filter?: {
    accountId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<FinancialTransaction[]> {
    const where: {
      accountId?: string;
      occurredAt?: { gte?: Date; lt?: Date };
    } = {};
    if (filter?.accountId) where.accountId = filter.accountId;
    if (filter?.from || filter?.to) {
      where.occurredAt = {};
      if (filter?.from) where.occurredAt.gte = filter.from;
      if (filter?.to) where.occurredAt.lt = filter.to;
    }
    const rows = await db.financialTransaction.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: filter?.limit,
    });
    return rows.map(toDomain);
  }

  async get(id: string): Promise<FinancialTransaction | null> {
    const row = await db.financialTransaction.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async create(input: TransactionInput): Promise<FinancialTransaction> {
    const row = await db.financialTransaction.create({
      data: {
        accountId: input.accountId,
        categoryId: input.categoryId,
        kind: input.kind,
        amount: input.amount,
        occurredAt: input.occurredAt,
        notes: input.notes,
      },
    });
    return toDomain(row);
  }

  async update(
    id: string,
    input: TransactionInput,
  ): Promise<FinancialTransaction> {
    const row = await db.financialTransaction.update({
      where: { id },
      data: {
        accountId: input.accountId,
        categoryId: input.categoryId,
        kind: input.kind,
        amount: input.amount,
        occurredAt: input.occurredAt,
        notes: input.notes,
      },
    });
    return toDomain(row);
  }

  async remove(id: string): Promise<void> {
    await db.financialTransaction.delete({ where: { id } });
  }
}
