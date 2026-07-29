"use client";

import * as React from "react";
import {
  Loader2,
  RefreshCw,
  Rocket,
  Play,
  Square,
  RotateCw,
  ScrollText,
  Settings,
  ExternalLink,
  Server,
  Database,
  Boxes,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getCoolifyConfigAction,
  coolifyOverviewAction,
  deployCoolifyAction,
  controlCoolifyAction,
} from "@/modules/coolify/actions";
import type { CoolifyConfigDTO } from "@/modules/coolify/domain/config";
import {
  STATE_LABELS,
  type CoolifyApp,
  type CoolifyOverview,
  type CoolifyResource,
} from "@/modules/coolify/domain/resource";
import type { AppAction } from "@/modules/coolify/application/ports";
import { ConnectionPanel } from "./ConnectionPanel";
import { AppDetailDialog } from "./AppDetailDialog";
import { CreateAppDialog } from "./CreateAppDialog";
import { STATE_DOT, STATE_TEXT } from "./status";

export function CoolifyTool() {
  const [config, setConfig] = React.useState<CoolifyConfigDTO | null>(null);
  const [loadingConfig, setLoadingConfig] = React.useState(true);
  const [showSettings, setShowSettings] = React.useState(false);

  const refreshConfig = React.useCallback(async () => {
    setConfig(await getCoolifyConfigAction());
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
      <div className="space-y-4">
        {config ? (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
              Volver al panel
            </Button>
          </div>
        ) : null}
        <ConnectionPanel
          config={config}
          onChanged={async () => {
            await refreshConfig();
            setShowSettings(false);
          }}
        />
      </div>
    );
  }

  return (
    <Dashboard config={config} onOpenSettings={() => setShowSettings(true)} />
  );
}

