"use client";

import * as React from "react";
import { Loader2, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import { cn } from "@/lib/utils";
import type { ColumnInfo } from "@/modules/db-admin/domain/schema-info";

/**
 * Add/edit one row. Values are typed as text and coerced back to JSON-ish
 * types on save — a NULL checkbox is offered separately so "empty string" and
 * NULL stay distinguishable, which matters for nullable columns.
 */
export function RowEditorDialog({
  mode,
  table,
  columns,
  initial,
  saving,
  error,
  onCancel,
  onSave,
}: {
  mode: "insert" | "edit";
  table: string;
  columns: ColumnInfo[];
  /** Current values, keyed by column name (edit mode). */
  initial?: Record<string, unknown>;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (values: Record<string, unknown>) => void;
}) {
  const [fields, setFields] = React.useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const c of columns) {
      const v = initial?.[c.name];
      out[c.name] = v === null || v === undefined ? "" : stringify(v);
    }
    return out;
  });
  const [nulls, setNulls] = React.useState<Set<string>>(() => {
    const out = new Set<string>();
    for (const c of columns) {
      if (initial && (initial[c.name] === null || initial[c.name] === undefined)) out.add(c.name);
    }
    return out;
  });
  // On insert, start every nullable/defaulted column as NULL so the database
  // applies its own defaults instead of receiving empty strings.
  const [touched, setTouched] = React.useState<Set<string>>(new Set());

  function submit() {
    const values: Record<string, unknown> = {};
    for (const c of columns) {
      if (mode === "insert" && !touched.has(c.name) && !nulls.has(c.name)) {
        // Untouched on insert → omit entirely, letting DEFAULT / serial apply.
        continue;
      }
      values[c.name] = nulls.has(c.name) ? null : coerce(fields[c.name] ?? "");
    }
    onSave(values);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="glass flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-border/60 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="truncate font-medium">
              {mode === "insert" ? "Nueva fila" : "Editar fila"}
            </h3>
            <p className="truncate font-mono text-xs text-muted-foreground">{table}</p>
          </div>
          <button
            onClick={onCancel}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {columns.map((c) => {
            const isNull = nulls.has(c.name);
            return (
              <div key={c.name} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor={`f-${c.name}`} className="font-mono text-xs">
                    {c.name}
                    {c.isPrimaryKey ? (
                      <span className="ml-1.5 rounded bg-accent/15 px-1 py-0.5 text-[10px] text-accent">
                        PK
                      </span>
                    ) : null}
                    {!c.isNullable ? <span className="ml-1 text-danger">*</span> : null}
                  </Label>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {c.dataType}
                  </span>
                </div>
                <Input
                  id={`f-${c.name}`}
                  value={isNull ? "" : (fields[c.name] ?? "")}
                  disabled={isNull}
                  onChange={(e) => {
                    setFields((p) => ({ ...p, [c.name]: e.target.value }));
                    setTouched((p) => new Set(p).add(c.name));
                  }}
                  placeholder={
                    mode === "insert" && c.default ? `por defecto: ${c.default}` : ""
                  }
                  className={cn("font-mono text-xs", isNull && "opacity-50")}
                />
                {c.isNullable ? (
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={isNull}
                      onChange={(e) => {
                        setNulls((p) => {
                          const next = new Set(p);
                          if (e.target.checked) next.add(c.name);
                          else next.delete(c.name);
                          return next;
                        });
                        setTouched((p) => new Set(p).add(c.name));
                      }}
                    />
                    NULL
                  </label>
                ) : null}
              </div>
            );
          })}
        </div>

        <footer className="space-y-3 border-t border-border/60 px-5 py-3.5">
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <div className="flex items-center gap-2">
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save className="size-3.5" />}
              Guardar
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/** Render a cell value for editing. */
function stringify(v: unknown): string {
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * Turn the text back into something Postgres can bind. Numbers, booleans and
 * JSON are recognised; everything else is sent as text and let the column's
 * own type do the casting (dates, uuids, enums…).
 */
function coerce(raw: string): unknown {
  const t = raw.trim();
  if (t === "") return "";
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+$/.test(t) && Number.isSafeInteger(Number(t))) return Number(t);
  if (/^-?\d*\.\d+$/.test(t)) return Number(t);
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try {
      return JSON.parse(t);
    } catch {
      return raw;
    }
  }
  return raw;
}
