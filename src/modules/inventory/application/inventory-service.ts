import { type Result, ok, err } from "@/shared/kernel/result";
import {
  validateLocationInput,
  descendantIds,
  toLocationDTO,
  type InventoryLocation,
  type LocationInput,
} from "@/modules/inventory/domain/location";
import {
  validateItemInput,
  type InventoryItem,
  type ItemInput,
} from "@/modules/inventory/domain/item";
import {
  validateMovement,
  type InventoryMovement,
  type MovementInput,
} from "@/modules/inventory/domain/movement";
import type { LocationRepoPort, ItemRepoPort, MovementRepoPort } from "./ports";

/**
 * Orchestrates the inventory domain. The movement flow is the crux: every
 * quantity change goes through `recordMovement`, which validates against the
 * item's current stock and delegates the atomic apply to the repo.
 */
export class InventoryService {
  constructor(
    private readonly locations: LocationRepoPort,
    private readonly items: ItemRepoPort,
    private readonly movements: MovementRepoPort,
  ) {}

  // -- Locations ----------------------------------------------------------

  listLocations(): Promise<InventoryLocation[]> {
    return this.locations.list();
  }

  locationItemCounts(): Promise<Map<string, number>> {
    return this.locations.itemCounts();
  }

  async saveLocation(
    input: LocationInput & { id?: string },
  ): Promise<Result<InventoryLocation>> {
    const valid = validateLocationInput(input);
    if (!valid.ok) return valid;

    // Guard against cycles: a location can't be parented to itself or any of
    // its own descendants.
    if (input.id && valid.value.parentId) {
      const all = (await this.locations.list()).map(toLocationDTO);
      const forbidden = descendantIds(input.id, all);
      if (forbidden.has(valid.value.parentId)) {
        return err(
          "No puedes mover una ubicación dentro de sí misma o de una sub-ubicación suya.",
        );
      }
    }

    return ok(
      input.id
        ? await this.locations.update(input.id, valid.value)
        : await this.locations.create(valid.value),
    );
  }

  async removeLocation(id: string): Promise<void> {
    await this.locations.remove(id);
  }

  // -- Items --------------------------------------------------------------

  listItems(filter?: {
    locationId?: string;
    category?: string;
    search?: string;
  }): Promise<InventoryItem[]> {
    return this.items.list(filter);
  }

  getItem(id: string): Promise<InventoryItem | null> {
    return this.items.get(id);
  }

  itemCategories(): Promise<string[]> {
    return this.items.categories();
  }

  async saveItem(
    input: ItemInput & { id?: string },
  ): Promise<Result<InventoryItem>> {
    const valid = validateItemInput(input);
    if (!valid.ok) return valid;
    return ok(
      input.id
        ? await this.items.update(input.id, valid.value)
        : await this.items.create(valid.value),
    );
  }

  async removeItem(id: string): Promise<void> {
    await this.items.remove(id);
  }

  // -- Movements ----------------------------------------------------------

  listMovements(itemId: string, limit?: number): Promise<InventoryMovement[]> {
    return this.movements.listForItem(itemId, limit);
  }

  recentMovements(limit?: number): Promise<InventoryMovement[]> {
    return this.movements.listRecent(limit);
  }

  /**
   * Record a stock movement. Validates against the item's current quantity
   * (rejecting negative stock for non-adjust kinds) before applying.
   */
  async recordMovement(
    input: MovementInput,
  ): Promise<Result<InventoryMovement>> {
    const item = await this.items.get(input.itemId);
    if (!item) return err("El artículo ya no existe.");
    const valid = validateMovement(input, item.quantity);
    if (!valid.ok) return valid;
    return ok(await this.movements.record(valid.value));
  }
}
