"use client";

import * as React from "react";
import { Calendar, Briefcase, User, Mail, CheckCircle2, XCircle } from "lucide-react";
import { WidgetShell, useWidgetData, WidgetBody } from "./WidgetShell";
import type {
  UpcomingEventDTO,
  RecentJobDTO,
  GoogleAccountLite,
  RecentEmailDTO,
} from "@/modules/dashboard/application/lab-providers";

// ---- Upcoming events ------------------------------------------------------

export function UpcomingEventsWidget({
  widgetId,
  title,
  onDelete,
}: {
  widgetId: string;
  title: string;
  onDelete?: () => void | Promise<void>;
}) {
  const state = useWidgetData<UpcomingEventDTO[]>(widgetId);
  return (
    <WidgetShell widgetId={widgetId} title={title} onDelete={onDelete}>
      <WidgetBody state={state} emptyMessage="Sin eventos próximos.">
        {(events) => (
          <ul className="space-y-1.5">
            {events.map((e) => (
              <li key={e.id} className="flex items-start gap-2">
                <Calendar className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{e.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDateTime(e.start, e.allDay)}
                    {e.location ? ` · ${e.location}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </WidgetBody>
    </WidgetShell>
  );
}

// ---- Recent jobs ----------------------------------------------------------

export function RecentJobsWidget({
  widgetId,
  title,
  onDelete,
}: {
  widgetId: string;
  title: string;
  onDelete?: () => void | Promise<void>;
}) {
  const state = useWidgetData<RecentJobDTO[]>(widgetId);
  return (
    <WidgetShell widgetId={widgetId} title={title} onDelete={onDelete}>
      <WidgetBody state={state} emptyMessage="Sin ejecuciones aún.">
        {(jobs) => (
          <ul className="space-y-1.5">
            {jobs.map((j) => (
              <li key={j.id} className="flex items-start gap-2">
                {j.status === "success" ? (
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                ) : (
                  <XCircle className="mt-0.5 size-3.5 shrink-0 text-danger" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{j.jobName}</p>
                  {j.output ? (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {j.output}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    {formatRelative(j.startedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </WidgetBody>
    </WidgetShell>
  );
}

// ---- Google accounts ------------------------------------------------------

export function GoogleAccountsWidget({
  widgetId,
  title,
  onDelete,
}: {
  widgetId: string;
  title: string;
  onDelete?: () => void | Promise<void>;
}) {
  const state = useWidgetData<GoogleAccountLite[]>(widgetId);
  return (
    <WidgetShell widgetId={widgetId} title={title} onDelete={onDelete}>
      <WidgetBody state={state} emptyMessage="Sin cuentas conectadas.">
        {(accounts) => (
          <ul className="space-y-1.5">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                {a.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.picture}
                    alt=""
                    className="size-6 shrink-0 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground/10">
                    <User className="size-3" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {a.name ? (
                    <p className="truncate text-xs font-medium">{a.name}</p>
                  ) : null}
                  <p className="truncate text-[11px] text-muted-foreground">
                    {a.email}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </WidgetBody>
    </WidgetShell>
  );
}

// ---- Recent emails --------------------------------------------------------

export function RecentEmailsWidget({
  widgetId,
  title,
  onDelete,
}: {
  widgetId: string;
  title: string;
  onDelete?: () => void | Promise<void>;
}) {
  const state = useWidgetData<RecentEmailDTO[]>(widgetId);
  return (
    <WidgetShell widgetId={widgetId} title={title} onDelete={onDelete}>
      <WidgetBody state={state} emptyMessage="Sin correos enviados aún.">
        {(emails) => (
          <ul className="space-y-1.5">
            {emails.map((e) => (
              <li key={e.id} className="flex items-start gap-2">
                {e.status === "sent" ? (
                  <Mail className="mt-0.5 size-3.5 shrink-0 text-success" />
                ) : (
                  <Mail className="mt-0.5 size-3.5 shrink-0 text-danger" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{e.subject}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    a {e.to}
                    {e.error ? ` · ${e.error}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatRelative(e.sentAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </WidgetBody>
    </WidgetShell>
  );
}

// ---- Helpers --------------------------------------------------------------

function formatDateTime(iso: string, allDay: boolean): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (allDay) return day;
  const time = d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days}d`;
  return d.toLocaleDateString();
}

// re-export the Briefcase icon so callers can preview it when picking widget types.
export { Briefcase };
