"use client";

import * as React from "react";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Search,
  ArrowLeftRight,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import {
  listItemsAction,
  saveItemAction,
  deleteItemAction,
} from "@/modules/inventory/actions";
import type { ItemDTO } from "@/modules/inventory/domain/item";
import type { LocationDTO } from "@/modules/inventory/domain/location";
import { LOCATION_KIND_LABELS } from "@/modules/inventory/domain/location";
import { locationMap, locationPath } from "./location-path";
import { MovementDialog } from "./MovementDialog";
import { cn } from "@/lib/utils";

export function ItemsPanel({
  locations,
  categories,
  onCategoriesChanged,
}: {
  locations: LocationDTO[];
  categories: string[];
  onCategoriesChanged: () => void | Promise<void>;
}) {
  const [items, setItems] = React.useState<ItemDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<ItemDTO | null>(null);
  const [moving, setMoving] = React.useState<ItemDTO | null>(null);
  const [search, setSearch] = React.useState("");
  const [filterLocation, setFilterLocation] = React.useState("");
  const [filterCategory, setFilterCategory] = React.useState("");

  const locById = React.useMemo(() => locationMap(locations), [locations]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      setItems(
        await listItemsAction({
          locationId: filterLocation || undefined,
          category: filterCategory || undefined,
          search: search.trim() || undefined,
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [filterLocation, filterCategory, search]);

  React.useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function afterItemChange() {
    setCreating(false);
    setEditing(null);
    await refresh();
    await onCategoriesChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Artículos</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Lo que tienes y gestionas, con cantidad y ubicación.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
        >
          <Plus />
          Nuevo
        </Button>
      </div>

      {/* Filters */}
      <div className="glass flex flex-wrap items-center gap-3 rounded-lg border border-border/60 p-3">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre…"
            className="h-8 pl-8"
          />
        </div>
        <select
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          <option value="">Todas las ubicaciones</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {categories.length > 0 ? (
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {creating || editing ? (
        <ItemForm
          item={editing}
          locations={locations}
          categories={categories}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={afterItemChange}
        />
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          Sin artículos con estos filtros.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="glass group flex flex-col gap-3 rounded-lg border border-border/60 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex size-9 items-center justify-center rounded-md border border-border/60 bg-foreground/5">
                  <Package className="size-[18px]" />
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums",
                    item.quantity === 0
                      ? "bg-danger/10 text-danger"
                      : "bg-foreground/5",
                  )}
                >
                  {item.quantity}
                  {item.unit ? ` ${item.unit}` : ""}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {locationPath(item.locationId, locById)}
                  {item.category ? ` · ${item.category}` : ""}
                </p>
                {item.notes ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {item.notes}
                  </p>
                ) : null}
              </div>
              <div className="mt-auto flex items-center gap-1 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setMoving(item)}
                >
                  <ArrowLeftRight className="size-3.5" />
                  Movimiento
                </Button>
                <button
                  onClick={() => {
                    setCreating(false);
                    setEditing(item);
                  }}
                  className="rounded p-1.5 text-muted-foreground hover:text-foreground"
                  title="Editar"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={async () => {
                    if (
                      confirm(
                        `¿Eliminar "${item.name}" y todo su historial de movimientos?`,
                      )
                    ) {
                      await deleteItemAction(item.id);
                      await afterItemChange();
                    }
                  }}
                  className="rounded p-1.5 text-muted-foreground hover:text-danger"
                  title="Eliminar"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {moving ? (
        <MovementDialog
          item={moving}
          locations={locations}
          onClose={() => setMoving(null)}
          onRecorded={async () => {
            setMoving(null);
            await refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function ItemForm({
  item,
  locations,
  categories,
  onClose,
  onSaved,
}: {
  item: ItemDTO | null;
  locations: LocationDTO[];
  categories: string[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = React.useState(item?.name ?? "");
  const [category, setCategory] = React.useState(item?.category ?? "");
  const [quantity, setQuantity] = React.useState(item?.quantity.toString() ?? "0");
  const [unit, setUnit] = React.useState(item?.unit ?? "");
  const [locationId, setLocationId] = React.useState(item?.locationId ?? "");
  const [notes, setNotes] = React.useState(item?.notes ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const parsed = parseInt(quantity, 10);
      const res = await saveItemAction({
        id: item?.id,
        name,
        category: category || null,
        quantity: Number.isFinite(parsed) ? parsed : 0,
        unit: unit || null,
        locationId: locationId || null,
        notes: notes || null,
      });
      if (res.ok) await onSaved();
      else setError(res.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass space-y-3 rounded-lg border border-border/60 p-4">
      <h3 className="text-sm font-medium">
        {item ? "Editar artículo" : "Nuevo artículo"}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="it-name">Nombre</Label>
          <Input
            id="it-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Taladro, Libro X…"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="it-category">Categoría</Label>
          <Input
            id="it-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Herramientas…"
            list="inv-categories"
          />
          <datalist id="inv-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="it-qty">
              Cantidad {item ? "" : "inicial"}
            </Label>
            <Input
              id="it-qty"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="numeric"
              className="font-mono"
              disabled={!!item}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="it-unit">Unidad</Label>
            <Input
              id="it-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="u, kg…"
            />
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="it-location">Ubicación</Label>
          <select
            id="it-location"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Sin ubicación</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({LOCATION_KIND_LABELS[l.kind]})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="it-notes">Notas</Label>
          <Textarea
            id="it-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Comentario opcional"
            className="min-h-16 font-sans"
          />
        </div>
      </div>
      {item ? (
        <p className="text-xs text-muted-foreground">
          La cantidad se ajusta desde “Movimiento”, no aquí.
        </p>
      ) : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saving || !name}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          Guardar
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
