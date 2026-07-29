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
  X,
  FolderPlus,
  Trash2,
  Pencil,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getCoolifyConfigAction,
  coolifyOverviewAction,
  deployCoolifyAction,
  controlCoolifyAction,
  coolifyDeploymentsAction,
  cancelCoolifyDeploymentAction,
  controlCoolifyResourceAction,
  coolifyResourceLogsAction,
  deleteCoolifyResourceAction,
  updateCoolifyProjectAction,
} from "@/modules/coolify/actions";
import type { CoolifyConfigDTO } from "@/modules/coolify/domain/config";
import {
  STATE_LABELS,
  DEPLOY_STATUS_LABELS,
  type CoolifyApp,
  type CoolifyDeployment,
  type CoolifyOverview,
  type CoolifyProject,
  type CoolifyResource,
} from "@/modules/coolify/domain/resource";
import type {
  AppAction,
  ResourceKind,
} from "@/modules/coolify/application/ports";
import { ConnectionPanel } from "./ConnectionPanel";
import { AppDetailDialog } from "./AppDetailDialog";
import { CreateAppDialog } from "./CreateAppDialog";
import { CreateDatabaseDialog } from "./CreateDatabaseDialog";
import { CreateProjectDialog } from "./CreateProjectDialog";
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
  const [creatingDb, setCreatingDb] = React.useState(false);
  const [creatingProject, setCreatingProject] = React.useState(false);

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
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCreatingDb(true)}
            disabled={loading || !overview}
          >
            <Database className="size-3.5" />
            Nueva BD
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCreatingProject(true)}
            disabled={loading}
          >
            <FolderPlus className="size-3.5" />
            Proyecto
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

      <DeploymentsSection />

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
              kind="databases"
              icon={<Database className="size-4" />}
              items={overview.databases}
              onRefresh={refresh}
            />
            <ResourceList
              title="Servicios"
              kind="services"
              icon={<Boxes className="size-4" />}
              items={overview.services}
              onRefresh={refresh}
            />
          </div>

          {/* Projects */}
          {overview.projects.length > 0 ? (
            <ProjectsSection projects={overview.projects} onRefresh={refresh} />
          ) : null}

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

      {creatingDb && overview ? (
        <CreateDatabaseDialog
          projects={overview.projects}
          servers={overview.servers}
          onClose={() => setCreatingDb(false)}
          onCreated={refresh}
        />
      ) : null}

      {creatingProject ? (
        <CreateProjectDialog
          onClose={() => setCreatingProject(false)}
          onCreated={refresh}
        />
      ) : null}
    </div>
  );
}

const DEPLOY_DOT: Record<string, string> = {
  in_progress: "bg-[oklch(0.7_0.14_75)] animate-pulse",
  queued: "bg-muted-foreground/50",
  finished: "bg-success",
  failed: "bg-danger",
  cancelled: "bg-muted-foreground/40",
};

