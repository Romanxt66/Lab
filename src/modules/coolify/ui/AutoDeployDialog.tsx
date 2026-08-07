"use client";

import * as React from "react";
import {
  Loader2,
  X,
  Wand2,
  Rocket,
  Copy,
  Check,
  Database,
  Server,
  Package,
  Boxes,
  GitCommitHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  analyzeRepoAction,
  commitGeneratedFileAction,
} from "@/modules/deploygen/actions";
import type { AnalyzeResult } from "@/modules/deploygen/application/deploygen-service";
import {
  coolifyEnvironmentsAction,
  createCoolifyAppAction,
  createCoolifyServiceAction,
} from "@/modules/coolify/actions";
import {
  BUILD_PACKS,
  type CoolifyEnvironment,
  type CoolifyProject,
  type CoolifyServer,
} from "@/modules/coolify/domain/resource";

/**
 * "Analizar y desplegar": paste a repo, detect its stack, review the generated
 * Dockerfile/compose, and create the app in Coolify (Nixpacks by default).
 */
export function AutoDeployDialog({
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
  const [repoUrl, setRepoUrl] = React.useState("");
  const [branch, setBranch] = React.useState("");
  const [baseDir, setBaseDir] = React.useState("");
  const [analyzing, setAnalyzing] = React.useState(false);
  const [result, setResult] = React.useState<AnalyzeResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    setResult(null);
    const res = await analyzeRepoAction(repoUrl, branch.trim() || null, baseDir.trim());
    setAnalyzing(false);
    if (res.ok) setResult(res.value);
    else setError(res.error);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-xl border border-border/60 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="accent-grad flex size-8 items-center justify-center rounded-lg text-white">
              <Wand2 className="size-4" />
            </span>
            <h3 className="font-medium">Analizar y desplegar</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Repo input */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label htmlFor="ad-repo">Repositorio (público)</Label>
            <Input
              id="ad-repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/usuario/repo"
              className="font-mono text-xs"
            />
          </div>
          <div className="w-24 space-y-1.5">
            <Label htmlFor="ad-branch">Rama</Label>
            <Input
              id="ad-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="auto"
              className="font-mono"
            />
          </div>
          <div className="w-32 space-y-1.5">
            <Label htmlFor="ad-dir">Subcarpeta</Label>
            <Input
              id="ad-dir"
              value={baseDir}
              onChange={(e) => setBaseDir(e.target.value)}
              placeholder="raíz"
              className="font-mono text-xs"
            />
          </div>
          <Button onClick={analyze} disabled={analyzing || !repoUrl.trim()}>
            {analyzing ? <Loader2 className="animate-spin" /> : <Wand2 className="size-3.5" />}
            Analizar
          </Button>
        </div>

        {error ? (
          <p className="mt-3 rounded-md bg-danger/10 p-2 text-sm text-danger">{error}</p>
        ) : null}

        {result ? (
          <AnalysisResult
            result={result}
            repoUrl={repoUrl}
            projects={projects}
            servers={servers}
            onCreated={onCreated}
          />
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            Pega la URL de un repositorio público de GitHub. Detectaré el stack y
            generaré el Dockerfile/compose y la configuración de despliegue.
          </p>
        )}
      </div>
    </div>
  );
}

