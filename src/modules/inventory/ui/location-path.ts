import type { LocationDTO } from "@/modules/inventory/domain/location";

/**
 * Build a "Casa › Habitación › Caja" path label for a location by walking up
 * the parent chain. Guards against cycles with a visited set.
 */
export function locationPath(
  locationId: string | null,
  byId: Map<string, LocationDTO>,
): string {
  if (!locationId) return "Sin ubicación";
  const parts: string[] = [];
  const seen = new Set<string>();
  let current: string | null = locationId;
  while (current && !seen.has(current)) {
    seen.add(current);
    const loc = byId.get(current);
    if (!loc) break;
    parts.unshift(loc.name);
    current = loc.parentId;
  }
  return parts.length ? parts.join(" › ") : "Sin ubicación";
}

export function locationMap(locations: LocationDTO[]): Map<string, LocationDTO> {
  const map = new Map<string, LocationDTO>();
  for (const l of locations) map.set(l.id, l);
  return map;
}
