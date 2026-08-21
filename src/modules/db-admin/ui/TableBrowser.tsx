"use client";

import * as React from "react";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Copy,
  CopyPlus,
  Check,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Lock,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import { cn } from "@/lib/utils";
import {
  browseRowsAction,
  tableDetailAction,
  insertRowAction,
  updateRowAction,
  deleteRowAction,
} from "@/modules/db-admin/actions";
import type { ColumnInfo } from "@/modules/db-admin/domain/schema-info";
import type { SortDirection } from "@/modules/db-admin/domain/row-sql";
import { RowEditorDialog, type RowEditorMode } from "./RowEditorDialog";

const PAGE_SIZE = 50;

interface Props {
  connectionId: string;
  readOnly: boolean;
  schema: string;
  table: string;
}

/**
 * Paginated data grid for one table. Clicking a row selects it and reveals an
 * action bar (edit / duplicate / copy / delete) — more discoverable than
 * hover-only icons, and it gives the destructive action a deliberate target.
 */
export function TableBrowser({ connectionId, readOnly, schema, table }: Props) {
  const [columns, setColumns] = React.useState<ColumnInfo[]>([]);
  const [gridColumns, setGridColumns] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<unknown[][]>([]);
  const [hasMore, setHasMore] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [orderBy, setOrderBy] = React.useState<string | null>(null);
  const [direction, setDirection] = React.useState<SortDirection>("asc");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  /** Index into `rows` of the highlighted row, if any. */
  const [selectedRow, setSelectedRow] = React.useState<number | null>(null);
  const [editing, setEditing] = React.useState<{
    mode: RowEditorMode;
    initial?: Record<string, unknown>;
    key?: Record<string, unknown>;
  } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const pkColumns = React.useMemo(
    () => columns.filter((c) => c.isPrimaryKey).map((c) => c.name),
    [columns],
  );
  const canMutate = !readOnly;
  /** Editing or deleting needs a primary key to target exactly one row. */
  const canTargetRow = canMutate && pkColumns.length > 0;

  const load = React.useCallback(
    async (nextPage: number, sort: { by: string | null; dir: SortDirection }) => {
      setLoading(true);
      setError(null);
      setSelectedRow(null); // row indexes shift when the page or order changes
      try {
        const res = await browseRowsAction(connectionId, schema, table, {
          limit: PAGE_SIZE,
          offset: nextPage * PAGE_SIZE,
          orderBy: sort.by,
          direction: sort.dir,
        });
        if (res.ok) {
          setGridColumns(res.value.columns);
          setRows(res.value.rows);
          setHasMore(res.value.hasMore);
        } else {
          setError(res.error);
          setRows([]);
        }
      } catch (e) {
        // Without this the spinner would hang forever on a server-side throw.
        setError(e instanceof Error ? e.message : "No se pudieron leer las filas.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [connectionId, schema, table],
  );

  // Reload structure + first page whenever the target table changes.
  React.useEffect(() => {
    void (async () => {
      setPage(0);
      setOrderBy(null);
      setDirection("asc");
      try {
        const detail = await tableDetailAction(connectionId, schema, table);
        setColumns(detail.ok ? detail.value.columns : []);
      } catch {
        // Structure only powers the PK-aware actions; the grid still works.
        setColumns([]);
      }
      await load(0, { by: null, dir: "asc" });
    })();
  }, [connectionId, schema, table, load]);

  // Escape clears the selection.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editing) setSelectedRow(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  function toggleSort(column: string) {
    const nextDir: SortDirection =
      orderBy === column && direction === "asc" ? "desc" : "asc";
    setOrderBy(column);
    setDirection(nextDir);
    setPage(0);
    void load(0, { by: column, dir: nextDir });
  }

  function goToPage(next: number) {
    setPage(next);
    void load(next, { by: orderBy, dir: direction });
  }

  /** Primary-key values for a grid row, used to target update/delete. */
  function keyOf(row: unknown[]): Record<string, unknown> {
    const key: Record<string, unknown> = {};
    for (const pk of pkColumns) {
      const idx = gridColumns.indexOf(pk);
      if (idx >= 0) key[pk] = row[idx];
    }
    return key;
  }

  function rowToRecord(row: unknown[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    gridColumns.forEach((c, i) => (out[c] = row[i]));
    return out;
  }

  function openEdit() {
    if (selectedRow === null) return;
    setDialogError(null);
    setEditing({
      mode: "edit",
      initial: rowToRecord(rows[selectedRow]),
      key: keyOf(rows[selectedRow]),
    });
  }

  function openDuplicate() {
    if (selectedRow === null) return;
    const record = rowToRecord(rows[selectedRow]);
    // Drop auto-generated primary keys (serial / uuid default) so the database
    // mints fresh ones instead of colliding with the row being copied.
    for (const c of columns) {
      if (c.isPrimaryKey && c.default) delete record[c.name];
    }
    setDialogError(null);
    setEditing({ mode: "duplicate", initial: record });
  }

  async function copySelected() {
    if (selectedRow === null) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(rowToRecord(rows[selectedRow]), null, 2),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("El navegador bloqueó el acceso al portapapeles.");
    }
  }

  async function saveRow(values: Record<string, unknown>) {
    if (!editing) return;
    setSaving(true);
    setDialogError(null);
    try {
      const res =
        editing.mode === "edit" && editing.key
          ? await updateRowAction(connectionId, schema, table, values, editing.key)
          : await insertRowAction(connectionId, schema, table, values);
      if (res.ok) {
        setEditing(null);
        await load(page, { by: orderBy, dir: direction });
      } else {
        setDialogError(res.error);
      }
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "No se pudo guardar la fila.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelected() {
    if (selectedRow === null) return;
    if (!confirm("¿Eliminar esta fila? No se puede deshacer.")) return;
    setDeleting(true);
    try {
      const res = await deleteRowAction(
        connectionId,
        schema,
        table,
        keyOf(rows[selectedRow]),
      );
      if (res.ok) await load(page, { by: orderBy, dir: direction });
      else setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar la fila.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-mono text-sm font-medium">
            {schema}.{table}
          </h3>
          {readOnly ? (
            <span className="inline-flex items-center gap-1 rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <Lock className="size-2.5" />
              Solo lectura
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void load(page, { by: orderBy, dir: direction })}
            disabled={loading}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Actualizar
          </Button>
          {canMutate ? (
            <Button
              size="sm"
              onClick={() => {
                setDialogError(null);
                setEditing({ mode: "insert" });
              }}
            >
              <Plus className="size-3.5" />
              Nueva fila
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {/* Action bar for the selected row. */}
      {selectedRow !== null ? (
        <div className="glass flex flex-wrap items-center gap-2 rounded-lg border border-foreground/25 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            Fila {page * PAGE_SIZE + selectedRow + 1} seleccionada
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={copySelected}>
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              {copied ? "Copiado" : "Copiar JSON"}
            </Button>
            {canMutate ? (
              <Button size="sm" variant="outline" onClick={openDuplicate}>
                <CopyPlus className="size-3.5" />
                Duplicar
              </Button>
            ) : null}
            {canTargetRow ? (
              <>
                <Button size="sm" variant="outline" onClick={openEdit}>
                  <Pencil className="size-3.5" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={deleteSelected}
                  disabled={deleting}
                  className="text-danger hover:text-danger"
                >
                  {deleting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  Eliminar
                </Button>
              </>
            ) : null}
            <button
              onClick={() => setSelectedRow(null)}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              title="Quitar selección (Esc)"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {canMutate && !canTargetRow && rows.length > 0 ? (
        <p className="rounded-md border border-border/60 bg-foreground/[0.03] px-3 py-2 text-xs text-muted-foreground">
          Esta tabla no tiene clave primaria, así que no se puede identificar una
          fila concreta para editarla o borrarla. Puedes insertar y duplicar
          filas, o usar el editor SQL.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full min-w-max text-xs">
          <thead className="border-b border-border/60 bg-foreground/[0.03]">
            <tr>
              {gridColumns.map((c) => {
                const meta = columns.find((x) => x.name === c);
                const sorted = orderBy === c;
                return (
                  <th key={c} className="px-3 py-2 text-left font-medium">
                    <button
                      onClick={() => toggleSort(c)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      title="Ordenar"
                    >
                      <span className="font-mono">{c}</span>
                      {meta?.isPrimaryKey ? (
                        <span className="rounded bg-accent/15 px-1 text-[9px] text-accent">PK</span>
                      ) : null}
                      {sorted ? (
                        direction === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(1, gridColumns.length)} className="px-3 py-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(1, gridColumns.length)} className="px-3 py-8 text-center text-muted-foreground">
                  Sin filas.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => setSelectedRow((cur) => (cur === i ? null : i))}
                  aria-selected={selectedRow === i}
                  className={cn(
                    "cursor-pointer border-b border-border/40 last:border-0 transition-colors",
                    selectedRow === i
                      ? "bg-foreground/[0.08]"
                      : "hover:bg-foreground/[0.03]",
                  )}
                >
                  {row.map((cell, j) => (
                    <td key={j} className="max-w-xs truncate px-3 py-1.5 font-mono">
                      {renderCell(cell)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {rows.length > 0
            ? `Filas ${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + rows.length}`
            : "Sin filas"}
          {rows.length > 0 ? " · haz clic en una fila para actuar sobre ella" : ""}
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => goToPage(page - 1)}
            disabled={page === 0 || loading}
          >
            <ChevronLeft className="size-3.5" />
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => goToPage(page + 1)}
            disabled={!hasMore || loading}
          >
            Siguiente
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {editing ? (
        <RowEditorDialog
          mode={editing.mode}
          table={`${schema}.${table}`}
          columns={columns}
          initial={editing.initial}
          saving={saving}
          error={dialogError}
          onCancel={() => setEditing(null)}
          onSave={(values) => void saveRow(values)}
        />
      ) : null}
    </div>
  );
}

function renderCell(v: unknown): React.ReactNode {
  if (v === null || v === undefined) {
    return <span className="italic text-muted-foreground/60">NULL</span>;
  }
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}
