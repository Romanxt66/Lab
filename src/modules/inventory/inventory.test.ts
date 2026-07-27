import { describe, it, expect } from "vitest";
import {
  validateLocationInput,
  buildLocationTree,
  descendantIds,
  type LocationDTO,
  type LocationInput,
} from "./domain/location";
import { validateItemInput, type ItemInput } from "./domain/item";
import {
  movementDelta,
  validateMovement,
  type MovementInput,
} from "./domain/movement";

// ---- Locations -----------------------------------------------------------

describe("validateLocationInput", () => {
  const base: LocationInput = {
    name: "Habitación",
    kind: "room",
    parentId: null,
    notes: null,
  };
  it("trims the name", () => {
    const r = validateLocationInput({ ...base, name: "  Sala  " });
    expect(r.ok && r.value.name).toBe("Sala");
  });
  it("rejects empty name", () => {
    expect(validateLocationInput({ ...base, name: "  " }).ok).toBe(false);
  });
});

function loc(over: Partial<LocationDTO> & { id: string }): LocationDTO {
  return {
    name: over.name ?? over.id,
    kind: over.kind ?? "place",
    parentId: over.parentId ?? null,
    notes: over.notes ?? null,
    id: over.id,
  };
}

describe("buildLocationTree", () => {
  it("nests children under their parent and counts items", () => {
    const tree = buildLocationTree(
      [
        loc({ id: "room" }),
        loc({ id: "box", parentId: "room" }),
        loc({ id: "shelf", parentId: "box" }),
      ],
      new Map([["box", 3]]),
    );
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("room");
    expect(tree[0].children[0].id).toBe("box");
    expect(tree[0].children[0].itemCount).toBe(3);
    expect(tree[0].children[0].children[0].id).toBe("shelf");
  });
  it("treats orphans (missing parent) as roots", () => {
    const tree = buildLocationTree([loc({ id: "a", parentId: "ghost" })]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("a");
  });
});

describe("descendantIds", () => {
  it("collects the node and all descendants", () => {
    const all = [
      loc({ id: "room" }),
      loc({ id: "box", parentId: "room" }),
      loc({ id: "shelf", parentId: "box" }),
      loc({ id: "other" }),
    ];
    const ids = descendantIds("room", all);
    expect([...ids].sort()).toEqual(["box", "room", "shelf"]);
    expect(ids.has("other")).toBe(false);
  });
});

// ---- Items ---------------------------------------------------------------

describe("validateItemInput", () => {
  const base: ItemInput = {
    name: "Taladro",
    category: "  Herramientas  ",
    quantity: 2,
    unit: null,
    locationId: null,
    notes: null,
  };
  it("trims the category", () => {
    const r = validateItemInput(base);
    expect(r.ok && r.value.category).toBe("Herramientas");
  });
  it("rejects negative quantity", () => {
    expect(validateItemInput({ ...base, quantity: -1 }).ok).toBe(false);
  });
  it("rejects non-integer quantity", () => {
    expect(validateItemInput({ ...base, quantity: 1.5 }).ok).toBe(false);
  });
});

// ---- Movements -----------------------------------------------------------

describe("movementDelta", () => {
  it("adds for bought/received", () => {
    expect(movementDelta("bought", 3)).toBe(3);
    expect(movementDelta("received", 2)).toBe(2);
  });
  it("subtracts for sold/gave_away", () => {
    expect(movementDelta("sold", 3)).toBe(-3);
    expect(movementDelta("gave_away", 1)).toBe(-1);
  });
  it("is zero for moved", () => {
    expect(movementDelta("moved", 5)).toBe(0);
  });
  it("passes through the sign for adjust", () => {
    expect(movementDelta("adjust", -4)).toBe(-4);
    expect(movementDelta("adjust", 6)).toBe(6);
  });
});

describe("validateMovement", () => {
  const base: MovementInput = {
    itemId: "i1",
    kind: "sold",
    quantity: 2,
    toLocationId: null,
    notes: null,
    occurredAt: new Date("2026-05-01T12:00:00"),
  };
  it("rejects selling more than in stock", () => {
    const r = validateMovement({ ...base, quantity: 5 }, 3);
    expect(r.ok).toBe(false);
  });
  it("allows selling exactly the stock", () => {
    const r = validateMovement({ ...base, quantity: 3 }, 3);
    expect(r.ok && r.value.delta).toBe(-3);
  });
  it("requires a destination for moved", () => {
    expect(
      validateMovement({ ...base, kind: "moved", toLocationId: null }, 3).ok,
    ).toBe(false);
    const okRes = validateMovement(
      { ...base, kind: "moved", toLocationId: "loc1" },
      3,
    );
    expect(okRes.ok && okRes.value.toLocationId).toBe("loc1");
  });
  it("allows adjust to go negative delta but not below zero stock", () => {
    expect(validateMovement({ ...base, kind: "adjust", quantity: -2 }, 3).ok).toBe(
      true,
    );
    expect(validateMovement({ ...base, kind: "adjust", quantity: -5 }, 3).ok).toBe(
      false,
    );
  });
});