function AnalysisResult({
  result,
  repoUrl,
  projects,
  servers,
  onCreated,
}: {
  result: AnalyzeResult;
  repoUrl: string;
  projects: CoolifyProject[];
  servers: CoolifyServer[];
  onCreated: () => void | Promise<void>;
}) {
  const d = result.detection;
  const [projectUuid, setProjectUuid] = React.useState(projects[0]?.uuid ?? "");
  const [serverUuid, setServerUuid] = React.useState(servers[0]?.uuid ?? "");
  const [environments, setEnvironments] = React.useState<CoolifyEnvironment[]>([]);
  const [envUuid, setEnvUuid] = React.useState("");
  const [name, setName] = React.useState(result.repo);
  const [buildPack, setBuildPack] = React.useState(
    d.recommendedBuildPack === "static" ? "static" : d.recommendedBuildPack === "dockerfile" ? "dockerfile" : "nixpacks",
  );
  const [deploying, setDeploying] = React.useState(false);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadEnvs = React.useCallback(async (uuid: string) => {
    if (!uuid) {
      setEnvironments([]);
      setEnvUuid("");
      return;
    }
    const res = await coolifyEnvironmentsAction(uuid);
    if (res.ok) {
      setEnvironments(res.value);
      setEnvUuid(res.value[0]?.uuid ?? "");
    }
  }, []);

  React.useEffect(() => {
    void (async () => {
      await loadEnvs(projectUuid);
    })();
  }, [loadEnvs, projectUuid]);

  function currentEnvName() {
    return environments.find((e) => e.uuid === envUuid)?.name ?? "production";
  }

  async function deploy() {
    setDeploying(true);
    setError(null);
    setOkMsg(null);
    const res = await createCoolifyAppAction({
      source: "public",
      name,
      projectUuid,
      environmentName: currentEnvName(),
      environmentUuid: envUuid,
      serverUuid,
      domains: "",
      portsExposes: String(d.port),
      instantDeploy: true,
      baseDirectory: result.baseDir,
      gitRepository: repoUrl,
      gitBranch: result.branch,
      buildPack,
      dockerfile: "",
    });
    setDeploying(false);
    if (res.ok) {
      setOkMsg(res.value);
      await onCreated();
    } else {
      setError(res.error);
    }
  }

  async function deployCompose() {
    if (!result.compose) return;
    setDeploying(true);
    setError(null);
    setOkMsg(null);
    const res = await createCoolifyServiceAction({
      name: name || result.repo,
      projectUuid,
      environmentName: currentEnvName(),
      environmentUuid: envUuid,
      serverUuid,
      dockerCompose: result.compose,
      instantDeploy: true,
    });
    setDeploying(false);
    if (res.ok) {
      setOkMsg(res.value);
      await onCreated();
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Detection summary */}
      <div className="glass rounded-lg border border-border/60 p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge icon={<Package className="size-3" />}>
            {d.runtime}
            {d.framework ? ` · ${d.framework}` : ""}
          </Badge>
          {d.packageManager ? <Badge>{d.packageManager}</Badge> : null}
          <Badge icon={<Server className="size-3" />}>puerto {d.port}</Badge>
          <Badge>build: {d.recommendedBuildPack}</Badge>
          {d.needsDatabase && d.databaseType ? (
            <Badge icon={<Database className="size-3" />}>{d.databaseType}</Badge>
          ) : null}
        </div>
        {d.notes.length > 0 ? (
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {d.notes.map((n, i) => (
              <li key={i}>· {n}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Generated files */}
      <CodeBlock
        title="Dockerfile generado"
        code={result.dockerfile}
        commit={{
          repoUrl,
          branch: result.branch,
          baseDir: result.baseDir,
          fileName: "Dockerfile",
        }}
      />
      {result.compose ? (
        <CodeBlock
          title="docker-compose (app + BD)"
          code={result.compose}
          commit={{
            repoUrl,
            branch: result.branch,
            baseDir: result.baseDir,
            fileName: "docker-compose.yml",
          }}
        />
      ) : null}

      {/* Deploy config */}
      <div className="glass space-y-3 rounded-lg border border-border/60 p-3">
        <p className="text-sm font-medium">Desplegar en Coolify</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Proyecto">
            <Select value={projectUuid} onChange={setProjectUuid} options={projects.map((p) => ({ value: p.uuid, label: p.name }))} />
          </Field>
          <Field label="Entorno">
            <Select value={envUuid} onChange={setEnvUuid} options={environments.map((e) => ({ value: e.uuid, label: e.name }))} />
          </Field>
          <Field label="Servidor">
            <Select value={serverUuid} onChange={setServerUuid} options={servers.map((s) => ({ value: s.uuid, label: s.name }))} />
          </Field>
          <Field label="Build pack">
            <Select value={buildPack} onChange={setBuildPack} options={BUILD_PACKS.map((b) => ({ value: b.id, label: b.label }))} />
          </Field>
          <Field label="Nombre">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>

        <p className="text-xs text-muted-foreground">
          Con <strong>Nixpacks</strong> no necesitas el Dockerfile en el repo:
          Coolify construye solo. Si prefieres <strong>Dockerfile</strong>, copia
          el de arriba a tu repo y elige ese build pack.
        </p>

        {error ? (
          <p className="rounded-md bg-danger/10 p-2 text-sm text-danger">{error}</p>
        ) : null}
        {okMsg ? (
          <p className="rounded-md bg-success/10 p-2 text-sm text-success">
            {okMsg}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={deploy}
            disabled={deploying || !projectUuid || !envUuid || !serverUuid}
          >
            {deploying ? <Loader2 className="animate-spin" /> : <Rocket className="size-3.5" />}
            Crear y desplegar
          </Button>
          {result.compose ? (
            <Button
              variant="outline"
              onClick={deployCompose}
              disabled={deploying || !projectUuid || !envUuid || !serverUuid}
              title="Crea un servicio en Coolify con el docker-compose generado (app + BD)"
            >
              <Boxes className="size-3.5" />
              Desplegar como Compose
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Badge({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium">
      {icon}
      {children}
    </span>
  );
}

function CodeBlock({
  title,
  code,
  commit,
}: {
  title: string;
  code: string;
  /** When set, offers to commit this file into the repo. */
  commit?: {
    repoUrl: string;
    branch: string;
    baseDir: string;
    fileName: string;
  };
}) {
  const [copied, setCopied] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  async function saveToRepo() {
    if (!commit) return;
    const target = commit.baseDir
      ? `${commit.baseDir}/${commit.fileName}`
      : commit.fileName;
    if (
      !confirm(
        `¿Guardar ${target} en la rama "${commit.branch}" del repositorio?\n\nSe hará un commit en GitHub (requiere token con permiso de escritura).`,
      )
    ) {
      return;
    }
    setSaving(true);
    setMsg(null);
    setErr(null);
    const res = await commitGeneratedFileAction({
      repoUrl: commit.repoUrl,
      branch: commit.branch,
      baseDir: commit.baseDir,
      fileName: commit.fileName,
      content: code,
    });
    setSaving(false);
    if (res.ok) setMsg(res.value);
    else setErr(res.error);
  }

  return (
    <div className="rounded-lg border border-border/60">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5">
        <span className="text-xs font-medium">{title}</span>
        <div className="flex items-center gap-3">
          {commit ? (
            <button
              onClick={saveToRepo}
              disabled={saving}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              title="Hace commit del archivo en tu repositorio de GitHub"
            >
              {saving ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <GitCommitHorizontal className="size-3" />
              )}
              Guardar en el repo
            </button>
          ) : null}
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* clipboard may be blocked */
              }
            }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>
      {msg ? (
        <p className="border-b border-border/60 px-3 py-1.5 text-xs text-success">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="border-b border-border/60 px-3 py-1.5 text-xs text-danger">
          {err}
        </p>
      ) : null}
      <pre className="max-h-56 overflow-auto p-3 font-mono text-xs leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
