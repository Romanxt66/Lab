import "server-only";
import { db } from "@/shared/db";
import type { AccountRepoPort } from "@/modules/finance/application/ports";
import type {
  AccountInput,
  AccountKind,
  FinancialAccount,
} from "@/modules/finance/domain/account";

/** Prisma Decimal → JS number. Prisma types the field as string | number | Decimal-like. */
function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  // Prisma.Decimal has toNumber(). Fall back to Number() otherwise.
  const maybeToNumber = (v as { toNumber?: () => number })?.toNumber;
  return typeof maybeToNumber === "function"
    ? maybeToNumber.call(v)
    : Number(v);
}

type Row = {
  id: string;
  name: string;
  kind: string;
  currency: string;
  initialBalance: unknown;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: Row): FinancialAccount {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as AccountKind,
    currency: row.currency,
    initialBalance: toNumber(row.initialBalance),
    archived: row.archived,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaAccountRepo implements AccountRepoPort {
  async list(includeArchived = false): Promise<FinancialAccount[]> {
    const rows = await db.financialAccount.findMany({
      where: includeArchived ? undefined : { archived: false },
      orderBy: [{ archived: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toDomain);
  }
  async get(id: string): Promise<FinancialAccount | null> {
    const row = await db.financialAccount.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }
  async create(input: AccountInput): Promise<FinancialAccount> {
    const row = await db.financialAccount.create({
      data: {
        name: input.name,
        kind: input.kind,
        currency: input.currency,
        initialBalance: input.initialBalance,
        archived: input.archived,
      },
    });
    return toDomain(row);
  }
  async update(id: string, input: AccountInput): Promise<FinancialAccount> {
    const row = await db.financialAccount.update({
      where: { id },
      data: {
        name: input.name,
        kind: input.kind,
        currency: input.currency,
        initialBalance: input.initialBalance,
        archived: input.archived,
      },
    });
    return toDomain(row);
  }
  async remove(id: string): Promise<void> {
    await db.financialAccount.delete({ where: { id } });
  }
}
