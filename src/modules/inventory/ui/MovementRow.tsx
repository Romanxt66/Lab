"use client";

import {
  ShoppingCart,
  Tag,
  Gift,
  Inbox,
  ArrowRight,
  SlidersHorizontal,
} from "lucide-react";
import {
  MOVEMENT_KIND_LABELS,
  type MovementDTO,
  type MovementKind,
} from "@/modules/inventory/domain/movement";
import type { LocationDTO } from "@/modules/inventory/domain/location";
import { locationPath } from "./location-path";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<MovementKind, React.ComponentType<{ className?: string }>> = {
  bought: ShoppingCart,
  sold: Tag,
  gave_away: Gift,
  received: Inbox,
  moved: ArrowRight,
  adjust: SlidersHorizontal,
};

/** One line in a movement history list. Optionally shows the item name (global
 * history) via `itemLabel`. */
export function MovementRow({
  movement,
  locById,
  itemLabel,
}: {
  movement: MovementDTO;
  locById: Map<string, LocationDTO>;
  itemLabel?: string;
}) {
  const Icon = KIND_ICON[movement.kind];
  const positive = movement.delta > 0;
  const negative = movement.delta < 0;

  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate">
            {itemLabel ? (
              <span className="font-medium">{itemLabel} · </span>
            ) : null}
            {MOVEMENT_KIND_LABELS[movement.kind]}
            {movement.kind === "moved" && movement.toLocationId
              ? ` → ${locationPath(movement.toLocationId, locById)}`
              : ""}
          </span>
          {movement.delta !== 0 ? (
            <span
              className={cn(
                "shrink-0 tabular-nums font-medium",
                positive && "text-success",
                negative && "text-danger",
              )}
            >
              {positive ? "+" : ""}
              {movement.delta}
            </span>
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground">—</span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {formatDate(movement.occurredAt)}
          {movement.notes ? ` · ${movement.notes}` : ""}
        </p>
      </div>
    </li>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
