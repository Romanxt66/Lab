"use client";

import * as React from "react";
import {
  Plus,
  Database,
  Pencil,
  Trash2,
  PlugZap,
  Loader2,
  Lock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import { cn } from "@/lib/utils";
import {
  listConnectionsAction,
  saveConnectionAction,
  deleteConnectionAction,
  testConnectionAction,
} from "@/modules/db-admin/actions";
import type { DbConnectionDTO } from "@/modules/db-admin/domain/connection";

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
}

export function ConnectionsPanel({ selectedId, onSelect }: Props) {
  const [conns, setConns] = React.useState<DbConnectionDTO[]>([]);
  const [editing, setEditing] = React.useState<
    | { id?: string; name: string; connectionUrl: string; readOnly: boolean }
    | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);
  const [testing, setTesting] = React.useState<string | null>(null);
  const [testResult, setTestResult] = React.useState<
    { id: string; ok: boolean; msg: string } | null
  >(null);

  const refresh = React.useCallback(async () => {
    const list = await listConnectionsAction();
    setConns(list);
    if (!selectedId && list.length > 0) onSelect(list[0].id);
  }, [selectedId, onSelect]);

  React.useEffect(() => {
    void (async () => {
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!editing) return;
    setError(null);
    const res = await saveConnectionAction(editing);
    if (res.ok) {
      setEditing(null);
      onSelect(res.value.id);
      await refresh();
    } else {
      setError(res.error);
    }
  }

  async function remove(id: string) {
    await deleteConnectionAction(id);
    if (selectedId === id) onSelect("");
    await refresh();
  }

  async function test(id: string) {
    setTesting(id);
    setTestResult(null);
    try {
      const res = await testConnectionAction(id);
      if (res.ok) {
        setTestResult({
          id,
          ok: true,
          msg: (res.value.version || "Conexión OK").slice(0, 80),
        });
      } else {
        setTestResult({ id, ok: false, msg: res.error });
      }
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Conexiones</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setEditing({ name: "", connectionUrl: "", readOnly: false })
          }
        >
          <Plus />
          Nueva
        </Button>
      </div>

      {editing ? (
        <div className="glass space-y-3 rounded-lg border border-border/60 p-3">
          <div className="space-y-1">
            <Label className="text-xs">Nombre</Label>
            <Input
              value={editing.name}
              onChange={(e) =>
                setEditing({ ...editing, name: e.target.value })
              }
              placeholder="mi-db-prod"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Connection URL</Label>
            <Input
              type="password"
              value={editing.connectionUrl}
              onChange={(e) =>
                setEditing({ ...editing, connectionUrl: e.target.value })
              }
              placeholder="postgres://user:pass@host:5432/db"
              className="font-mono"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Se guarda en la BD del Lab y solo se usa en el servidor. Formato:
              postgres://usuario:clave@host:puerto/basedatos
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={editing.readOnly}
              onChange={(e) =>
                setEditing({ ...editing, readOnly: e.target.checked })
              }
            />
            Solo lectura (bloquea INSERT/UPDATE/DELETE)
          </label>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} className="flex-1">
              Guardar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {conns.length === 0 && !editing ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          Añade una conexión para empezar.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {conns.map((c) => {
            const active = c.id === selectedId;
            const t = testResult?.id === c.id ? testResult : null;
            return (
              <li
                key={c.id}
                className={cn(
                  "rounded-md border p-2.5 transition-colors",
                  active
                    ? "border-foreground/40 bg-foreground/[0.06]"
                    : "border-border hover:bg-foreground/[0.03]",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <Database className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {c.host}
                    </p>
                  </div>
                  {c.readOnly ? (
                    <Lock className="size-3.5 text-muted-foreground" />
                  ) : null}
                </button>

                <div className="mt-1.5 flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => test(c.id)}
                    disabled={testing === c.id}
                    className="h-7 px-2 text-xs"
                  >
                    {testing === c.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <PlugZap className="size-3.5" />
                    )}
                    Probar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setEditing({
                        id: c.id,
                        name: c.name,
                        connectionUrl: "",
                        readOnly: c.readOnly,
                      })
                    }
                    className="h-7 px-2 text-xs"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(c.id)}
                    className="h-7 px-2 text-xs"
                  >
                    <Trash2 className="size-3.5 text-danger" />
                  </Button>
                </div>

                {t ? (
                  <p
                    className={cn(
                      "mt-1 flex items-start gap-1 text-[11px]",
                      t.ok ? "text-success" : "text-danger",
                    )}
                  >
                    {t.ok ? (
                      <CheckCircle2 className="mt-0.5 size-3 shrink-0" />
                    ) : (
                      <AlertCircle className="mt-0.5 size-3 shrink-0" />
                    )}
                    <span className="truncate">{t.msg}</span>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
