import "server-only";
import { db } from "@/shared/db";
import type { CategoryRepoPort } from "@/modules/finance/application/ports";
import type {
  CategoryInput,
  CategoryKind,
  TransactionCategory,
} from "@/modules/finance/domain/category";

type Row = {
  id: string;
  name: string;
  kind: string;
  color: string | null;
  createdAt: Date;
};

function toDomain(row: Row): TransactionCategory {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as CategoryKind,
    color: row.color,
    createdAt: row.createdAt,
  };
}

export class PrismaCategoryRepo implements CategoryRepoPort {
  async list(): Promise<TransactionCategory[]> {
    const rows = await db.transactionCategory.findMany({
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });
    return rows.map(toDomain);
  }
  async get(id: string): Promise<TransactionCategory | null> {
    const row = await db.transactionCategory.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }
  async create(input: CategoryInput): Promise<TransactionCategory> {
    const row = await db.transactionCategory.create({
      data: {
        name: input.name,
        kind: input.kind,
        color: input.color ?? null,
      },
    });
    return toDomain(row);
  }
  async update(id: string, input: CategoryInput): Promise<TransactionCategory> {
    const row = await db.transactionCategory.update({
      where: { id },
      data: {
        name: input.name,
        kind: input.kind,
        color: input.color ?? null,
      },
    });
    return toDomain(row);
  }
  async remove(id: string): Promise<void> {
    await db.transactionCategory.delete({ where: { id } });
  }
}
