"use client";

import * as React from "react";
import { Loader2, X, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  coolifyEnvironmentsAction,
  createCoolifyDatabaseAction,
} from "@/modules/coolify/actions";
import {
  DATABASE_TYPES,
  type CoolifyEnvironment,
  type CoolifyProject,
  type CoolifyServer,
} from "@/modules/coolify/domain/resource";

/** Wizard to create a new managed database in Coolify. */
export function CreateDatabaseDialog({
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
  const [type, setType] = React.useState("postgresql");
  const [name, setName] = React.useState("");
  const [image, setImage] = React.useState("");
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

  async function create() {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    const env = environments.find((e) => e.uuid === envUuid);
    const res = await createCoolifyDatabaseAction({
      type,
      name,
      image,
      projectUuid,
      environmentName: env?.name ?? "production",
      environmentUuid: envUuid,
      serverUuid,
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
        className="glass w-full max-w-lg rounded-xl border border-border/60 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="accent-grad flex size-8 items-center justify-center rounded-lg text-white">
              <Database className="size-4" />
            </span>
            <h3 className="font-medium">Nueva base de datos</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Motor">
              <Select
                value={type}
                onChange={setType}
                options={DATABASE_TYPES.map((d) => ({ value: d.id, label: d.label }))}
              />
            </Field>
            <Field label="Nombre (opcional)">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="mi-db" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Proyecto">
              <Select
                value={projectUuid}
                onChange={setProjectUuid}
                options={projects.map((p) => ({ value: p.uuid, label: p.name }))}
              />
            </Field>
            <Field label="Entorno">
              <Select
                value={envUuid}
                onChange={setEnvUuid}
                options={environments.map((e) => ({ value: e.uuid, label: e.name }))}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Servidor">
              <Select
                value={serverUuid}
                onChange={setServerUuid}
                options={servers.map((s) => ({ value: s.uuid, label: s.name }))}
              />
            </Field>
            <Field label="Imagen (opcional)">
              <Input
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="postgres:16"
                className="font-mono text-xs"
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

          <p className="text-xs text-muted-foreground">
            Las credenciales (usuario/contraseña) las genera Coolify
            automáticamente.
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
              disabled={saving || !projectUuid || !envUuid || !serverUuid}
            >
              {saving ? <Loader2 className="animate-spin" /> : <Database className="size-3.5" />}
              Crear base de datos
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
