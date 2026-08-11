"use client";

import * as React from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { monitorDetailAction, type MonitorDetailDTO } from "@/modules/uptime/actions";
import { STATUS_LABELS, type MonitorDTO, type MonitorStatus } from "@/modules/uptime/domain/monitor";

const STATUS_TEXT: Record<MonitorStatus, string> = {
  up: "text-success",
  down: "text-danger",
  unknown: "text-muted-foreground",
};

export function MonitorDetailDialog({
  monitor,
  onClose,
}: {
  monitor: MonitorDTO;
  onClose: () => void;
}) {
  const [detail, setDetail] = React.useState<MonitorDetailDTO | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        setDetail(await monitorDetailAction(monitor.id));
      } finally {
        setLoading(false);
      }
    })();
  }, [monitor.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="glass max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border/60 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-medium">{monitor.name}</h2>
            <p className="truncate text-xs text-muted-foreground">{monitor.url}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando historial…
          </p>
        ) : !detail ? (
          <p className="py-8 text-sm text-muted-foreground">No se encontró el monitor.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat
                label="Estado"
                value={STATUS_LABELS[detail.monitor.lastStatus]}
                className={STATUS_TEXT[detail.monitor.lastStatus]}
              />
              <Stat label="Uptime 24 h" value={`${detail.uptime24h}%`} />
              <Stat
                label="Respuesta"
                value={detail.monitor.lastResponseMs != null ? `${detail.monitor.lastResponseMs} ms` : "—"}
              />
            </div>

            {detail.monitor.lastError ? (
              <p className="rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">
                {detail.monitor.lastError}
              </p>
            ) : null}

            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Últimas comprobaciones
              </h3>
              {detail.checks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay comprobaciones.</p>
              ) : (
                <>
                  <div className="mb-3 flex gap-0.5">
                    {[...detail.checks].reverse().map((c, i) => (
                      <span
                        key={i}
                        title={`${c.ok ? "OK" : "Fallo"} · ${new Date(c.checkedAt).toLocaleString()}`}
                        className={cn(
                          "h-6 flex-1 rounded-sm",
                          c.ok ? "bg-success/70" : "bg-danger/70",
                        )}
                      />
                    ))}
                  </div>
                  <ul className="divide-y divide-border/50 text-sm">
                    {detail.checks.map((c, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 py-1.5">
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-2 rounded-full",
                              c.ok ? "bg-success" : "bg-danger",
                            )}
                          />
                          <span className="text-xs text-muted-foreground">
                            {new Date(c.checkedAt).toLocaleString()}
                          </span>
                        </span>
                        <span className="flex items-center gap-3 text-xs">
                          {c.statusCode != null ? (
                            <span className="font-mono text-muted-foreground">{c.statusCode}</span>
                          ) : null}
                          {c.responseMs != null ? <span>{c.responseMs} ms</span> : null}
                          {c.error ? (
                            <span className="max-w-[10rem] truncate text-danger" title={c.error}>
                              {c.error}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
      <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-sm font-medium", className)}>{value}</p>
    </div>
  );
}
