"use client";

import * as React from "react";
import { Loader2, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { coolifyLogsAction, coolifyEnvsAction } from "@/modules/coolify/actions";
import type { CoolifyApp, CoolifyEnv } from "@/modules/coolify/domain/resource";

type Tab = "logs" | "envs";

/** Modal with an app's recent logs and environment variables (read-only). */
export function AppDetailDialog({
  app,
  onClose,
}: {
  app: CoolifyApp;
  onClose: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>("logs");
  const [logs, setLogs] = React.useState<string>("");
  const [envs, setEnvs] = React.useState<CoolifyEnv[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reveal, setReveal] = React.useState<Set<string>>(new Set());

  const load = React.useCallback(
    async (which: Tab) => {
      setLoading(true);
      setError(null);
      try {
        if (which === "logs") {
          const res = await coolifyLogsAction(app.uuid, 300);
          if (res.ok) setLogs(res.value || "(sin logs)");
          else setError(res.error);
        } else {
          const res = await coolifyEnvsAction(app.uuid);
          if (res.ok) setEnvs(res.value);
          else setError(res.error);
        }
      } finally {
        setLoading(false);
      }
    },
    [app.uuid],
  );

  React.useEffect(() => {
    void (async () => {
      await load(tab);
    })();
  }, [load, tab]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border/60 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="min-w-0">
            <h3 className="truncate font-medium">{app.name}</h3>
            {app.fqdn ? (
              <a
                href={app.fqdn}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-xs text-muted-foreground hover:text-foreground"
              >
                {app.fqdn}
              </a>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border p-0.5">
            {(
              [
                { id: "logs", label: "Logs" },
                { id: "envs", label: "Variables" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded px-3 py-1 text-sm transition-colors",
                  tab === t.id
                    ? "accent-soft font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => load(tab)}
            disabled={loading}
            className="ml-auto"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Recargar
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {error ? (
            <p className="rounded-md bg-danger/10 p-3 text-sm text-danger">
              {error}
            </p>
          ) : loading ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando…
            </p>
          ) : tab === "logs" ? (
            <pre className="whitespace-pre-wrap break-words rounded-md bg-foreground/5 p-3 font-mono text-xs leading-relaxed">
              {logs}
            </pre>
          ) : envs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin variables de entorno.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 rounded-md border border-border/60">
              {envs.map((e) => {
                const shown = reveal.has(e.uuid);
                return (
                  <li
                    key={e.uuid}
                    className="flex items-center gap-3 px-3 py-2 text-sm"
                  >
                    <span className="font-mono font-medium">{e.key}</span>
                    <button
                      onClick={() =>
                        setReveal((prev) => {
                          const next = new Set(prev);
                          if (next.has(e.uuid)) next.delete(e.uuid);
                          else next.add(e.uuid);
                          return next;
                        })
                      }
                      className="ml-auto max-w-[55%] truncate rounded bg-foreground/5 px-2 py-0.5 text-left font-mono text-xs text-muted-foreground hover:text-foreground"
                      title={shown ? "Ocultar" : "Mostrar"}
                    >
                      {shown ? e.value || "(vacío)" : "••••••••"}
                    </button>
                    {e.isBuildTime ? (
                      <span className="rounded-full bg-foreground/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        build
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Las variables son de solo lectura desde aquí; edítalas en Coolify.
        </p>
      </div>
    </div>
  );
}
