import "server-only";
import { db } from "@/shared/db";
import type { LocationRepoPort } from "@/modules/inventory/application/ports";
import type {
  InventoryLocation,
  LocationInput,
  LocationKind,
} from "@/modules/inventory/domain/location";

type Row = {
  id: string;
  name: string;
  kind: string;
  parentId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDomain(row: Row): InventoryLocation {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as LocationKind,
    parentId: row.parentId,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toData(input: LocationInput) {
  return {
    name: input.name,
    kind: input.kind,
    parentId: input.parentId,
    notes: input.notes,
  };
}

export class PrismaLocationRepo implements LocationRepoPort {
  async list(): Promise<InventoryLocation[]> {
    const rows = await db.inventoryLocation.findMany({
      orderBy: { name: "asc" },
    });
    return rows.map(toDomain);
  }

  async get(id: string): Promise<InventoryLocation | null> {
    const row = await db.inventoryLocation.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async create(input: LocationInput): Promise<InventoryLocation> {
    const row = await db.inventoryLocation.create({ data: toData(input) });
    return toDomain(row);
  }

  async update(id: string, input: LocationInput): Promise<InventoryLocation> {
    const row = await db.inventoryLocation.update({
      where: { id },
      data: toData(input),
    });
    return toDomain(row);
  }

  async remove(id: string): Promise<void> {
    await db.inventoryLocation.delete({ where: { id } });
  }

  async itemCounts(): Promise<Map<string, number>> {
    const groups = await db.inventoryItem.groupBy({
      by: ["locationId"],
      _count: { _all: true },
    });
    const map = new Map<string, number>();
    for (const g of groups) {
      if (g.locationId) map.set(g.locationId, g._count._all);
    }
    return map;
  }
}
