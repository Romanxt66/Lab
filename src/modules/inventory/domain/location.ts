import { type Result, ok, err } from "@/shared/kernel/result";

export type LocationKind = "room" | "box" | "shelf" | "place";
export const LOCATION_KINDS: LocationKind[] = ["room", "box", "shelf", "place"];

export const LOCATION_KIND_LABELS: Record<LocationKind, string> = {
  room: "Habitación",
  box: "Caja",
  shelf: "Estante",
  place: "Lugar",
};

export interface InventoryLocation {
  id: string;
  name: string;
  kind: LocationKind;
  parentId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationInput {
  name: string;
  kind: LocationKind;
  parentId: string | null;
  notes: string | null;
}

export interface LocationDTO {
  id: string;
  name: string;
  kind: LocationKind;
  parentId: string | null;
  notes: string | null;
}

export function toLocationDTO(l: InventoryLocation): LocationDTO {
  return {
    id: l.id,
    name: l.name,
    kind: l.kind,
    parentId: l.parentId,
    notes: l.notes,
  };
}

export function validateLocationInput(
  input: LocationInput,
): Result<LocationInput> {
  const name = input.name.trim();
  if (!name) return err("El nombre no puede estar vacío.");
  if (!LOCATION_KINDS.includes(input.kind)) {
    return err(`Tipo de ubicación desconocido: ${input.kind}`);
  }
  return ok({ ...input, name, notes: input.notes?.trim() || null });
}

export interface LocationNode extends LocationDTO {
  children: LocationNode[];
  itemCount: number;
}

/**
 * Build a nested tree from a flat list. Locations whose parent is missing (or
 * null) become roots. Cycles are impossible to render infinitely because each
 * node is placed exactly once by id. `counts` maps locationId → item count.
 */
export function buildLocationTree(
  locations: LocationDTO[],
  counts: Map<string, number> = new Map(),
): LocationNode[] {
  const nodes = new Map<string, LocationNode>();
  for (const l of locations) {
    nodes.set(l.id, { ...l, children: [], itemCount: counts.get(l.id) ?? 0 });
  }
  const roots: LocationNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : null;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }
  const sortRec = (list: LocationNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name, "es"));
    for (const n of list) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

/**
 * Collect the id of a location and all its descendants — used to prevent
 * assigning a location's own subtree as its parent (which would create a cycle).
 */
export function descendantIds(
  locationId: string,
  locations: LocationDTO[],
): Set<string> {
  const childrenOf = new Map<string | null, LocationDTO[]>();
  for (const l of locations) {
    const list = childrenOf.get(l.parentId) ?? [];
    list.push(l);
    childrenOf.set(l.parentId, list);
  }
  const result = new Set<string>([locationId]);
  const stack = [locationId];
  while (stack.length) {
    const current = stack.pop()!;
    for (const child of childrenOf.get(current) ?? []) {
      if (!result.has(child.id)) {
        result.add(child.id);
        stack.push(child.id);
      }
    }
  }
  return result;
}
