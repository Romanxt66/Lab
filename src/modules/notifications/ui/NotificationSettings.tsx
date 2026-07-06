"use client";

import * as React from "react";
import {
  Save,
  Trash2,
  Send,
  Loader2,
  CheckCircle2,
  Search,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import {
  getActiveNotificationConfigAction,
  saveTelegramConfigAction,
  deleteNotificationConfigAction,
  sendNotificationTestAction,
  detectTelegramChatIdsAction,
} from "@/modules/notifications/actions";
import type { NotificationConfigDTO } from "@/modules/notifications/domain/config";

export function NotificationSettings() {
  const [config, setConfig] = React.useState<NotificationConfigDTO | null>(
    null,
  );
  const [botToken, setBotToken] = React.useState("");
  const [chatId, setChatId] = React.useState("");
  const [detected, setDetected] = React.useState<
    Array<{ id: string; title: string }>
  >([]);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [detecting, setDetecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    const c = await getActiveNotificationConfigAction();
    setConfig(c);
    if (c) setChatId(c.recipient);
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save() {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await saveTelegramConfigAction({ botToken, chatId });
      if (res.ok) {
        setSuccess("Configuración guardada.");
        setBotToken("");
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
    await deleteNotificationConfigAction(config.id);
    setConfig(null);
    setBotToken("");
    setChatId("");
  }

  async function test() {
    setError(null);
    setSuccess(null);
    setTesting(true);
    try {
      const res = await sendNotificationTestAction();
      if (res.ok) setSuccess("Mensaje de prueba enviado.");
      else setError(res.error);
    } finally {
      setTesting(false);
    }
  }

  async function detect() {
    setError(null);
    setDetecting(true);
    try {
      const res = await detectTelegramChatIdsAction(botToken);
      if (res.ok) {
        setDetected(res.value);
        if (res.value.length === 0) {
          setError(
            "No detecté chats. Envía primero un mensaje a tu bot desde Telegram y vuelve a intentarlo.",
          );
        }
      } else {
        setError(res.error);
      }
    } finally {
      setDetecting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* Config form */}
      <div className="space-y-5">
        <div className="glass rounded-lg border border-border/60 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="size-5" />
            <h2 className="text-base font-medium">
              Recordatorios por Telegram
            </h2>
          </div>

          {config ? (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              <CheckCircle2 className="size-4" />
              Activo — chat{" "}
              <strong className="font-mono">{config.recipient}</strong>
            </div>
          ) : (
            <div className="mb-4 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
              Sin configuración activa. Rellena los campos para conectar tu bot.
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="botToken">Bot token</Label>
              <Input
                id="botToken"
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder={
                  config?.hasCredential
                    ? "•••••• (deja vacío para no cambiar)"
                    : "123456789:ABCdef..."
                }
                className="font-mono"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Lo obtienes de @BotFather (paso 1 en las instrucciones).
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-end justify-between gap-2">
                <Label htmlFor="chatId">Chat ID</Label>
                <button
                  type="button"
                  onClick={detect}
                  disabled={!botToken || detecting}
                  className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  {detecting ? (
                    <Loader2 className="inline size-3 animate-spin" />
                  ) : (
                    <Search className="inline size-3" />
                  )}{" "}
                  Detectar automáticamente
                </button>
              </div>
              <Input
                id="chatId"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="123456789"
                className="font-mono"
              />

              {detected.length > 0 ? (
                <div className="space-y-1 rounded-md border border-border bg-muted/30 p-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Chats detectados:
                  </p>
                  {detected.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setChatId(c.id)}
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm hover:bg-foreground/[0.05]"
                    >
                      <span className="truncate">{c.title}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {c.id}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Para grupos el chat ID empieza con guion (ej.{" "}
                <code className="font-mono">-100123456789</code>).
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
                disabled={
                  saving ||
                  !chatId ||
                  (!botToken && !config?.hasCredential)
                }
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
                <Button
                  variant="ghost"
                  onClick={remove}
                  aria-label="Eliminar"
                >
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
          <h3 className="mb-3 text-sm font-medium">Cómo configurar Telegram</h3>
          <ol className="space-y-3 text-xs text-muted-foreground">
            <li>
              <span className="mr-1.5 rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                1
              </span>
              Abre Telegram y busca{" "}
              <strong className="text-foreground">@BotFather</strong>. Inicia
              chat y envía{" "}
              <code className="rounded bg-foreground/5 px-1 py-0.5 font-mono">
                /newbot
              </code>
              . Sigue los pasos: nombre y username terminado en{" "}
              <code className="font-mono">bot</code>.
            </li>
            <li>
              <span className="mr-1.5 rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                2
              </span>
              BotFather te dará un{" "}
              <strong className="text-foreground">token</strong> (algo como{" "}
              <code className="font-mono">123456:AA…</code>). Cópialo en el
              campo "Bot token" de arriba.
            </li>
            <li>
              <span className="mr-1.5 rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                3
              </span>
              Busca tu bot en Telegram y envíale cualquier mensaje (p. ej.{" "}
              <code className="font-mono">hola</code>). Es necesario que TÚ
              hables primero para que el bot pueda escribirte.
            </li>
            <li>
              <span className="mr-1.5 rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                4
              </span>
              Pulsa{" "}
              <strong className="text-foreground">
                Detectar automáticamente
              </strong>{" "}
              y elige tu chat de la lista. También puedes pegar el chat ID a
              mano (@userinfobot te lo dice).
            </li>
            <li>
              <span className="mr-1.5 rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                5
              </span>
              <strong className="text-foreground">Guardar</strong> y{" "}
              <strong className="text-foreground">Enviar prueba</strong> —
              deberías recibir la notificación en Telegram.
            </li>
          </ol>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Los recordatorios de eventos del calendario se envían aquí cuando
            llega su momento.
          </p>
        </div>
      </aside>
    </div>
  );
}
