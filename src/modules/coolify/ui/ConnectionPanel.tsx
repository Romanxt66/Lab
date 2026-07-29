"use client";

import * as React from "react";
import { Loader2, Plug, Unplug, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import {
  connectCoolifyAction,
  disconnectCoolifyAction,
} from "@/modules/coolify/actions";
import type { CoolifyConfigDTO } from "@/modules/coolify/domain/config";

export function ConnectionPanel({
  config,
  onChanged,
}: {
  config: CoolifyConfigDTO | null;
  onChanged: () => void | Promise<void>;
}) {
  const [baseUrl, setBaseUrl] = React.useState(config?.baseUrl ?? "");
  const [token, setToken] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function connect() {
    setSaving(true);
    setError(null);
    try {
      const res = await connectCoolifyAction({ baseUrl, token });
      if (res.ok) {
        setToken("");
        await onChanged();
      } else {
        setError(res.error);
      }
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!confirm("¿Desconectar Coolify? Se borrará la URL y el token guardados."))
      return;
    setSaving(true);
    try {
      await disconnectCoolifyAction();
      setToken("");
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass mx-auto max-w-lg rounded-xl border border-border/60 p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="accent-grad flex size-10 items-center justify-center rounded-lg text-white">
          <Plug className="size-5" />
        </span>
        <div>
          <h2 className="font-medium">Conecta tu Coolify</h2>
          <p className="text-sm text-muted-foreground">
            {config
              ? "Conectado. Actualiza el token o desconecta."
              : "URL de tu instancia + un API token."}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="cf-url">URL de Coolify</Label>
          <Input
            id="cf-url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://coolify.midominio.com"
            inputMode="url"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-token">
            API token {config ? "(deja vacío para conservar el actual)" : ""}
          </Label>
          <Input
            id="cf-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="67|xxxxxxxx…"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            En Coolify: <strong>Security → API Tokens</strong>. Necesita permiso
            de lectura y despliegue.
          </p>
        </div>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <div className="flex items-center gap-2">
          <Button onClick={connect} disabled={saving || !baseUrl || (!config && !token)}>
            {saving ? <Loader2 className="animate-spin" /> : <Plug />}
            {config ? "Guardar" : "Conectar"}
          </Button>
          {config ? (
            <>
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
                Abrir Coolify <ExternalLink className="size-3" />
              </a>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
