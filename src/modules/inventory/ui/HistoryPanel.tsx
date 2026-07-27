"use client";

import * as React from "react";
import { Loader2, History } from "lucide-react";
import {
  recentMovementsAction,
  listItemsAction,
} from "@/modules/inventory/actions";
import type { MovementDTO } from "@/modules/inventory/domain/movement";
import type { LocationDTO } from "@/modules/inventory/domain/location";
import { MovementRow } from "./MovementRow";
import { locationMap } from "./location-path";

export function HistoryPanel({ locations }: { locations: LocationDTO[] }) {
  const [movements, setMovements] = React.useState<MovementDTO[]>([]);
  const [itemNames, setItemNames] = React.useState<Map<string, string>>(
    new Map(),
  );
  const [loading, setLoading] = React.useState(true);

  const locById = React.useMemo(() => locationMap(locations), [locations]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [moves, items] = await Promise.all([
          recentMovementsAction(100),
          listItemsAction(),
        ]);
        if (cancelled) return;
        setMovements(moves);
        setItemNames(new Map(items.map((i) => [i.id, i.name])));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Historial</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Últimos movimientos de todo el inventario.
        </p>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </p>
      ) : movements.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
          <History className="mx-auto mb-2 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aún no hay movimientos registrados.
          </p>
        </div>
      ) : (
        <ul className="glass divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
          {movements.map((m) => (
            <MovementRow
              key={m.id}
              movement={m}
              locById={locById}
              itemLabel={itemNames.get(m.itemId) ?? "Artículo eliminado"}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
