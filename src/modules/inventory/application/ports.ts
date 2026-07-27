import type {
  InventoryLocation,
  LocationInput,
} from "@/modules/inventory/domain/location";
import type {
  InventoryItem,
  ItemInput,
} from "@/modules/inventory/domain/item";
import type {
  InventoryMovement,
  ValidatedMovement,
} from "@/modules/inventory/domain/movement";

export interface LocationRepoPort {
  list(): Promise<InventoryLocation[]>;
  get(id: string): Promise<InventoryLocation | null>;
  create(input: LocationInput): Promise<InventoryLocation>;
  update(id: string, input: LocationInput): Promise<InventoryLocation>;
  remove(id: string): Promise<void>;
  /** Map of locationId → number of items directly in it. */
  itemCounts(): Promise<Map<string, number>>;
}

export interface ItemRepoPort {
  list(filter?: {
    locationId?: string;
    category?: string;
    search?: string;
  }): Promise<InventoryItem[]>;
  get(id: string): Promise<InventoryItem | null>;
  create(input: ItemInput): Promise<InventoryItem>;
  update(id: string, input: ItemInput): Promise<InventoryItem>;
  remove(id: string): Promise<void>;
  /** Distinct non-null categories currently in use. */
  categories(): Promise<string[]>;
}

export interface MovementRepoPort {
  listForItem(itemId: string, limit?: number): Promise<InventoryMovement[]>;
  listRecent(limit?: number): Promise<InventoryMovement[]>;
  /**
   * Persist a movement AND apply its effects atomically: adjust the item's
   * quantity by `delta`, and for a "moved" movement update the item's location.
   */
  record(movement: ValidatedMovement): Promise<InventoryMovement>;
}