function Dashboard({
  config,
  onOpenSettings,
}: {
  config: CoolifyConfigDTO;
  onOpenSettings: () => void;
}) {
  const [overview, setOverview] = React.useState<CoolifyOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<CoolifyApp | null>(null);
  const [creating, setCreating] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await coolifyOverviewAction();
      if (res.ok) setOverview(res.value);
      else setError(res.error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 rounded-full bg-success" />
          Conectado a{" "}
          <a
            href={config.baseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
          >
            {config.baseUrl.replace(/^https?:\/\//, "")}
            <ExternalLink className="size-3" />
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            disabled={loading || !overview}
          >
            <Rocket className="size-3.5" />
            Nueva app
          </Button>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Actualizar
          </Button>
          <Button variant="ghost" size="sm" onClick={onOpenSettings}>
            <Settings className="size-3.5" />
            Conexión
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{error}</p>
      ) : null}

      {loading && !overview ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando recursos de Coolify…
        </p>
      ) : overview ? (
        <>
          {/* Applications */}
          <section>
            <SectionTitle count={overview.apps.length}>Aplicaciones</SectionTitle>
            {overview.apps.length === 0 ? (
              <Empty>No hay aplicaciones en esta instancia.</Empty>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {overview.apps.map((app) => (
                  <AppCard
                    key={app.uuid}
                    app={app}
                    onDetails={() => setDetail(app)}
                    onChanged={refresh}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Databases + Services */}
          <div className="grid gap-6 md:grid-cols-2">
            <ResourceList
              title="Bases de datos"
              icon={<Database className="size-4" />}
              items={overview.databases}
            />
            <ResourceList
              title="Servicios"
              icon={<Boxes className="size-4" />}
              items={overview.services}
            />
          </div>

          {/* Servers */}
          {overview.servers.length > 0 ? (
            <section>
              <SectionTitle count={overview.servers.length}>
                Servidores
              </SectionTitle>
              <div className="glass divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
                {overview.servers.map((s) => (
                  <div
                    key={s.uuid}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm"
                  >
                    <Server className="size-4 text-muted-foreground" />
                    <span className="font-medium">{s.name}</span>
                    {s.ip ? (
                      <span className="font-mono text-xs text-muted-foreground">
                        {s.ip}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "ml-auto inline-flex items-center gap-1.5 text-xs",
                        s.reachable === false
                          ? "text-danger"
                          : "text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          s.reachable === false ? "bg-danger" : "bg-success",
                        )}
                      />
                      {s.reachable === false ? "Inalcanzable" : "OK"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {detail ? (
        <AppDetailDialog app={detail} onClose={() => setDetail(null)} />
      ) : null}

      {creating && overview ? (
        <CreateAppDialog
          projects={overview.projects}
          servers={overview.servers}
          onClose={() => setCreating(false)}
          onCreated={refresh}
        />
      ) : null}
    </div>
  );
}

function AppCard({
  app,
  onDetails,
  onChanged,
}: {
  app: CoolifyApp;
  onDetails: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [busy, setBusy] = React.useState<null | "deploy" | AppAction>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  async function run(
    which: "deploy" | AppAction,
    fn: () => Promise<{ ok: true; value: string } | { ok: false; error: string }>,
  ) {
    setBusy(which);
    setMsg(null);
    setErr(null);
    try {
      const res = await fn();
      if (res.ok) {
        setMsg(res.value);
        // Give Coolify a moment, then refresh statuses.
        setTimeout(() => void onChanged(), 1500);
      } else {
        setErr(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  const running = app.state === "running" || app.state === "degraded";

  return (
    <div className="glass flex flex-col gap-3 rounded-lg border border-border/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", STATE_DOT[app.state])} />
            <h3 className="truncate font-medium">{app.name}</h3>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[app.projectName, app.environmentName].filter(Boolean).join(" / ") ||
              "—"}
          </p>
        </div>
        <span className={cn("shrink-0 text-xs", STATE_TEXT[app.state])}>
          {STATE_LABELS[app.state]}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {app.fqdn ? (
          <a
            href={app.fqdn}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            {app.fqdn.replace(/^https?:\/\//, "")}
            <ExternalLink className="size-3" />
          </a>
        ) : null}
        {app.gitBranch ? (
          <span className="inline-flex items-center gap-1">
            <GitBranch className="size-3" />
            {app.gitBranch}
          </span>
        ) : null}
        {app.buildPack ? <span>· {app.buildPack}</span> : null}
      </div>

      {msg ? <p className="text-xs text-success">{msg}</p> : null}
      {err ? <p className="text-xs text-danger">{err}</p> : null}

      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
        <Button
          size="sm"
          onClick={() => run("deploy", () => deployCoolifyAction(app.uuid, false))}
          disabled={busy !== null}
        >
          {busy === "deploy" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Rocket className="size-3.5" />
          )}
          Desplegar
        </Button>
        {running ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => run("stop", () => controlCoolifyAction(app.uuid, "stop"))}
            disabled={busy !== null}
          >
            {busy === "stop" ? <Loader2 className="animate-spin" /> : <Square className="size-3.5" />}
            Detener
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => run("start", () => controlCoolifyAction(app.uuid, "start"))}
            disabled={busy !== null}
          >
            {busy === "start" ? <Loader2 className="animate-spin" /> : <Play className="size-3.5" />}
            Iniciar
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => run("restart", () => controlCoolifyAction(app.uuid, "restart"))}
          disabled={busy !== null}
          title="Reiniciar"
        >
          {busy === "restart" ? <Loader2 className="animate-spin" /> : <RotateCw className="size-3.5" />}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDetails} className="ml-auto">
          <ScrollText className="size-3.5" />
          Logs
        </Button>
      </div>
    </div>
  );
}

function ResourceList({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: CoolifyResource[];
}) {
  return (
    <section>
      <SectionTitle count={items.length} icon={icon}>
        {title}
      </SectionTitle>
      {items.length === 0 ? (
        <Empty>Sin {title.toLowerCase()}.</Empty>
      ) : (
        <div className="glass divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
          {items.map((r) => (
            <div key={r.uuid} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className={cn("size-2 shrink-0 rounded-full", STATE_DOT[r.state])} />
              <span className="truncate font-medium">{r.name}</span>
              <span className={cn("ml-auto text-xs", STATE_TEXT[r.state])}>
                {STATE_LABELS[r.state]}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SectionTitle({
  children,
  count,
  icon,
}: {
  children: React.ReactNode;
  count?: number;
  icon?: React.ReactNode;
}) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
      {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      {children}
      {count !== undefined ? (
        <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
          {count}
        </span>
      ) : null}
    </h2>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
