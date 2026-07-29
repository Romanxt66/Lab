"use client";

import * as React from "react";
import {
  Loader2,
  X,
  RefreshCw,
  Plus,
  Trash2,
  Pencil,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  coolifyLogsAction,
  coolifyEnvsAction,
  createCoolifyEnvAction,
  updateCoolifyEnvAction,
  deleteCoolifyEnvAction,
} from "@/modules/coolify/actions";
import type { CoolifyApp, CoolifyEnv } from "@/modules/coolify/domain/resource";

type Tab = "logs" | "envs";

/** Modal with an app's recent logs and an environment-variable editor. */
export function AppDetailDialog({
  app,
  onClose,
}: {
  app: CoolifyApp;
  onClose: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>("logs");

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border/60 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="min-w-0">
            <h3 className="truncate font-medium">{app.name}</h3>
            {app.fqdn ? (
              <a
                href={app.fqdn}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-xs text-muted-foreground hover:text-foreground"
              >
                {app.fqdn}
              </a>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mb-3 inline-flex rounded-md border border-border p-0.5">
          {(
            [
              { id: "logs", label: "Logs" },
              { id: "envs", label: "Variables" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded px-3 py-1 text-sm transition-colors",
                tab === t.id
                  ? "accent-soft font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {tab === "logs" ? (
            <LogsTab uuid={app.uuid} />
          ) : (
            <EnvsTab uuid={app.uuid} />
          )}
        </div>
      </div>
    </div>
  );
}

function LogsTab({ uuid }: { uuid: string }) {
  const [logs, setLogs] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await coolifyLogsAction(uuid, 300);
    if (res.ok) setLogs(res.value || "(sin logs)");
    else setError(res.error);
    setLoading(false);
  }, [uuid]);

  React.useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          Recargar
        </Button>
      </div>
      {error ? (
        <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>
      ) : loading ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </p>
      ) : (
        <pre className="whitespace-pre-wrap break-words rounded-md bg-foreground/5 p-3 font-mono text-xs leading-relaxed">
          {logs}
        </pre>
      )}
    </div>
  );
}

function EnvsTab({ uuid }: { uuid: string }) {
  const [envs, setEnvs] = React.useState<CoolifyEnv[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [reveal, setReveal] = React.useState<Set<string>>(new Set());
  const [editing, setEditing] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await coolifyEnvsAction(uuid);
    if (res.ok) setEnvs(res.value);
    else setError(res.error);
    setLoading(false);
  }, [uuid]);

  React.useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Cambios aplican en el próximo despliegue.
        </p>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
          <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
            <Plus className="size-3.5" />
            Nueva
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mb-2 rounded-md bg-danger/10 p-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {adding ? (
        <EnvForm
          uuid={uuid}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await load();
          }}
        />
      ) : null}

      {loading && envs.length === 0 ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </p>
      ) : envs.length === 0 && !adding ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Sin variables. Añade la primera.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-md border border-border/60">
          {envs.map((e) =>
            editing === e.uuid ? (
              <li key={e.uuid} className="p-2">
                <EnvForm
                  uuid={uuid}
                  initial={e}
                  onClose={() => setEditing(null)}
                  onSaved={async () => {
                    setEditing(null);
                    await load();
                  }}
                />
              </li>
            ) : (
              <li
                key={e.uuid}
                className="group flex items-center gap-2 px-3 py-2 text-sm"
              >
                <span className="shrink-0 font-mono font-medium">{e.key}</span>
                <button
                  onClick={() =>
                    setReveal((prev) => {
                      const next = new Set(prev);
                      if (next.has(e.uuid)) next.delete(e.uuid);
                      else next.add(e.uuid);
                      return next;
                    })
                  }
                  className="min-w-0 flex-1 truncate text-left font-mono text-xs text-muted-foreground hover:text-foreground"
                  title={reveal.has(e.uuid) ? "Ocultar" : "Mostrar"}
                >
                  {reveal.has(e.uuid) ? e.value || "(vacío)" : "••••••••"}
                </button>
                {e.isBuildTime ? (
                  <span className="shrink-0 rounded-full bg-foreground/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    build
                  </span>
                ) : null}
                <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => setEditing(e.uuid)}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                    title="Editar"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <EnvDelete uuid={uuid} env={e} onDeleted={load} />
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function EnvForm({
  uuid,
  initial,
  onClose,
  onSaved,
}: {
  uuid: string;
  initial?: CoolifyEnv;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const isEdit = Boolean(initial);
  const [key, setKey] = React.useState(initial?.key ?? "");
  const [value, setValue] = React.useState(initial?.value ?? "");
  const [isLiteral, setIsLiteral] = React.useState(initial?.isLiteral ?? false);
  const [isPreview, setIsPreview] = React.useState(initial?.isPreview ?? false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const input = { key, value, isLiteral, isPreview };
    const res = isEdit
      ? await updateCoolifyEnvAction(uuid, input)
      : await createCoolifyEnvAction(uuid, input);
    if (res.ok) await onSaved();
    else setError(res.error);
    setSaving(false);
  }

  return (
    <div className="glass mb-2 space-y-2 rounded-md border border-border/60 p-3">
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="CLAVE"
          className="font-mono"
          disabled={isEdit}
          autoFocus={!isEdit}
        />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="valor"
          className="font-mono"
          autoFocus={isEdit}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={isLiteral}
            onChange={(e) => setIsLiteral(e.target.checked)}
          />
          Literal (no interpolar)
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={isPreview}
            onChange={(e) => setIsPreview(e.target.checked)}
          />
          Solo preview
        </label>
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving || !key.trim()}>
          {saving ? <Loader2 className="animate-spin" /> : <Check className="size-3.5" />}
          Guardar
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function EnvDelete({
  uuid,
  env,
  onDeleted,
}: {
  uuid: string;
  env: CoolifyEnv;
  onDeleted: () => void | Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      onClick={async () => {
        if (!confirm(`¿Eliminar la variable ${env.key}?`)) return;
        setBusy(true);
        const res = await deleteCoolifyEnvAction(uuid, env.uuid);
        setBusy(false);
        if (res.ok) await onDeleted();
        else alert(res.error);
      }}
      className="rounded p-1 text-muted-foreground hover:text-danger"
      title="Eliminar"
      disabled={busy}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </button>
  );
}
