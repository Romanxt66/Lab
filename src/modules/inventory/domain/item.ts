import { type Result, ok, err } from "@/shared/kernel/result";

export interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  locationId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ItemInput {
  name: string;
  category: string | null;
  /** Starting quantity for a new item; ignored on update (see movements). */
  quantity: number;
  unit: string | null;
  locationId: string | null;
  notes: string | null;
}

export interface ItemDTO {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  locationId: string | null;
  notes: string | null;
}

export function toItemDTO(i: InventoryItem): ItemDTO {
  return {
    id: i.id,
    name: i.name,
    category: i.category,
    quantity: i.quantity,
    unit: i.unit,
    locationId: i.locationId,
    notes: i.notes,
  };
}

export function validateItemInput(input: ItemInput): Result<ItemInput> {
  const name = input.name.trim();
  if (!name) return err("El nombre no puede estar vacío.");
  if (!Number.isFinite(input.quantity) || !Number.isInteger(input.quantity)) {
    return err("La cantidad debe ser un número entero.");
  }
  if (input.quantity < 0) return err("La cantidad no puede ser negativa.");
  return ok({
    ...input,
    name,
    category: input.category?.trim() || null,
    unit: input.unit?.trim() || null,
    notes: input.notes?.trim() || null,
  });
}