function DeploymentsSection() {
  const [deps, setDeps] = React.useState<CoolifyDeployment[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await coolifyDeploymentsAction();
    if (res.ok) setDeps(res.value);
    setLoaded(true);
  }, []);

  React.useEffect(() => {
    void (async () => {
      await load();
    })();
    // Poll so in-progress deployments update live.
    const id = setInterval(() => void load(), 6000);
    return () => clearInterval(id);
  }, [load]);

  // Keep the dashboard clean when there's nothing to show.
  if (!loaded || deps.length === 0) return null;

  const recent = deps.slice(0, 6);

  return (
    <section>
      <SectionTitle count={deps.length}>Despliegues</SectionTitle>
      <div className="glass divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
        {recent.map((d) => {
          const active = d.status === "in_progress" || d.status === "queued";
          return (
            <div key={d.uuid} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  DEPLOY_DOT[d.status] ?? "bg-muted-foreground/40",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.applicationName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {DEPLOY_STATUS_LABELS[d.status]}
                  {d.commitMessage ? ` · ${d.commitMessage}` : d.commit ? ` · ${d.commit.slice(0, 7)}` : ""}
                  {d.createdAt ? ` · ${formatWhen(d.createdAt)}` : ""}
                </p>
              </div>
              {active ? <CancelDeployButton uuid={d.uuid} onDone={load} /> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CancelDeployButton({
  uuid,
  onDone,
}: {
  uuid: string;
  onDone: () => void | Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await cancelCoolifyDeploymentAction(uuid);
        setBusy(false);
        await onDone();
      }}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
      Cancelar
    </Button>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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
        <DeleteBtn
          label={`la aplicación "${app.name}"`}
          onDelete={() => deleteCoolifyResourceAction("applications", app.uuid)}
          onDone={onChanged}
        />
      </div>
    </div>
  );
}

/** Trash button with confirm + inline busy state, for destructive deletes. */
function DeleteBtn({
  label,
  onDelete,
  onDone,
}: {
  label: string;
  onDelete: () => Promise<{ ok: true; value: string } | { ok: false; error: string }>;
  onDone: () => void | Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      title="Eliminar"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;
        setBusy(true);
        const res = await onDelete();
        setBusy(false);
        if (res.ok) await onDone();
        else alert(res.error);
      }}
      className="rounded p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </button>
  );
}

function ProjectsSection({
  projects,
  onRefresh,
}: {
  projects: CoolifyProject[];
  onRefresh: () => void | Promise<void>;
}) {
  const [editing, setEditing] = React.useState<CoolifyProject | null>(null);
  return (
    <section>
      <SectionTitle count={projects.length}>Proyectos</SectionTitle>
      <div className="glass divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
        {projects.map((p) => (
          <div key={p.uuid} className="group flex items-center gap-3 px-4 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.name}</p>
              {p.description ? (
                <p className="truncate text-xs text-muted-foreground">
                  {p.description}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <IconBtn title="Editar" onClick={() => setEditing(p)}>
                <Pencil className="size-3.5" />
              </IconBtn>
              <DeleteBtn
                label={`el proyecto "${p.name}" (y todo su contenido)`}
                onDelete={() => deleteCoolifyResourceAction("projects", p.uuid)}
                onDone={onRefresh}
              />
            </div>
          </div>
        ))}
      </div>
      {editing ? (
        <EditProjectDialog
          project={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await onRefresh();
          }}
        />
      ) : null}
    </section>
  );
}

function EditProjectDialog({
  project,
  onClose,
  onSaved,
}: {
  project: CoolifyProject;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = React.useState(project.name);
  const [description, setDescription] = React.useState(project.description ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await updateCoolifyProjectAction(project.uuid, { name, description });
    setSaving(false);
    if (res.ok) await onSaved();
    else setError(res.error);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-sm rounded-xl border border-border/60 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-medium">Editar proyecto</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción"
          />
          {error ? (
            <p className="rounded-md bg-danger/10 p-2 text-sm text-danger">{error}</p>
          ) : null}
          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="animate-spin" /> : <Check className="size-3.5" />}
              Guardar
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourceList({
  title,
  kind,
  icon,
  items,
  onRefresh,
}: {
  title: string;
  kind: ResourceKind;
  icon: React.ReactNode;
  items: CoolifyResource[];
  onRefresh: () => void | Promise<void>;
}) {
  const [logsFor, setLogsFor] = React.useState<CoolifyResource | null>(null);
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
            <ResourceRow
              key={r.uuid}
              resource={r}
              kind={kind}
              onLogs={() => setLogsFor(r)}
              onChanged={onRefresh}
            />
          ))}
        </div>
      )}
      {logsFor ? (
        <ResourceLogsDialog
          kind={kind}
          resource={logsFor}
          onClose={() => setLogsFor(null)}
        />
      ) : null}
    </section>
  );
}

function ResourceRow({
  resource,
  kind,
  onLogs,
  onChanged,
}: {
  resource: CoolifyResource;
  kind: ResourceKind;
  onLogs: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [busy, setBusy] = React.useState<null | AppAction>(null);
  const running = resource.state === "running" || resource.state === "degraded";

  async function act(action: AppAction) {
    setBusy(action);
    await controlCoolifyResourceAction(kind, resource.uuid, action);
    setBusy(null);
    setTimeout(() => void onChanged(), 1200);
  }

  return (
    <div className="group flex items-center gap-2 px-4 py-2.5 text-sm">
      <span className={cn("size-2 shrink-0 rounded-full", STATE_DOT[resource.state])} />
      <span className="min-w-0 flex-1 truncate font-medium">{resource.name}</span>
      <span className={cn("shrink-0 text-xs", STATE_TEXT[resource.state])}>
        {STATE_LABELS[resource.state]}
      </span>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {running ? (
          <IconBtn title="Detener" busy={busy === "stop"} onClick={() => act("stop")}>
            <Square className="size-3.5" />
          </IconBtn>
        ) : (
          <IconBtn title="Iniciar" busy={busy === "start"} onClick={() => act("start")}>
            <Play className="size-3.5" />
          </IconBtn>
        )}
        <IconBtn title="Reiniciar" busy={busy === "restart"} onClick={() => act("restart")}>
          <RotateCw className="size-3.5" />
        </IconBtn>
        <IconBtn title="Logs" onClick={onLogs}>
          <ScrollText className="size-3.5" />
        </IconBtn>
        <DeleteBtn
          label={`"${resource.name}"`}
          onDelete={() => deleteCoolifyResourceAction(kind, resource.uuid)}
          onDone={onChanged}
        />
      </div>
    </div>
  );
}

function IconBtn({
  children,
  title,
  busy,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={busy}
      className="rounded p-1.5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : children}
    </button>
  );
}

function ResourceLogsDialog({
  kind,
  resource,
  onClose,
}: {
  kind: ResourceKind;
  resource: CoolifyResource;
  onClose: () => void;
}) {
  const [logs, setLogs] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await coolifyResourceLogsAction(kind, resource.uuid, 300);
    if (res.ok) setLogs(res.value || "(sin logs)");
    else setError(res.error);
    setLoading(false);
  }, [kind, resource.uuid]);

  React.useEffect(() => {
    void (async () => {
      await load();
    })();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [load, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border/60 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="truncate font-medium">{resource.name} · logs</h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
            <button
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
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
      </div>
    </div>
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
