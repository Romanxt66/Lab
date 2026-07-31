"use client";

import * as React from "react";
import { Loader2, X, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  coolifyEnvironmentsAction,
  createCoolifyServiceAction,
} from "@/modules/coolify/actions";
import {
  type CoolifyEnvironment,
  type CoolifyProject,
  type CoolifyServer,
} from "@/modules/coolify/domain/resource";
import { databaseComposeTemplate } from "@/modules/deploygen/domain/generate";

const DB_TEMPLATES: { id: string; label: string }[] = [
  { id: "", label: "En blanco" },
  { id: "postgresql", label: "PostgreSQL" },
  { id: "mysql", label: "MySQL" },
  { id: "mariadb", label: "MariaDB" },
  { id: "mongodb", label: "MongoDB" },
  { id: "redis", label: "Redis" },
];

/**
 * Create a Coolify service from a raw docker-compose — the same way Coolify's
 * "Docker Compose" resource works. Includes one-click database templates that
 * use Coolify's magic SERVICE_* variables to auto-generate credentials.
 */
export function CreateServiceDialog({
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
  const [name, setName] = React.useState("");
  const [compose, setCompose] = React.useState("");
  const [projectUuid, setProjectUuid] = React.useState(projects[0]?.uuid ?? "");
  const [serverUuid, setServerUuid] = React.useState(servers[0]?.uuid ?? "");
  const [environments, setEnvironments] = React.useState<CoolifyEnvironment[]>([]);
  const [envUuid, setEnvUuid] = React.useState("");
  const [instantDeploy, setInstantDeploy] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);

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

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function applyTemplate(id: string) {
    if (!id) return;
    setCompose(databaseComposeTemplate(id));
    if (!name.trim()) setName(id);
  }

  async function create() {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    const env = environments.find((e) => e.uuid === envUuid);
    const res = await createCoolifyServiceAction({
      name,
      projectUuid,
      environmentName: env?.name ?? "production",
      environmentUuid: envUuid,
      serverUuid,
      dockerCompose: compose,
      instantDeploy,
    });
    setSaving(false);
    if (res.ok) {
      setOkMsg(res.value);
      await onCreated();
    } else {
      setError(res.error);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-xl border border-border/60 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="accent-grad flex size-8 items-center justify-center rounded-lg text-white">
              <Boxes className="size-4" />
            </span>
            <h3 className="font-medium">Servicio desde docker-compose</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Plantilla de base de datos (opcional)">
            <Select
              value=""
              onChange={applyTemplate}
              options={DB_TEMPLATES.map((t) => ({ value: t.id, label: t.label }))}
            />
          </Field>

          <Field label="docker-compose">
            <Textarea
              value={compose}
              onChange={(e) => setCompose(e.target.value)}
              placeholder={"services:\n  app:\n    image: nginx:alpine"}
              className="min-h-40 font-mono text-xs"
            />
          </Field>

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
            <Field label="Nombre">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mi-servicio" />
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

          <p className="text-xs text-muted-foreground">
            Las plantillas usan variables mágicas de Coolify (SERVICE_PASSWORD_*)
            para generar las credenciales automáticamente.
          </p>

          {error ? (
            <p className="rounded-md bg-danger/10 p-2 text-sm text-danger">{error}</p>
          ) : null}
          {okMsg ? (
            <p className="rounded-md bg-success/10 p-2 text-sm text-success">{okMsg}</p>
          ) : null}

          <div className="flex items-center gap-2 pt-1">
            <Button
              onClick={create}
              disabled={saving || !compose.trim() || !projectUuid || !envUuid || !serverUuid}
            >
              {saving ? <Loader2 className="animate-spin" /> : <Boxes className="size-3.5" />}
              Crear servicio
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
