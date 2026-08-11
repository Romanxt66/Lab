"use client";

import * as React from "react";
import {
  Loader2,
  Plus,
  RefreshCw,
  Activity,
  Pencil,
  Trash2,
  Play,
  ExternalLink,
  Bell,
  BellOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import { cn } from "@/lib/utils";
import {
  listMonitorsAction,
  saveMonitorAction,
  deleteMonitorAction,
  checkMonitorNowAction,
} from "@/modules/uptime/actions";
import {
  HTTP_METHODS,
  STATUS_LABELS,
  type HttpMethod,
  type MonitorDTO,
  type MonitorStatus,
} from "@/modules/uptime/domain/monitor";
import { MonitorDetailDialog } from "./MonitorDetailDialog";

const STATUS_DOT: Record<MonitorStatus, string> = {
  up: "bg-success",
  down: "bg-danger",
  unknown: "bg-muted-foreground/40",
};
const STATUS_TEXT: Record<MonitorStatus, string> = {
  up: "text-success",
  down: "text-danger",
  unknown: "text-muted-foreground",
};

const INTERVALS = [
  { value: 60, label: "1 min" },
  { value: 300, label: "5 min" },
  { value: 900, label: "15 min" },
  { value: 1800, label: "30 min" },
  { value: 3600, label: "1 hora" },
];

export function UptimeTool() {
  const [monitors, setMonitors] = React.useState<MonitorDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<MonitorDTO | null>(null);
  const [detail, setDetail] = React.useState<MonitorDTO | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      setMonitors(await listMonitorsAction());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  const anyDown = monitors.some((m) => m.lastStatus === "down");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Monitores</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Vigila tus webs/APIs y recibe un aviso por Telegram cuando se caigan.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Actualizar
          </Button>
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
      </div>

      {anyDown ? (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          Hay monitores caídos.
        </p>
      ) : null}

      {creating || editing ? (
        <MonitorForm
          monitor={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            await refresh();
          }}
        />
      ) : null}

      {loading && monitors.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </p>
      ) : monitors.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
          <Activity className="mx-auto mb-2 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Sin monitores. Añade tu primera web o API.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {monitors.map((m) => (
            <MonitorCard
              key={m.id}
              monitor={m}
              onDetails={() => setDetail(m)}
              onEdit={() => {
                setCreating(false);
                setEditing(m);
              }}
              onChanged={refresh}
            />
          ))}
        </div>
      )}

      {detail ? (
        <MonitorDetailDialog
          monitor={detail}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </div>
  );
}

function MonitorCard({
  monitor,
  onDetails,
  onEdit,
  onChanged,
}: {
  monitor: MonitorDTO;
  onDetails: () => void;
  onEdit: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);

  async function checkNow() {
    setBusy(true);
    await checkMonitorNowAction(monitor.id);
    setBusy(false);
    await onChanged();
  }

  return (
    <div className="glass group flex flex-col gap-3 rounded-lg border border-border/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("size-2.5 shrink-0 rounded-full", STATUS_DOT[monitor.lastStatus])} />
            <h3 className="truncate font-medium">{monitor.name}</h3>
          </div>
          <a
            href={monitor.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground"
          >
            {monitor.url.replace(/^https?:\/\//, "")}
            <ExternalLink className="size-3 shrink-0" />
          </a>
        </div>
        <span className={cn("shrink-0 text-xs font-medium", STATUS_TEXT[monitor.lastStatus])}>
          {STATUS_LABELS[monitor.lastStatus]}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {monitor.lastResponseMs != null ? (
          <span>{monitor.lastResponseMs} ms</span>
        ) : null}
        {monitor.lastCheckedAt ? <span>· {relative(monitor.lastCheckedAt)}</span> : <span>· sin comprobar</span>}
        {monitor.lastStatus === "down" && monitor.consecutiveFailures > 0 ? (
          <span className="text-danger">· {monitor.consecutiveFailures} fallos</span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          · {monitor.notifyOnFailure ? <Bell className="size-3" /> : <BellOff className="size-3" />}
        </span>
        {!monitor.active ? <span>· pausado</span> : null}
      </div>

      <div className="mt-auto flex items-center gap-1 pt-1">
        <Button size="sm" variant="outline" className="flex-1" onClick={checkNow} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Play className="size-3.5" />}
          Comprobar
        </Button>
        <Button size="sm" variant="ghost" onClick={onDetails}>
          Detalles
        </Button>
        <button
          onClick={onEdit}
          className="rounded p-1.5 text-muted-foreground hover:text-foreground"
          title="Editar"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          onClick={async () => {
            if (confirm(`¿Eliminar el monitor "${monitor.name}" y su historial?`)) {
              await deleteMonitorAction(monitor.id);
              await onChanged();
            }
          }}
          className="rounded p-1.5 text-muted-foreground hover:text-danger"
          title="Eliminar"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function MonitorForm({
  monitor,
  onClose,
  onSaved,
}: {
  monitor: MonitorDTO | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = React.useState(monitor?.name ?? "");
  const [url, setUrl] = React.useState(monitor?.url ?? "");
  const [method, setMethod] = React.useState<HttpMethod>(monitor?.method ?? "GET");
  const [expectedStatus, setExpectedStatus] = React.useState(
    monitor?.expectedStatus.toString() ?? "0",
  );
  const [intervalSeconds, setIntervalSeconds] = React.useState(
    monitor?.intervalSeconds ?? 300,
  );
  const [timeoutMs, setTimeoutMs] = React.useState(monitor?.timeoutMs ?? 10000);
  const [active, setActive] = React.useState(monitor?.active ?? true);
  const [notifyOnFailure, setNotifyOnFailure] = React.useState(
    monitor?.notifyOnFailure ?? true,
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await saveMonitorAction({
        id: monitor?.id,
        name,
        url,
        method,
        expectedStatus: parseInt(expectedStatus, 10) || 0,
        intervalSeconds,
        timeoutMs,
        active,
        notifyOnFailure,
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
        {monitor ? "Editar monitor" : "Nuevo monitor"}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="mon-name">Nombre</Label>
          <Input id="mon-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mi web" autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mon-url">URL</Label>
          <Input id="mon-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://midominio.com" className="font-mono text-xs" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="mon-method">Método</Label>
            <select
              id="mon-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as HttpMethod)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mon-status">Estado esperado</Label>
            <Input id="mon-status" value={expectedStatus} onChange={(e) => setExpectedStatus(e.target.value)} inputMode="numeric" className="font-mono" placeholder="0 = cualquiera" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="mon-interval">Cada</Label>
            <select
              id="mon-interval"
              value={intervalSeconds}
              onChange={(e) => setIntervalSeconds(Number(e.target.value))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {INTERVALS.map((i) => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mon-timeout">Timeout (ms)</Label>
            <Input id="mon-timeout" value={timeoutMs} onChange={(e) => setTimeoutMs(Number(e.target.value) || 0)} inputMode="numeric" className="font-mono" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Activo
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={notifyOnFailure} onChange={(e) => setNotifyOnFailure(e.target.checked)} />
          Avisar por Telegram al caerse
        </label>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saving || !name || !url}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          Guardar
        </Button>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>
    </div>
  );
}

function relative(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "hace un momento";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}
