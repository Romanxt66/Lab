"use client";

import * as React from "react";
import { Loader2, X, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  coolifyEnvironmentsAction,
  createCoolifyAppAction,
} from "@/modules/coolify/actions";
import {
  BUILD_PACKS,
  type CoolifyEnvironment,
  type CoolifyProject,
  type CoolifyServer,
} from "@/modules/coolify/domain/resource";

/** Wizard to create a new application from a public repo or a raw Dockerfile. */
export function CreateAppDialog({
  projects,
  servers,
  onClose,
  onCreated,
}: {
  projects: CoolifyProject[];
  servers: CoolifyServer[];
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [source, setSource] = React.useState<"public" | "dockerfile">("public");
  const [name, setName] = React.useState("");
  const [projectUuid, setProjectUuid] = React.useState(projects[0]?.uuid ?? "");
  const [serverUuid, setServerUuid] = React.useState(servers[0]?.uuid ?? "");
  const [environments, setEnvironments] = React.useState<CoolifyEnvironment[]>([]);
  const [envUuid, setEnvUuid] = React.useState("");
  const [loadingEnvs, setLoadingEnvs] = React.useState(false);

  const [gitRepository, setGitRepository] = React.useState("");
  const [gitBranch, setGitBranch] = React.useState("main");
  const [buildPack, setBuildPack] = React.useState("nixpacks");
  const [dockerfile, setDockerfile] = React.useState("");
  const [domains, setDomains] = React.useState("");
  const [portsExposes, setPortsExposes] = React.useState("3000");
  const [instantDeploy, setInstantDeploy] = React.useState(true);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);

  // Load environments whenever the project changes.
  const loadEnvs = React.useCallback(async (uuid: string) => {
    if (!uuid) {
      setEnvironments([]);
      setEnvUuid("");
      return;
    }
    setLoadingEnvs(true);
    const res = await coolifyEnvironmentsAction(uuid);
    if (res.ok) {
      setEnvironments(res.value);
      setEnvUuid(res.value[0]?.uuid ?? "");
    } else {
      setEnvironments([]);
      setEnvUuid("");
    }
    setLoadingEnvs(false);
  }, []);

  React.useEffect(() => {
    void (async () => {
      await loadEnvs(projectUuid);
    })();
  }, [loadEnvs, projectUuid]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function create() {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    const env = environments.find((e) => e.uuid === envUuid);
    const res = await createCoolifyAppAction({
      source,
      name,
      projectUuid,
      environmentName: env?.name ?? "production",
      environmentUuid: envUuid,
      serverUuid,
      domains,
      portsExposes,
      instantDeploy,
      baseDirectory: "",
      gitRepository,
      gitBranch,
      buildPack,
      dockerfile,
    });
    setSaving(false);
    if (res.ok) {
      setOkMsg(res.value);
      await onCreated();
    } else {
      setError(res.error);
    }
  }

  const canCreate =
    projectUuid &&
    envUuid &&
    serverUuid &&
    (source === "public" ? gitRepository.trim() && gitBranch.trim() : dockerfile.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass flex max-h-[88vh] w-full max-w-lg flex-col overflow-y-auto rounded-xl border border-border/60 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="accent-grad flex size-8 items-center justify-center rounded-lg text-white">
              <Rocket className="size-4" />
            </span>
            <h3 className="font-medium">Nueva aplicación</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Source */}
        <div className="mb-4 inline-flex rounded-md border border-border p-0.5">
          {(
            [
              { id: "public", label: "Repo público" },
              { id: "dockerfile", label: "Dockerfile" },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              onClick={() => setSource(s.id)}
              className={cn(
                "rounded px-3 py-1 text-sm transition-colors",
                source === s.id
                  ? "accent-soft font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Proyecto">
              <Select
                value={projectUuid}
                onChange={setProjectUuid}
                options={projects.map((p) => ({ value: p.uuid, label: p.name }))}
              />
            </Field>
            <Field label={loadingEnvs ? "Entorno (cargando…)" : "Entorno"}>
              <Select
                value={envUuid}
                onChange={setEnvUuid}
                options={environments.map((e) => ({
                  value: e.uuid,
                  label: e.name,
                }))}
              />
            </Field>
          </div>

          <Field label="Servidor">
            <Select
              value={serverUuid}
              onChange={setServerUuid}
              options={servers.map((s) => ({ value: s.uuid, label: s.name }))}
            />
          </Field>

          <Field label="Nombre (opcional)">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mi-app"
            />
          </Field>

          {source === "public" ? (
            <>
              <Field label="Repositorio (URL pública)">
                <Input
                  value={gitRepository}
                  onChange={(e) => setGitRepository(e.target.value)}
                  placeholder="https://github.com/usuario/repo"
                  className="font-mono text-xs"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Rama">
                  <Input
                    value={gitBranch}
                    onChange={(e) => setGitBranch(e.target.value)}
                    placeholder="main"
                    className="font-mono"
                  />
                </Field>
                <Field label="Build pack">
                  <Select
                    value={buildPack}
                    onChange={setBuildPack}
                    options={BUILD_PACKS.map((b) => ({
                      value: b.id,
                      label: b.label,
                    }))}
                  />
                </Field>
              </div>
            </>
          ) : (
            <Field label="Dockerfile">
              <Textarea
                value={dockerfile}
                onChange={(e) => setDockerfile(e.target.value)}
                placeholder={"FROM node:24-slim\nWORKDIR /app\n…"}
                className="min-h-32 font-mono text-xs"
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Puerto expuesto">
              <Input
                value={portsExposes}
                onChange={(e) => setPortsExposes(e.target.value)}
                placeholder="3000"
                className="font-mono"
              />
            </Field>
            <Field label="Dominio (opcional)">
              <Input
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                placeholder="https://app.midominio.com"
                className="text-xs"
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={instantDeploy}
              onChange={(e) => setInstantDeploy(e.target.checked)}
            />
            Desplegar inmediatamente
          </label>

          {error ? (
            <p className="rounded-md bg-danger/10 p-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          {okMsg ? (
            <p className="rounded-md bg-success/10 p-2 text-sm text-success">
              {okMsg}
            </p>
          ) : null}

          <div className="flex items-center gap-2 pt-1">
            <Button onClick={create} disabled={saving || !canCreate}>
              {saving ? <Loader2 className="animate-spin" /> : <Rocket className="size-3.5" />}
              Crear aplicación
            </Button>
            <Button variant="ghost" onClick={onClose}>
              {okMsg ? "Cerrar" : "Cancelar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
    >
      {options.length === 0 ? <option value="">—</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
