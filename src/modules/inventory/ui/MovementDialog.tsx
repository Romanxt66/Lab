"use client";

import * as React from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import {
  recordMovementAction,
  listMovementsAction,
} from "@/modules/inventory/actions";
import type { ItemDTO } from "@/modules/inventory/domain/item";
import type { LocationDTO } from "@/modules/inventory/domain/location";
import { LOCATION_KIND_LABELS } from "@/modules/inventory/domain/location";
import {
  MOVEMENT_KINDS,
  MOVEMENT_KIND_LABELS,
  type MovementDTO,
  type MovementKind,
} from "@/modules/inventory/domain/movement";
import { MovementRow } from "./MovementRow";
import { locationMap } from "./location-path";

/**
 * Modal to record a movement for one item and review its recent history.
 * Rendered as a fixed overlay; closes on backdrop click or the X.
 */
export function MovementDialog({
  item,
  locations,
  onClose,
  onRecorded,
}: {
  item: ItemDTO;
  locations: LocationDTO[];
  onClose: () => void;
  onRecorded: () => void | Promise<void>;
}) {
  const [kind, setKind] = React.useState<MovementKind>("bought");
  const [quantity, setQuantity] = React.useState("1");
  const [toLocationId, setToLocationId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [occurredAt, setOccurredAt] = React.useState(today());
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [history, setHistory] = React.useState<MovementDTO[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(true);

  const locById = React.useMemo(() => locationMap(locations), [locations]);

  const loadHistory = React.useCallback(async () => {
    setLoadingHistory(true);
    try {
      setHistory(await listMovementsAction(item.id, 50));
    } finally {
      setLoadingHistory(false);
    }
  }, [item.id]);

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Close on Escape.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isMove = kind === "moved";
  const isAdjust = kind === "adjust";

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const parsed = parseInt(quantity, 10);
      const res = await recordMovementAction({
        itemId: item.id,
        kind,
        quantity: Number.isFinite(parsed) ? parsed : NaN,
        toLocationId: isMove ? toLocationId || null : null,
        notes: notes || null,
        occurredAt: new Date(`${occurredAt}T12:00:00`).toISOString(),
      });
      if (res.ok) {
        setQuantity("1");
        setNotes("");
        await loadHistory();
        await onRecorded();
      } else {
        setError(res.error);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border/60 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="font-medium">{item.name}</h3>
            <p className="text-sm text-muted-foreground">
              Stock actual: {item.quantity}
              {item.unit ? ` ${item.unit}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mv-kind">Tipo de movimiento</Label>
            <select
              id="mv-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as MovementKind)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {MOVEMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {MOVEMENT_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mv-qty">
                {isMove ? "Cantidad (no cambia)" : isAdjust ? "Ajuste (+/−)" : "Cantidad"}
              </Label>
              <Input
                id="mv-qty"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                inputMode="numeric"
                className="font-mono"
                disabled={isMove}
                placeholder={isAdjust ? "-2, 5…" : "1"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mv-date">Fecha</Label>
              <Input
                id="mv-date"
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </div>
          </div>

          {isMove ? (
            <div className="space-y-1.5">
              <Label htmlFor="mv-to">Mover a</Label>
              <select
                id="mv-to"
                value={toLocationId}
                onChange={(e) => setToLocationId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Elige destino…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({LOCATION_KIND_LABELS[l.kind]})
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="mv-notes">Notas</Label>
            <Textarea
              id="mv-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Precio, a quién, motivo…"
              className="min-h-14 font-sans"
            />
          </div>

          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? <Loader2 className="animate-spin" /> : null}
            Registrar movimiento
          </Button>
        </div>

        {/* History */}
        <div className="mt-6">
          <h4 className="mb-2 text-sm font-medium">Historial</h4>
          {loadingHistory ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando…
            </p>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sin movimientos todavía.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 rounded-md border border-border/60">
              {history.map((m) => (
                <MovementRow key={m.id} movement={m} locById={locById} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function today(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
