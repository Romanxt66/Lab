import "server-only";
import { db } from "@/shared/db";
import type { MovementRepoPort } from "@/modules/inventory/application/ports";
import type {
  InventoryMovement,
  MovementKind,
  ValidatedMovement,
} from "@/modules/inventory/domain/movement";

type Row = {
  id: string;
  itemId: string;
  kind: string;
  delta: number;
  toLocationId: string | null;
  notes: string | null;
  occurredAt: Date;
  createdAt: Date;
};

function toDomain(row: Row): InventoryMovement {
  return {
    id: row.id,
    itemId: row.itemId,
    kind: row.kind as MovementKind,
    delta: row.delta,
    toLocationId: row.toLocationId,
    notes: row.notes,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
  };
}

export class PrismaMovementRepo implements MovementRepoPort {
  async listForItem(itemId: string, limit = 100): Promise<InventoryMovement[]> {
    const rows = await db.inventoryMovement.findMany({
      where: { itemId },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
    return rows.map(toDomain);
  }

  async listRecent(limit = 50): Promise<InventoryMovement[]> {
    const rows = await db.inventoryMovement.findMany({
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
    return rows.map(toDomain);
  }

  /**
   * Persist the movement and apply its effects in one transaction: bump the
   * item's quantity by `delta`, and for a relocation set the item's location.
   */
  async record(movement: ValidatedMovement): Promise<InventoryMovement> {
    const created = await db.$transaction(async (tx) => {
      const row = await tx.inventoryMovement.create({
        data: {
          itemId: movement.itemId,
          kind: movement.kind,
          delta: movement.delta,
          toLocationId: movement.toLocationId,
          notes: movement.notes,
          occurredAt: movement.occurredAt,
        },
      });

      const data: { quantity?: { increment: number }; locationId?: string } = {};
      if (movement.delta !== 0) data.quantity = { increment: movement.delta };
      if (movement.kind === "moved" && movement.toLocationId) {
        data.locationId = movement.toLocationId;
      }
      if (Object.keys(data).length > 0) {
        await tx.inventoryItem.update({
          where: { id: movement.itemId },
          data,
        });
      }
      return row;
    });
    return toDomain(created);
  }
}
