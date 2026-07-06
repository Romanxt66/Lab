"use client";

import * as React from "react";
import { Save, Trash2, Send, Loader2, CheckCircle2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import {
  getActiveWhatsAppConfigAction,
  saveWhatsAppConfigAction,
  deleteWhatsAppConfigAction,
  sendWhatsAppTestAction,
} from "@/modules/whatsapp/actions";
import type { WhatsAppConfigDTO } from "@/modules/whatsapp/domain/config";

export function WhatsAppSettings() {
  const [config, setConfig] = React.useState<WhatsAppConfigDTO | null>(null);
  const [phone, setPhone] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    const c = await getActiveWhatsAppConfigAction();
    setConfig(c);
    if (c) setPhone(c.phone);
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save() {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await saveWhatsAppConfigAction({ phone, apiKey });
      if (res.ok) {
        setSuccess("Configuración guardada.");
        setApiKey("");
        await refresh();
      } else {
        setError(res.error);
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!config) return;
    await deleteWhatsAppConfigAction(config.id);
    setConfig(null);
    setPhone("");
    setApiKey("");
  }

  async function test() {
    setError(null);
    setSuccess(null);
    setTesting(true);
    try {
      const res = await sendWhatsAppTestAction();
      if (res.ok) setSuccess("Mensaje de prueba enviado a WhatsApp.");
      else setError(res.error);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      {/* Config form */}
      <div className="space-y-5">
        <div className="glass rounded-lg border border-border/60 p-5">
          <div className="mb-4 flex items-center gap-2">
            <MessageCircle className="size-5 text-success" />
            <h2 className="text-base font-medium">Configuración de WhatsApp</h2>
          </div>

          {config ? (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              <CheckCircle2 className="size-4" />
              Activo para el número <strong className="font-mono">+{config.phone}</strong>
            </div>
          ) : (
            <div className="mb-4 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
              Sin configuración activa. Rellena los campos para conectar.
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Número (formato internacional)</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+57 300 123 4567"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Con código de país. Se ignoran espacios, guiones y el signo +.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apiKey">API key de CallMeBot</Label>
              <Input
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config?.hasApiKey ? "•••••• (deja vacío para no cambiar)" : "1234567"}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Se guarda cifrada en la base de datos y nunca se muestra tras
                guardarla.
              </p>
            </div>

            {error ? <ErrorNote>{error}</ErrorNote> : null}
            {success ? (
              <p className="flex items-center gap-1.5 text-sm text-success">
                <CheckCircle2 className="size-4" />
                {success}
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              <Button
                onClick={save}
                disabled={saving || !phone || (!apiKey && !config?.hasApiKey)}
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                Guardar
              </Button>
              <Button
                variant="outline"
                onClick={test}
                disabled={testing || !config}
              >
                {testing ? <Loader2 className="animate-spin" /> : <Send />}
                Enviar prueba
              </Button>
              {config ? (
                <Button variant="ghost" onClick={remove} aria-label="Eliminar">
                  <Trash2 className="text-danger" />
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <aside className="space-y-4">
        <div className="glass rounded-lg border border-border/60 p-4">
          <h3 className="mb-3 text-sm font-medium">Cómo obtener tu API key</h3>
          <ol className="space-y-2 text-xs text-muted-foreground">
            <li>
              <span className="mr-1.5 rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                1
              </span>
              Añade este contacto a tu WhatsApp:{" "}
              <strong className="text-foreground">+34 611 01 16 37</strong>
            </li>
            <li>
              <span className="mr-1.5 rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                2
              </span>
              Envíale este mensaje exacto:
              <br />
              <code className="mt-1 inline-block rounded bg-foreground/5 px-1.5 py-0.5 font-mono text-foreground">
                I allow callmebot to send me messages
              </code>
            </li>
            <li>
              <span className="mr-1.5 rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                3
              </span>
              El bot responderá con tu API key (varios dígitos). Pégala arriba y
              guarda.
            </li>
            <li>
              <span className="mr-1.5 rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                4
              </span>
              Pulsa <strong className="text-foreground">Enviar prueba</strong>{" "}
              para verificar que llega.
            </li>
          </ol>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Los eventos del calendario con recordatorio configurado se envían
            automáticamente a este número cuando llega el momento.
          </p>
        </div>
      </aside>
    </div>
  );
}
