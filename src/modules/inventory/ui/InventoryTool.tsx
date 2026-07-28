"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ItemsPanel } from "./ItemsPanel";
import { LocationsPanel } from "./LocationsPanel";
import { HistoryPanel } from "./HistoryPanel";
import {
  listLocationsAction,
  itemCategoriesAction,
} from "@/modules/inventory/actions";
import type { LocationDTO } from "@/modules/inventory/domain/location";

type Tab = "items" | "locations" | "history";

/**
 * Root of the inventory tool. Owns the locations + categories caches shared by
 * the panels; each panel manages its own item/movement lists.
 */
export function InventoryTool() {
  const [tab, setTab] = React.useState<Tab>("items");
  const [locations, setLocations] = React.useState<LocationDTO[]>([]);
  const [categories, setCategories] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refreshLocations = React.useCallback(async () => {
    setLocations(await listLocationsAction());
  }, []);
  const refreshCategories = React.useCallback(async () => {
    setCategories(await itemCategoriesAction());
  }, []);

  React.useEffect(() => {
    void (async () => {
      try {
        await Promise.all([refreshLocations(), refreshCategories()]);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshLocations, refreshCategories]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-md border border-border p-0.5">
        {(
          [
            { id: "items", label: "Artículos" },
            { id: "locations", label: "Ubicaciones" },
            { id: "history", label: "Historial" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded px-3 py-1 text-sm transition-colors",
              tab === t.id
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "items" ? (
        <ItemsPanel
          locations={locations}
          categories={categories}
          onCategoriesChanged={refreshCategories}
        />
      ) : null}

      {tab === "locations" ? (
        <LocationsPanel
          locations={locations}
          onChanged={refreshLocations}
        />
      ) : null}

      {tab === "history" ? <HistoryPanel locations={locations} /> : null}
    </div>
  );
}
