"use server";

import { type Result, ok } from "@/shared/kernel/result";
import { getInventoryService } from "@/shared/di/container";
import {
  toLocationDTO,
  buildLocationTree,
  type LocationDTO,
  type LocationKind,
  type LocationNode,
} from "@/modules/inventory/domain/location";
import {
  toItemDTO,
  type ItemDTO,
} from "@/modules/inventory/domain/item";
import {
  toMovementDTO,
  type MovementDTO,
  type MovementKind,
} from "@/modules/inventory/domain/movement";

// --- Locations -------------------------------------------------------------

export async function listLocationsAction(): Promise<LocationDTO[]> {
  const rows = await getInventoryService().listLocations();
  return rows.map(toLocationDTO);
}

export async function locationTreeAction(): Promise<LocationNode[]> {
  const svc = getInventoryService();
  const [locations, counts] = await Promise.all([
    svc.listLocations(),
    svc.locationItemCounts(),
  ]);
  return buildLocationTree(locations.map(toLocationDTO), counts);
}

export async function saveLocationAction(input: {
  id?: string;
  name: string;
  kind: LocationKind;
  parentId: string | null;
  notes: string | null;
}): Promise<Result<LocationDTO>> {
  const res = await getInventoryService().saveLocation(input);
  return res.ok ? ok(toLocationDTO(res.value)) : res;
}

export async function deleteLocationAction(id: string): Promise<void> {
  await getInventoryService().removeLocation(id);
}

// --- Items -----------------------------------------------------------------

export async function listItemsAction(filter?: {
  locationId?: string;
  category?: string;
  search?: string;
}): Promise<ItemDTO[]> {
  const rows = await getInventoryService().listItems(filter);
  return rows.map(toItemDTO);
}

export async function itemCategoriesAction(): Promise<string[]> {
  return getInventoryService().itemCategories();
}

export async function saveItemAction(input: {
  id?: string;
  name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  locationId: string | null;
  notes: string | null;
}): Promise<Result<ItemDTO>> {
  const res = await getInventoryService().saveItem(input);
  return res.ok ? ok(toItemDTO(res.value)) : res;
}

export async function deleteItemAction(id: string): Promise<void> {
  await getInventoryService().removeItem(id);
}

// --- Movements -------------------------------------------------------------

export async function listMovementsAction(
  itemId: string,
  limit?: number,
): Promise<MovementDTO[]> {
  const rows = await getInventoryService().listMovements(itemId, limit);
  return rows.map(toMovementDTO);
}

export async function recentMovementsAction(
  limit?: number,
): Promise<MovementDTO[]> {
  const rows = await getInventoryService().recentMovements(limit);
  return rows.map(toMovementDTO);
}

export async function recordMovementAction(input: {
  itemId: string;
  kind: MovementKind;
  quantity: number;
  toLocationId: string | null;
  notes: string | null;
  /** ISO string from the client. */
  occurredAt: string;
}): Promise<Result<MovementDTO>> {
  const res = await getInventoryService().recordMovement({
    itemId: input.itemId,
    kind: input.kind,
    quantity: input.quantity,
    toLocationId: input.toLocationId,
    notes: input.notes,
    occurredAt: new Date(input.occurredAt),
  });
  return res.ok ? ok(toMovementDTO(res.value)) : res;
}
