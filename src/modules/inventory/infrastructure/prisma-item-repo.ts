import "server-only";
import { db } from "@/shared/db";
import type { ItemRepoPort } from "@/modules/inventory/application/ports";
import type {
  InventoryItem,
  ItemInput,
} from "@/modules/inventory/domain/item";

type Row = {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  locationId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: Row): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    unit: row.unit,
    locationId: row.locationId,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaItemRepo implements ItemRepoPort {
  async list(filter?: {
    locationId?: string;
    category?: string;
    search?: string;
  }): Promise<InventoryItem[]> {
    const where: {
      locationId?: string;
      category?: string;
      name?: { contains: string; mode: "insensitive" };
    } = {};
    if (filter?.locationId) where.locationId = filter.locationId;
    if (filter?.category) where.category = filter.category;
    if (filter?.search) {
      where.name = { contains: filter.search, mode: "insensitive" };
    }
    const rows = await db.inventoryItem.findMany({
      where,
      orderBy: { name: "asc" },
    });
    return rows.map(toDomain);
  }

  async get(id: string): Promise<InventoryItem | null> {
    const row = await db.inventoryItem.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async create(input: ItemInput): Promise<InventoryItem> {
    const row = await db.inventoryItem.create({
      data: {
        name: input.name,
        category: input.category,
        quantity: input.quantity,
        unit: input.unit,
        locationId: input.locationId,
        notes: input.notes,
      },
    });
    return toDomain(row);
  }

  async update(id: string, input: ItemInput): Promise<InventoryItem> {
    // quantity is managed by movements, so edits never touch it here.
    const row = await db.inventoryItem.update({
      where: { id },
      data: {
        name: input.name,
        category: input.category,
        unit: input.unit,
        locationId: input.locationId,
        notes: input.notes,
      },
    });
    return toDomain(row);
  }

  async remove(id: string): Promise<void> {
    await db.inventoryItem.delete({ where: { id } });
  }

  async categories(): Promise<string[]> {
    const rows = await db.inventoryItem.findMany({
      where: { category: { not: null } },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    });
    return rows
      .map((r) => r.category)
      .filter((c): c is string => c != null && c.length > 0);
  }
}
