"use client";

import * as React from "react";
import { Loader2, Plug, Unplug, ExternalLink, RefreshCw, Workflow, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import { cn } from "@/lib/utils";
import {
  getN8nConfigAction,
  connectN8nAction,
  disconnectN8nAction,
  listN8nWorkflowsAction,
  setN8nWorkflowActiveAction,
} from "@/modules/n8n/actions";
import type { N8nConfigDTO } from "@/modules/n8n/domain/config";
import type { N8nWorkflow } from "@/modules/n8n/domain/workflow";

export function N8nTool() {
  const [config, setConfig] = React.useState<N8nConfigDTO | null>(null);
  const [loadingConfig, setLoadingConfig] = React.useState(true);
  const [showSettings, setShowSettings] = React.useState(false);

  const refreshConfig = React.useCallback(async () => {
    setConfig(await getN8nConfigAction());
  }, []);

  React.useEffect(() => {
    void (async () => {
      await refreshConfig();
      setLoadingConfig(false);
    })();
  }, [refreshConfig]);

  if (loadingConfig) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando…
      </div>
    );
  }

  if (!config || showSettings) {
    return (
      <ConnectionPanel
        config={config}
        onClose={config ? () => setShowSettings(false) : undefined}
        onChanged={async () => {
          await refreshConfig();
          setShowSettings(false);
        }}
      />
    );
  }

  return <WorkflowList config={config} onSettings={() => setShowSettings(true)} />;
}

function ConnectionPanel({
  config,
  onClose,
  onChanged,
}: {
  config: N8nConfigDTO | null;
  onClose?: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [baseUrl, setBaseUrl] = React.useState(config?.baseUrl ?? "");
  const [apiKey, setApiKey] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function connect() {
    setSaving(true);
    setError(null);
    try {
      const res = await connectN8nAction({ baseUrl, apiKey });
      if (res.ok) {
        setApiKey("");
        await onChanged();
      } else {
        setError(res.error);
      }
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!confirm("¿Desconectar n8n? Se borrará la URL y el API key guardados.")) return;
    setSaving(true);
    try {
      await disconnectN8nAction();
      setApiKey("");
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass mx-auto max-w-lg rounded-xl border border-border/60 p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="accent-grad flex size-10 items-center justify-center rounded-lg text-white">
          <Workflow className="size-5" />
        </span>
        <div>
          <h2 className="font-medium">Conecta tu n8n</h2>
          <p className="text-sm text-muted-foreground">
            {config
              ? "Conectado. Actualiza el API key o desconecta."
              : "URL de tu instancia + un API key."}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="n8n-url">URL de n8n</Label>
          <Input
            id="n8n-url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://n8n.midominio.com"
            inputMode="url"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="n8n-key">
            API key {config ? "(deja vacío para conservar el actual)" : ""}
          </Label>
          <Input
            id="n8n-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="n8n_api_xxxxxxxx…"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            En n8n: <strong>Settings → n8n API → Create an API key</strong>.
          </p>
        </div>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <div className="flex items-center gap-2">
          <Button onClick={connect} disabled={saving || !baseUrl || (!config && !apiKey)}>
            {saving ? <Loader2 className="animate-spin" /> : <Plug />}
            {config ? "Guardar" : "Conectar"}
          </Button>
          {config ? (
            <>
              {onClose ? (
                <Button variant="ghost" onClick={onClose} disabled={saving}>
                  Cancelar
                </Button>
              ) : null}
              <Button variant="ghost" onClick={disconnect} disabled={saving}>
                <Unplug />
                Desconectar
              </Button>
              <a
                href={config.baseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Abrir n8n <ExternalLink className="size-3" />
              </a>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WorkflowList({
  config,
  onSettings,
}: {
  config: N8nConfigDTO;
  onSettings: () => void;
}) {
  const [workflows, setWorkflows] = React.useState<N8nWorkflow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listN8nWorkflowsAction();
    if (res.ok) setWorkflows(res.value);
    else setError(res.error);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  async function toggle(w: N8nWorkflow) {
    setBusyId(w.id);
    const res = await setN8nWorkflowActiveAction(w.id, !w.active);
    if (!res.ok) setError(res.error);
    await refresh();
    setBusyId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Workflows de n8n</h2>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{config.baseUrl}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={onSettings}>
            <Settings className="size-3.5" />
            Configuración
          </Button>
        </div>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {loading && !workflows ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </p>
      ) : !workflows || workflows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
          <Workflow className="mx-auto mb-2 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Sin workflows en esta instancia.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workflows.map((w) => (
            <div key={w.id} className="glass flex items-center justify-between gap-3 rounded-lg border border-border/60 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{w.name}</p>
                <p className="text-xs text-muted-foreground">
                  {w.updatedAt ? new Date(w.updatedAt).toLocaleString() : "—"}
                </p>
              </div>
              <button
                onClick={() => toggle(w)}
                disabled={busyId === w.id}
                className={cn(
                  "shrink-0 rounded px-2 py-1 text-xs font-medium",
                  w.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                )}
              >
                {busyId === w.id ? <Loader2 className="size-3 animate-spin" /> : w.active ? "Activo" : "Inactivo"}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Para disparar un workflow desde una automatización del Lab, usa la
        acción &ldquo;n8n: llamar webhook&rdquo; en{" "}
        <strong>Automatizaciones</strong> con la URL del nodo Webhook del
        workflow correspondiente.
      </p>
    </div>
  );
}
