import { type Result, ok, err } from "@/shared/kernel/result";

export type MovementKind =
  | "bought"
  | "sold"
  | "gave_away"
  | "received"
  | "moved"
  | "adjust";

export const MOVEMENT_KINDS: MovementKind[] = [
  "bought",
  "sold",
  "gave_away",
  "received",
  "moved",
  "adjust",
];

export const MOVEMENT_KIND_LABELS: Record<MovementKind, string> = {
  bought: "Comprado",
  sold: "Vendido",
  gave_away: "Regalado",
  received: "Recibido",
  moved: "Movido",
  adjust: "Ajuste",
};

/**
 * The sign each movement applies to quantity. `moved` relocates without
 * changing the count; `adjust` carries its own signed delta (manual correction).
 */
export const MOVEMENT_SIGN: Record<MovementKind, 1 | -1 | 0> = {
  bought: 1,
  received: 1,
  sold: -1,
  gave_away: -1,
  moved: 0,
  adjust: 1, // caller passes an already-signed magnitude for adjust
};

export interface InventoryMovement {
  id: string;
  itemId: string;
  kind: MovementKind;
  delta: number;
  toLocationId: string | null;
  notes: string | null;
  occurredAt: Date;
  createdAt: Date;
}

export interface MovementInput {
  itemId: string;
  kind: MovementKind;
  /** Magnitude the user entered (always ≥ 0 except for `adjust`, where it may be signed). */
  quantity: number;
  toLocationId: string | null;
  notes: string | null;
  occurredAt: Date;
}

export interface MovementDTO {
  id: string;
  itemId: string;
  kind: MovementKind;
  delta: number;
  toLocationId: string | null;
  notes: string | null;
  occurredAt: string;
}

export function toMovementDTO(m: InventoryMovement): MovementDTO {
  return {
    id: m.id,
    itemId: m.itemId,
    kind: m.kind,
    delta: m.delta,
    toLocationId: m.toLocationId,
    notes: m.notes,
    occurredAt: m.occurredAt.toISOString(),
  };
}

/** Compute the signed delta a movement applies, given the user's magnitude. */
export function movementDelta(kind: MovementKind, quantity: number): number {
  if (kind === "moved") return 0;
  if (kind === "adjust") return Math.trunc(quantity); // may be + or -
  return MOVEMENT_SIGN[kind] * Math.abs(Math.trunc(quantity));
}

export interface ValidatedMovement {
  itemId: string;
  kind: MovementKind;
  delta: number;
  toLocationId: string | null;
  notes: string | null;
  occurredAt: Date;
}

/**
 * Validate a movement against the item's current quantity. Rejects moves that
 * would drive stock negative (except `adjust`, which is a deliberate override).
 */
export function validateMovement(
  input: MovementInput,
  currentQuantity: number,
): Result<ValidatedMovement> {
  if (!input.itemId) return err("Falta el artículo.");
  if (!MOVEMENT_KINDS.includes(input.kind)) {
    return err(`Tipo de movimiento desconocido: ${input.kind}`);
  }
  if (!Number.isFinite(input.quantity)) {
    return err("La cantidad no es válida.");
  }
  if (input.kind === "moved" && !input.toLocationId) {
    return err("Elige la ubicación de destino para un movimiento.");
  }
  if (input.kind !== "adjust" && input.kind !== "moved" && input.quantity <= 0) {
    return err("La cantidad debe ser mayor que 0.");
  }
  const delta = movementDelta(input.kind, input.quantity);
  const resulting = currentQuantity + delta;
  if (resulting < 0) {
    return err(
      `No hay stock suficiente: quedan ${currentQuantity} y el movimiento resta ${Math.abs(delta)}.`,
    );
  }
  return ok({
    itemId: input.itemId,
    kind: input.kind,
    delta,
    toLocationId: input.kind === "moved" ? input.toLocationId : null,
    notes: input.notes?.trim() || null,
    occurredAt: input.occurredAt,
  });
}
