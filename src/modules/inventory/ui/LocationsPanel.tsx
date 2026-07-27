"use client";

import * as React from "react";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  DoorOpen,
  Package,
  Rows3,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import {
  locationTreeAction,
  saveLocationAction,
  deleteLocationAction,
} from "@/modules/inventory/actions";
import {
  LOCATION_KINDS,
  LOCATION_KIND_LABELS,
  descendantIds,
  type LocationDTO,
  type LocationKind,
  type LocationNode,
} from "@/modules/inventory/domain/location";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<LocationKind, React.ComponentType<{ className?: string }>> = {
  room: DoorOpen,
  box: Package,
  shelf: Rows3,
  place: MapPin,
};

export function LocationsPanel({
  locations,
  onChanged,
}: {
  locations: LocationDTO[];
  onChanged: () => void | Promise<void>;
}) {
  const [tree, setTree] = React.useState<LocationNode[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<LocationDTO | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      setTree(await locationTreeAction());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh, locations]);

  async function afterChange() {
    setCreating(false);
    setEditing(null);
    await refresh();
    await onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Ubicaciones</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Habitaciones, cajas y estantes anidados donde guardas las cosas.
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
          Nueva
        </Button>
      </div>

      {creating || editing ? (
        <LocationForm
          location={editing}
          locations={locations}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={afterChange}
        />
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </p>
      ) : tree.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          Sin ubicaciones todavía. Crea la primera (p. ej. una habitación).
        </p>
      ) : (
        <div className="glass rounded-lg border border-border/60 p-2">
          {tree.map((node) => (
            <LocationRow
              key={node.id}
              node={node}
              depth={0}
              onEdit={(l) => {
                setCreating(false);
                setEditing(l);
              }}
              onDelete={async (l) => {
                if (
                  confirm(
                    `¿Eliminar "${l.name}"? Las sub-ubicaciones y artículos quedarán sin ubicación.`,
                  )
                ) {
                  await deleteLocationAction(l.id);
                  await afterChange();
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LocationRow({
  node,
  depth,
  onEdit,
  onDelete,
}: {
  node: LocationNode;
  depth: number;
  onEdit: (l: LocationDTO) => void;
  onDelete: (l: LocationDTO) => void;
}) {
  const Icon = KIND_ICON[node.kind];
  const dto: LocationDTO = {
    id: node.id,
    name: node.name,
    kind: node.kind,
    parentId: node.parentId,
    notes: node.notes,
  };
  return (
    <>
      <div
        className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-foreground/[0.03]"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {depth > 0 ? (
          <ChevronRight className="size-3 shrink-0 text-muted-foreground/50" />
        ) : null}
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-sm">{node.name}</span>
        <span className="text-xs text-muted-foreground">
          {LOCATION_KIND_LABELS[node.kind]}
          {node.itemCount > 0 ? ` · ${node.itemCount} art.` : ""}
        </span>
        <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onEdit(dto)}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            title="Editar"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={() => onDelete(dto)}
            className="rounded p-1 text-muted-foreground hover:text-danger"
            title="Eliminar"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      {node.children.map((child) => (
        <LocationRow
          key={child.id}
          node={child}
          depth={depth + 1}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

function LocationForm({
  location,
  locations,
  onClose,
  onSaved,
}: {
  location: LocationDTO | null;
  locations: LocationDTO[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = React.useState(location?.name ?? "");
  const [kind, setKind] = React.useState<LocationKind>(location?.kind ?? "room");
  const [parentId, setParentId] = React.useState<string>(
    location?.parentId ?? "",
  );
  const [notes, setNotes] = React.useState(location?.notes ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Can't parent a location to itself or its own descendants.
  const forbidden = location
    ? descendantIds(location.id, locations)
    : new Set<string>();
  const parentOptions = locations.filter((l) => !forbidden.has(l.id));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await saveLocationAction({
        id: location?.id,
        name,
        kind,
        parentId: parentId || null,
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
        {location ? "Editar ubicación" : "Nueva ubicación"}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="loc-name">Nombre</Label>
          <Input
            id="loc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Habitación, Caja A…"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loc-kind">Tipo</Label>
          <select
            id="loc-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as LocationKind)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {LOCATION_KINDS.map((k) => (
              <option key={k} value={k}>
                {LOCATION_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="loc-parent">Dentro de</Label>
          <select
            id="loc-parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">— Raíz (sin contenedor) —</option>
            {parentOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({LOCATION_KIND_LABELS[l.kind]})
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="loc-notes">Notas</Label>
        <Textarea
          id="loc-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Comentario opcional"
          className="min-h-16 font-sans"
        />
      </div>
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
