"use client";

import * as React from "react";
import {
  Database,
  Plus,
  Loader2,
  Play,
  RefreshCw,
  Trash2,
  Pencil,
  Table as TableIcon,
  ShieldAlert,
  CheckCircle2,
  ChevronRight,
  Server,
  Rows3,
  Columns3,
  Workflow,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import { cn } from "@/lib/utils";
import {
  listConnectionsAction,
  saveConnectionAction,
  deleteConnectionAction,
  testConnectionAction,
  listSchemasAction,
  listTablesAction,
  runQueryAction,
} from "@/modules/db-admin/actions";
import type { DbConnectionDTO } from "@/modules/db-admin/domain/connection";
import type {
  SchemaInfo,
  TableInfo,
} from "@/modules/db-admin/domain/schema-info";
import type { QueryResult } from "@/modules/db-admin/application/ports";
import { analyzeSql } from "@/modules/db-admin/domain/sql-analysis";
import { TableBrowser } from "./TableBrowser";
import { TableStructure } from "./TableStructure";
import { SchemaDiagram } from "./SchemaDiagram";

export function DbAdminTool() {
  const [connections, setConnections] = React.useState<DbConnectionDTO[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState<DbConnectionDTO | null>(null);

  const refresh = React.useCallback(async () => {
    const list = await listConnectionsAction();
    setConnections(list);
  }, []);

  React.useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  const selected = connections.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* Left rail: connections */}
      <aside className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Conexiones</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
              setSelectedId("");
            }}
          >
            <Plus />
            Nueva
          </Button>
        </div>

        {connections.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            Sin conexiones. Añade una para empezar.
          </p>
        ) : (
          <ul className="space-y-1">
            {connections.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => {
                    setSelectedId(c.id);
                    setShowForm(false);
                    setEditing(null);
                  }}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md border p-2.5 text-left text-sm transition-colors",
                    selectedId === c.id
                      ? "border-foreground/40 bg-foreground/[0.06]"
                      : "border-border hover:bg-foreground/[0.03]",
                  )}
                >
                  <Database className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.host}
                    </p>
                    {c.readOnly ? (
                      <span className="mt-0.5 inline-block rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Solo lectura
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Main area */}
      <div className="min-w-0">
        {showForm ? (
          <ConnectionForm
            initial={editing}
            onClose={() => setShowForm(false)}
            onSaved={async (savedId) => {
              await refresh();
              setShowForm(false);
              setSelectedId(savedId);
              setEditing(null);
            }}
          />
        ) : selected ? (
          <ConnectionWorkspace
            connection={selected}
            onEdit={() => {
              setEditing(selected);
              setShowForm(true);
            }}
            onDelete={async () => {
              await deleteConnectionAction(selected.id);
              setSelectedId("");
              await refresh();
            }}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-border p-16 text-center text-sm text-muted-foreground">
            Elige una conexión de la lista, o crea una nueva.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connection form
// ---------------------------------------------------------------------------

function ConnectionForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: DbConnectionDTO | null;
  onClose: () => void;
  onSaved: (id: string) => void | Promise<void>;
}) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [connectionUrl, setConnectionUrl] = React.useState("");
  const [readOnly, setReadOnly] = React.useState(initial?.readOnly ?? false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const res = await saveConnectionAction({
        id: initial?.id,
        name,
        connectionUrl,
        readOnly,
      });
      if (res.ok) await onSaved(res.value.id);
      else setError(res.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass rounded-lg border border-border/60 p-5">
      <h2 className="mb-4 text-base font-medium">
        {initial ? "Editar conexión" : "Nueva conexión"}
      </h2>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="conn-name">Nombre</Label>
          <Input
            id="conn-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Producción · master_db"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="conn-url">
            {initial ? "URL de conexión (déjala vacía para no cambiar)" : "URL de conexión"}
          </Label>
          <Input
            id="conn-url"
            type="password"
            value={connectionUrl}
            onChange={(e) => setConnectionUrl(e.target.value)}
            placeholder="postgresql://user:pass@host:5432/dbname"
            className="font-mono"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Se guarda solo en la base del Lab y nunca sale al navegador después
            de guardarla.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={readOnly}
            onChange={(e) => setReadOnly(e.target.checked)}
          />
          Solo lectura (bloquea INSERT/UPDATE/DELETE/DROP…)
        </label>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={saving || !name || (!connectionUrl && !initial)}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            Guardar
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workspace: schema explorer + SQL editor + result grid
// ---------------------------------------------------------------------------

function ConnectionWorkspace({
  connection,
  onEdit,
  onDelete,
}: {
  connection: DbConnectionDTO;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
}) {
  const [sql, setSql] = React.useState("SELECT 1;");
  const [result, setResult] = React.useState<QueryResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState(false);
  const [testInfo, setTestInfo] = React.useState<string | null>(null);
  const [testing, setTesting] = React.useState(false);
  const [pendingConfirm, setPendingConfirm] = React.useState<{
    sql: string;
    reason: string;
  } | null>(null);
  /** Table currently open in the Datos / Estructura tabs. */
  const [selected, setSelected] = React.useState<{ schema: string; table: string } | null>(null);
  /** Schema the diagram is drawn for — follows whichever schema is expanded. */
  const [activeSchema, setActiveSchema] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<TabId>("data");

  function pickTable(schema: string, table: string) {
    setSelected({ schema, table });
    setActiveSchema(schema);
    // Jump to the data view — that's what clicking a table implies.
    setTab((t) => (t === "diagram" || t === "sql" ? "data" : t));
  }

  const analysis = React.useMemo(() => analyzeSql(sql), [sql]);

  async function runNow(confirmDestructive = false) {
    setError(null);
    setTestInfo(null);
    setRunning(true);
    try {
      const res = await runQueryAction(connection.id, sql, confirmDestructive);
      if (res.ok) {
        setResult(res.value);
        setPendingConfirm(null);
      } else {
        // Detect the "confirm needed" message from the service.
        if (/Confirma para ejecutar/i.test(res.error)) {
          setPendingConfirm({ sql, reason: res.error });
        } else {
          setError(res.error);
          setPendingConfirm(null);
        }
      }
    } finally {
      setRunning(false);
    }
  }

  async function testNow() {
    setError(null);
    setTesting(true);
    try {
      const r = await testConnectionAction(connection.id);
      if (r.ok) setTestInfo(r.value.version);
      else setError(r.error);
    } finally {
      setTesting(false);
    }
  }

  function insertQuery(next: string) {
    setSql(next);
    setResult(null);
    setError(null);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-medium">
            <Database className="size-4" />
            {connection.name}
          </h2>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Server className="size-3" />
            {connection.host}
            {connection.readOnly ? (
              <>
                {" · "}
                <span className="rounded bg-foreground/10 px-1 py-0.5 font-medium">
                  Solo lectura
                </span>
              </>
            ) : null}
          </p>
          {testInfo ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-success">
              <CheckCircle2 className="size-3" />
              <span className="truncate font-mono">{testInfo}</span>
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={testNow} disabled={testing}>
            {testing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Probar
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Eliminar">
            <Trash2 className="text-danger" />
          </Button>
        </div>
      </div>

      {/* Schema explorer + tabbed workspace */}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <SchemaExplorer
          connectionId={connection.id}
          onQuery={insertQuery}
          onSelectTable={pickTable}
          onSchemaOpen={setActiveSchema}
          selected={selected}
        />

        <div className="min-w-0 space-y-3">
          <TabBar
            active={tab}
            onChange={setTab}
            selectedLabel={selected ? `${selected.schema}.${selected.table}` : null}
          />

          {tab === "data" ? (
            selected ? (
              <TableBrowser
                key={`${selected.schema}.${selected.table}`}
                connectionId={connection.id}
                readOnly={connection.readOnly}
                schema={selected.schema}
                table={selected.table}
              />
            ) : (
              <PickATable />
            )
          ) : null}

          {tab === "structure" ? (
            selected ? (
              <TableStructure
                key={`${selected.schema}.${selected.table}`}
                connectionId={connection.id}
                schema={selected.schema}
                table={selected.table}
              />
            ) : (
              <PickATable />
            )
          ) : null}

          {tab === "diagram" ? (
            activeSchema ? (
              <SchemaDiagram
                key={activeSchema}
                connectionId={connection.id}
                schema={activeSchema}
                onPickTable={(table) => pickTable(activeSchema, table)}
              />
            ) : (
              <PickATable message="Abre un esquema en el panel de la izquierda para ver su diagrama." />
            )
          ) : null}

          <div className={cn("space-y-3", tab !== "sql" && "hidden")}>
          <div className="glass rounded-lg border border-border/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <Label htmlFor="sql" className="text-xs font-medium">
                Consulta SQL
              </Label>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium",
                  analysis.risk === "safe"
                    ? "bg-success/10 text-success"
                    : analysis.risk === "modifying"
                      ? "bg-foreground/10 text-foreground"
                      : "bg-danger/15 text-danger",
                )}
              >
                {analysis.risk === "safe"
                  ? "Segura"
                  : analysis.risk === "modifying"
                    ? `Modifica datos (${analysis.keyword})`
                    : `⚠ ${analysis.keyword ?? "Destructiva"}${analysis.isUnbounded ? " (sin WHERE)" : ""}`}
              </span>
            </div>
            <Textarea
              id="sql"
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              placeholder="SELECT * FROM public.usuario LIMIT 100;"
              className="min-h-40 font-mono"
              spellCheck={false}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  void runNow();
                }
              }}
            />
            <div className="mt-3 flex items-center gap-2">
              <Button onClick={() => runNow()} disabled={running || !sql.trim()}>
                {running ? <Loader2 className="animate-spin" /> : <Play />}
                Ejecutar
              </Button>
              <span className="text-xs text-muted-foreground">
                {analysis.risk === "destructive"
                  ? "Pediré confirmación antes de ejecutar."
                  : "Ctrl / ⌘ + Enter para ejecutar."}
              </span>
            </div>
          </div>

          {pendingConfirm ? (
            <ConfirmDestructiveBanner
              reason={pendingConfirm.reason}
              onCancel={() => setPendingConfirm(null)}
              onConfirm={() => void runNow(true)}
              busy={running}
            />
          ) : null}

          {error ? (
            <div className="glass rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
              <p className="font-mono whitespace-pre-wrap break-all">{error}</p>
            </div>
          ) : null}

          {result ? <ResultGrid result={result} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workspace tabs
// ---------------------------------------------------------------------------

type TabId = "data" | "structure" | "diagram" | "sql";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "data", label: "Datos", icon: Rows3 },
  { id: "structure", label: "Estructura", icon: Columns3 },
  { id: "diagram", label: "Diagrama", icon: Workflow },
  { id: "sql", label: "SQL", icon: Terminal },
];

function TabBar({
  active,
  onChange,
  selectedLabel,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
  selectedLabel: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60">
      <div className="flex items-center gap-0.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
              active === id
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>
      {selectedLabel ? (
        <span className="truncate pb-1.5 font-mono text-xs text-muted-foreground">
          {selectedLabel}
        </span>
      ) : null}
    </div>
  );
}

function PickATable({ message }: { message?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-14 text-center text-sm text-muted-foreground">
      {message ?? "Elige una tabla en el panel de la izquierda."}
    </div>
  );
}

function ConfirmDestructiveBanner({
  reason,
  onCancel,
  onConfirm,
  busy,
}: {
  reason: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <div className="glass rounded-lg border border-danger/40 bg-danger/5 p-4">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-danger">
            Confirma antes de ejecutar
          </p>
          <p className="mt-1 text-xs text-danger/80">{reason}</p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={onConfirm}
              disabled={busy}
            >
              {busy ? <Loader2 className="animate-spin" /> : null}
              Sí, ejecutar de todas formas
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schema explorer
// ---------------------------------------------------------------------------

function SchemaExplorer({
  connectionId,
  onQuery,
  onSelectTable,
  onSchemaOpen,
  selected,
}: {
  connectionId: string;
  onQuery: (sql: string) => void;
  onSelectTable: (schema: string, table: string) => void;
  onSchemaOpen: (schema: string | null) => void;
  selected: { schema: string; table: string } | null;
}) {
  const [schemas, setSchemas] = React.useState<SchemaInfo[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [openSchema, setOpenSchema] = React.useState<string | null>(null);
  const [showSystem, setShowSystem] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setError(null);
    const r = await listSchemasAction(connectionId);
    if (r.ok) setSchemas(r.value);
    else {
      setError(r.error);
      setSchemas([]);
    }
  }, [connectionId]);

  React.useEffect(() => {
    // Reset is deferred so it isn't a synchronous setState in the effect.
    queueMicrotask(() => setOpenSchema(null));
    void (async () => {
      await refresh();
    })();
  }, [refresh, connectionId]);

  const visible = React.useMemo(
    () => (schemas ?? []).filter((s) => showSystem || !s.isSystem),
    [schemas, showSystem],
  );

  return (
    <div className="glass rounded-lg border border-border/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium">Esquemas</p>
        <div className="flex items-center gap-1">
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <input
              type="checkbox"
              checked={showSystem}
              onChange={(e) => setShowSystem(e.target.checked)}
            />
            sistema
          </label>
          <button
            onClick={refresh}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Refrescar"
          >
            <RefreshCw className="size-3" />
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-danger/30 bg-danger/5 p-2 text-xs text-danger">
          {error}
        </p>
      ) : schemas === null ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin esquemas visibles.</p>
      ) : (
        <ul className="space-y-0.5">
          {visible.map((s) => (
            <li key={s.name}>
              <button
                onClick={() =>
                  setOpenSchema((cur) => {
                    const next = cur === s.name ? null : s.name;
                    onSchemaOpen(next);
                    return next;
                  })
                }
                className={cn(
                  "flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-xs transition-colors",
                  openSchema === s.name
                    ? "bg-foreground/10 font-medium"
                    : "hover:bg-foreground/5",
                  s.isSystem && "text-muted-foreground",
                )}
              >
                <ChevronRight
                  className={cn(
                    "size-3 transition-transform",
                    openSchema === s.name && "rotate-90",
                  )}
                />
                <span className="truncate">{s.name}</span>
              </button>
              {openSchema === s.name ? (
                <TableList
                  connectionId={connectionId}
                  schema={s.name}
                  onQuery={onQuery}
                  onSelectTable={onSelectTable}
                  selectedTable={selected?.schema === s.name ? selected.table : null}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TableList({
  connectionId,
  schema,
  onQuery,
  onSelectTable,
  selectedTable,
}: {
  connectionId: string;
  schema: string;
  onQuery: (sql: string) => void;
  onSelectTable: (schema: string, table: string) => void;
  selectedTable: string | null;
}) {
  const [tables, setTables] = React.useState<TableInfo[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState("");

  React.useEffect(() => {
    let live = true;
    // Reset is deferred so it isn't a synchronous setState in the effect.
    queueMicrotask(() => {
      if (!live) return;
      setError(null);
      setTables(null);
    });
    void listTablesAction(connectionId, schema).then((r) => {
      if (!live) return;
      if (r.ok) setTables(r.value);
      else {
        setError(r.error);
        setTables([]);
      }
    });
    return () => {
      live = false;
    };
  }, [connectionId, schema]);

  const visible = (tables ?? []).filter((t) =>
    t.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <div className="ml-3 mt-0.5 border-l border-border/70 pl-2">
      {tables && tables.length > 8 ? (
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar tablas…"
          className="mb-1 h-6 w-full rounded border border-input bg-transparent px-1.5 text-[11px] outline-none focus-visible:border-ring"
        />
      ) : null}

      {error ? (
        <p className="py-1 text-[10px] text-danger">{error}</p>
      ) : tables === null ? (
        <p className="py-1 text-[10px] text-muted-foreground">Cargando…</p>
      ) : tables.length === 0 ? (
        <p className="py-1 text-[10px] text-muted-foreground">Sin tablas.</p>
      ) : visible.length === 0 ? (
        <p className="py-1 text-[10px] text-muted-foreground">Sin coincidencias.</p>
      ) : (
        <ul className="space-y-0.5">
          {visible.map((t) => (
            <li key={t.name}>
              <div
                className={cn(
                  "group flex items-center gap-1 rounded px-1 py-0.5 text-xs transition-colors",
                  selectedTable === t.name
                    ? "bg-foreground/10 font-medium"
                    : "hover:bg-foreground/5",
                )}
              >
                <button
                  onClick={() => onSelectTable(schema, t.name)}
                  className="flex min-w-0 flex-1 items-center gap-1 text-left hover:text-foreground"
                  title="Abrir la tabla"
                >
                  <TableIcon className="size-3 shrink-0 text-muted-foreground" />
                  <span className="truncate" title={t.name}>
                    {t.name}
                  </span>
                  {t.rowsApprox > 0 ? (
                    <span className="text-[10px] text-muted-foreground">
                      ~{formatRows(t.rowsApprox)}
                    </span>
                  ) : null}
                </button>
                <button
                  onClick={() =>
                    onQuery(
                      `SELECT * FROM "${schema}"."${t.name}" LIMIT 100;`,
                    )
                  }
                  title="Insertar SELECT en el editor"
                  className="rounded px-1 text-[9px] font-medium text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                >
                  SQL
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result grid
// ---------------------------------------------------------------------------

function ResultGrid({ result }: { result: QueryResult }) {
  return (
    <div className="glass overflow-hidden rounded-lg border border-border/60">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
        <span>
          {result.command ?? "OK"} · {result.rowCount} fila
          {result.rowCount === 1 ? "" : "s"}
        </span>
        <span className="font-mono">{result.durationMs} ms</span>
      </div>
      {result.rows.length === 0 ? (
        <p className="p-4 text-center text-xs text-muted-foreground">
          Sin resultados.
        </p>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-foreground/5">
                {result.columns.map((c, i) => (
                  <th
                    key={i}
                    className="whitespace-nowrap px-2.5 py-1.5 text-left font-medium"
                  >
                    <div className="flex flex-col">
                      <span>{c}</span>
                      <span className="font-mono text-[10px] font-normal text-muted-foreground">
                        {result.columnTypes[i]}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, ri) => (
                <tr
                  key={ri}
                  className={cn(
                    "border-t border-border/40",
                    ri % 2 && "bg-foreground/[0.02]",
                  )}
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="max-w-[320px] truncate px-2.5 py-1 align-top font-mono text-[11px]"
                      title={renderCell(cell)}
                    >
                      {cell === null ? (
                        <span className="italic text-muted-foreground">null</span>
                      ) : (
                        renderCell(cell)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function renderCell(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function formatRows(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
