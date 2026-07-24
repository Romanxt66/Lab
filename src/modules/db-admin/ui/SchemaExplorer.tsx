"use client";

import * as React from "react";
import {
  ChevronRight,
  ChevronDown,
  Table2,
  Folder,
  FolderOpen,
  Key,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  listSchemasAction,
  listTablesAction,
  listColumnsAction,
} from "@/modules/db-admin/actions";
import type {
  SchemaInfo,
  TableInfo,
  ColumnInfo,
} from "@/modules/db-admin/domain/schema-info";
import { cn } from "@/lib/utils";

interface Props {
  connectionId: string;
  onPickTable?: (schema: string, table: string) => void;
}

export function SchemaExplorer({ connectionId, onPickTable }: Props) {
  const [schemas, setSchemas] = React.useState<SchemaInfo[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [openSchemas, setOpenSchemas] = React.useState<Set<string>>(new Set());
  const [tablesBySchema, setTablesBySchema] = React.useState<Record<string, TableInfo[]>>({});
  const [openTables, setOpenTables] = React.useState<Set<string>>(new Set());
  const [columnsByTable, setColumnsByTable] = React.useState<Record<string, ColumnInfo[]>>({});

  const refresh = React.useCallback(async () => {
    if (!connectionId) {
      setSchemas([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await listSchemasAction(connectionId);
      if (res.ok) {
        setSchemas(res.value);
        // Auto-open the first non-system schema.
        const firstUser = res.value.find((s) => !s.isSystem);
        if (firstUser) {
          setOpenSchemas(new Set([firstUser.name]));
          await loadTables(firstUser.name);
        }
      } else {
        setError(res.error);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId]);

  React.useEffect(() => {
    // reset local state whenever the active connection changes
    setSchemas([]);
    setOpenSchemas(new Set());
    setTablesBySchema({});
    setOpenTables(new Set());
    setColumnsByTable({});
    void refresh();
  }, [connectionId, refresh]);

  async function loadTables(schema: string) {
    if (tablesBySchema[schema]) return;
    const res = await listTablesAction(connectionId, schema);
    if (res.ok) {
      setTablesBySchema((prev) => ({ ...prev, [schema]: res.value }));
    }
  }

  async function loadColumns(schema: string, table: string) {
    const key = `${schema}.${table}`;
    if (columnsByTable[key]) return;
    const res = await listColumnsAction(connectionId, schema, table);
    if (res.ok) {
      setColumnsByTable((prev) => ({ ...prev, [key]: res.value }));
    }
  }

  function toggleSchema(name: string) {
    setOpenSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else {
        next.add(name);
        void loadTables(name);
      }
      return next;
    });
  }

  function toggleTable(schema: string, table: string) {
    const key = `${schema}.${table}`;
    setOpenTables((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else {
        next.add(key);
        void loadColumns(schema, table);
      }
      return next;
    });
  }

  if (!connectionId) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
        Selecciona una conexión.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Esquemas</h3>
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Refrescar"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <ul className="max-h-[560px] space-y-0.5 overflow-y-auto pr-1 text-sm">
        {schemas.map((s) => {
          const opened = openSchemas.has(s.name);
          const tables = tablesBySchema[s.name];
          return (
            <li key={s.name}>
              <button
                type="button"
                onClick={() => toggleSchema(s.name)}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left transition-colors hover:bg-foreground/[0.05]",
                  s.isSystem && "opacity-50",
                )}
              >
                {opened ? (
                  <ChevronDown className="size-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="size-3.5 shrink-0" />
                )}
                {opened ? (
                  <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{s.name}</span>
              </button>
              {opened && tables ? (
                <ul className="ml-4 space-y-0.5 border-l border-border/50 pl-1.5">
                  {tables.length === 0 ? (
                    <li className="px-2 py-1 text-xs text-muted-foreground">
                      (vacío)
                    </li>
                  ) : null}
                  {tables.map((t) => {
                    const key = `${s.name}.${t.name}`;
                    const topen = openTables.has(key);
                    const cols = columnsByTable[key];
                    return (
                      <li key={t.name}>
                        <div className="group flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleTable(s.name, t.name)}
                            className="flex flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-left hover:bg-foreground/[0.05]"
                          >
                            {topen ? (
                              <ChevronDown className="size-3.5 shrink-0" />
                            ) : (
                              <ChevronRight className="size-3.5 shrink-0" />
                            )}
                            <Table2 className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate font-mono text-xs">
                              {t.name}
                            </span>
                            {t.rowsApprox > 0 ? (
                              <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                                ~{t.rowsApprox.toLocaleString()}
                              </span>
                            ) : null}
                          </button>
                          {onPickTable ? (
                            <button
                              type="button"
                              onClick={() => onPickTable(s.name, t.name)}
                              className="rounded px-1 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:bg-foreground/[0.1] hover:text-foreground group-hover:opacity-100"
                              title="Insertar SELECT en el editor"
                            >
                              SQL
                            </button>
                          ) : null}
                        </div>
                        {topen && cols ? (
                          <ul className="ml-6 space-y-0.5 py-0.5">
                            {cols.map((c) => (
                              <li
                                key={c.name}
                                className="flex items-center gap-1.5 px-1.5 py-0.5 text-[11px]"
                              >
                                {c.isPrimaryKey ? (
                                  <Key className="size-3 text-warning" />
                                ) : (
                                  <span className="size-3 shrink-0" />
                                )}
                                <span className="truncate font-mono">
                                  {c.name}
                                </span>
                                <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                                  {c.dataType}
                                  {!c.isNullable ? "!" : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
