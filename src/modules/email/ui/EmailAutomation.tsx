"use client";

import * as React from "react";
import { Send, Save, Trash2, Loader2, CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import { extractVariables } from "@/modules/email/domain/template";
import {
  sendEmailAction,
  listTemplatesAction,
  saveTemplateAction,
  deleteTemplateAction,
} from "@/modules/email/actions";
import type { EmailTemplate } from "@/modules/email/application/ports";
import { GoogleAccountsPanel } from "./GoogleAccountsPanel";

export function EmailAutomation() {
  const [templates, setTemplates] = React.useState<EmailTemplate[]>([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [name, setName] = React.useState("");
  const [recipients, setRecipients] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [vars, setVars] = React.useState<Record<string, string>>({});
  const [googleAccountId, setGoogleAccountId] = React.useState("");

  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const variableNames = React.useMemo(
    () => extractVariables(`${subject}\n${body}`),
    [subject, body],
  );

  const refreshTemplates = React.useCallback(async () => {
    setTemplates(await listTemplatesAction());
  }, []);

  React.useEffect(() => {
    refreshTemplates();
  }, [refreshTemplates]);

  function loadTemplate(id: string) {
    setSelectedId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setName(t.name);
      setSubject(t.subject);
      setBody(t.body);
    }
  }

  async function onSave() {
    setError(null);
    const res = await saveTemplateAction({
      id: selectedId || undefined,
      name,
      subject,
      body,
    });
    if (res.ok) {
      await refreshTemplates();
      setSelectedId(res.value.id);
    } else {
      setError(res.error);
    }
  }

  async function onDelete() {
    if (!selectedId) return;
    await deleteTemplateAction(selectedId);
    setSelectedId("");
    setName("");
    await refreshTemplates();
  }

  async function onSend() {
    setError(null);
    setSuccess(null);
    setSending(true);
    try {
      const res = await sendEmailAction({
        recipients,
        subject,
        body,
        variables: vars,
        googleAccountId: googleAccountId || undefined,
      });
      if (res.ok) {
        setSuccess(
          `Enviado a ${res.value.sent} destinatario(s)` +
            (res.value.failed ? `, ${res.value.failed} fallido(s).` : "."),
        );
      } else {
        setError(res.error);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
      {/* Composer */}
      <div className="space-y-5">
        <FromIndicator accountId={googleAccountId} />

        <div className="space-y-1.5">
          <Label htmlFor="recipients">Destinatarios</Label>
          <Textarea
            id="recipients"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            placeholder="ana@ejemplo.com, luis@ejemplo.com"
            className="min-h-16 font-sans"
          />
          <p className="text-xs text-muted-foreground">
            Separa por comas, punto y coma o saltos de línea.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="subject">Asunto</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Hola {{nombre}}"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="body">Cuerpo</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Hola {{nombre}},\n\nEste es un mensaje del Lab."}
            className="min-h-52 font-sans"
          />
        </div>

        {variableNames.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium">
              Variables detectadas
              <span className="ml-1 font-normal text-muted-foreground">
                (se sustituyen al enviar)
              </span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {variableNames.map((v) => (
                <div key={v} className="space-y-1">
                  <Label className="font-mono text-xs">{`{{${v}}}`}</Label>
                  <Input
                    value={vars[v] ?? ""}
                    onChange={(e) =>
                      setVars((prev) => ({ ...prev, [v]: e.target.value }))
                    }
                    placeholder={`valor de ${v}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <ErrorNote>{error}</ErrorNote> : null}
        {success ? (
          <p className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="size-4" />
            {success}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <Button onClick={onSend} disabled={sending}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
            {sending ? "Enviando…" : "Enviar"}
          </Button>
        </div>
      </div>

      {/* Sidebar: Google accounts + templates */}
      <aside className="space-y-4">
        <div className="rounded-lg border border-border p-4">
          <React.Suspense
            fallback={
              <p className="text-xs text-muted-foreground">Cargando cuentas…</p>
            }
          >
            <GoogleAccountsPanel
              selectedId={googleAccountId}
              onSelect={setGoogleAccountId}
            />
          </React.Suspense>
        </div>

        <div className="rounded-lg border border-border p-4">
          <h3 className="mb-3 text-sm font-medium">Plantillas</h3>
          {templates.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aún no tienes plantillas guardadas.
            </p>
          ) : (
            <ul className="mb-3 space-y-1">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => loadTemplate(t.id)}
                    className={
                      "w-full truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors " +
                      (selectedId === t.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/60")
                    }
                  >
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2 border-t border-border pt-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la plantilla"
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onSave} className="flex-1">
                <Save />
                Guardar
              </Button>
              {selectedId ? (
                <Button size="sm" variant="ghost" onClick={onDelete} aria-label="Eliminar">
                  <Trash2 className="text-danger" />
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Si seleccionas una cuenta de Google, el envío se hará desde esa cuenta
          por Gmail. Sin cuenta seleccionada, se usa el SMTP configurado en{" "}
          <code className="font-mono">.env.local</code>.
        </p>
      </aside>
    </div>
  );
}

/** Small badge showing which identity will be used for the send. */
function FromIndicator({ accountId }: { accountId: string }) {
  const [label, setLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    if (!accountId) {
      setLabel(null);
      return;
    }
    import("@/modules/email/actions").then(async (m) => {
      const list = await m.listGoogleAccountsAction();
      if (!live) return;
      const found = list.find((a) => a.id === accountId);
      setLabel(found?.email ?? null);
    });
    return () => {
      live = false;
    };
  }, [accountId]);

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <Mail className="size-3.5" />
      <span>Enviando desde:</span>
      <span className="font-medium text-foreground">
        {label ?? "SMTP (.env.local)"}
      </span>
    </div>
  );
}
