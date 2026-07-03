"use client";

import * as React from "react";
import {
  Clock,
  Play,
  Trash2,
  Plus,
  Pencil,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import { isValidCron } from "@/modules/scheduler/domain/cron";
import {
  saveJobAction,
  listJobsAction,
  toggleJobAction,
  deleteJobAction,
  runJobNowAction,
  listRunsAction,
  type JobFormInput,
} from "@/modules/scheduler/actions";
import type {
  ScheduledJob,
  JobAction,
  JobRun,
} from "@/modules/scheduler/application/ports";

const CRON_PRESETS: [string, string][] = [
  ["*/5 * * * *", "Cada 5 min"],
  ["0 * * * *", "Cada hora"],
  ["0 9 * * *", "Cada día 9:00"],
  ["0 9 * * 1", "Lunes 9:00"],
];

const emptyForm = {
  id: undefined as string | undefined,
  name: "",
  cron: "*/5 * * * *",
  action: "scrape" as JobAction,
  enabled: true,
  // email params
  recipients: "",
  subject: "",
  body: "",
  // scrape params
  url: "",
  selector: "",
  attribute: "",
};

export function JobScheduler() {
  const [jobs, setJobs] = React.useState<ScheduledJob[]>([]);
  const [runs, setRuns] = React.useState<(JobRun & { jobName: string })[]>([]);
  const [form, setForm] = React.useState(emptyForm);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const [j, r] = await Promise.all([listJobsAction(), listRunsAction(20)]);
    setJobs(j);
    setRuns(r);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const cronOk = isValidCron(form.cron);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const params =
        form.action === "email"
          ? { recipients: form.recipients, subject: form.subject, body: form.body }
          : { url: form.url, selector: form.selector, attribute: form.attribute };
      const input: JobFormInput = {
        id: form.id,
        name: form.name,
        cron: form.cron,
        action: form.action,
        params,
        enabled: form.enabled,
      };
      const res = await saveJobAction(input);
      if (res.ok) {
        setForm(emptyForm);
        await refresh();
      } else {
        setError(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  function edit(job: ScheduledJob) {
    const p = safeParse(job.params);
    setForm({
      ...emptyForm,
      id: job.id,
      name: job.name,
      cron: job.cron,
      action: job.action,
      enabled: job.enabled,
      recipients: (p.recipients as string) ?? "",
      subject: (p.subject as string) ?? "",
      body: (p.body as string) ?? "",
      url: (p.url as string) ?? "",
      selector: (p.selector as string) ?? "",
      attribute: (p.attribute as string) ?? "",
    });
  }

  async function runNow(id: string) {
    await runJobNowAction(id);
    await refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Form */}
      <div className="space-y-5">
        <h2 className="text-sm font-medium text-muted-foreground">
          {form.id ? "Editar job" : "Nuevo job"}
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="job-name">Nombre</Label>
            <Input
              id="job-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Revisar precios"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-action">Acción</Label>
            <select
              id="job-action"
              value={form.action}
              onChange={(e) => set("action", e.target.value as JobAction)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="scrape">Scraping</option>
              <option value="email">Enviar correo</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="job-cron">Cron</Label>
          <Input
            id="job-cron"
            value={form.cron}
            onChange={(e) => set("cron", e.target.value)}
            className={"font-mono " + (cronOk ? "" : "border-danger")}
            placeholder="*/5 * * * *"
          />
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {CRON_PRESETS.map(([expr, label]) => (
              <button
                key={expr}
                onClick={() => set("cron", expr)}
                className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {form.action === "email" ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
            <div className="space-y-1.5">
              <Label>Destinatarios</Label>
              <Input
                value={form.recipients}
                onChange={(e) => set("recipients", e.target.value)}
                placeholder="ana@ejemplo.com, luis@ejemplo.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Asunto</Label>
              <Input
                value={form.subject}
                onChange={(e) => set("subject", e.target.value)}
                placeholder="Recordatorio"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cuerpo</Label>
              <Textarea
                value={form.body}
                onChange={(e) => set("body", e.target.value)}
                className="min-h-24 font-sans"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>URL</Label>
              <Input
                value={form.url}
                onChange={(e) => set("url", e.target.value)}
                placeholder="https://ejemplo.com"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Selector CSS</Label>
              <Input
                value={form.selector}
                onChange={(e) => set("selector", e.target.value)}
                placeholder=".price"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Atributo</Label>
              <Input
                value={form.attribute}
                onChange={(e) => set("attribute", e.target.value)}
                placeholder="href"
                className="font-mono"
              />
            </div>
          </div>
        )}

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={busy || !cronOk}>
            <Plus />
            {form.id ? "Guardar cambios" : "Crear job"}
          </Button>
          {form.id ? (
            <Button variant="ghost" onClick={() => setForm(emptyForm)}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </div>

      {/* Jobs + runs */}
      <aside className="space-y-6">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium">Jobs ({jobs.length})</h3>
            <button
              onClick={refresh}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Refrescar"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>
          {jobs.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              Sin jobs todavía.
            </p>
          ) : (
            <ul className="space-y-2">
              {jobs.map((job) => (
                <li
                  key={job.id}
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{job.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {job.cron} · {job.action}
                      </p>
                    </div>
                    <label className="flex cursor-pointer items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={job.enabled}
                        onChange={(e) =>
                          toggleJobAction(job.id, e.target.checked).then(refresh)
                        }
                      />
                      {job.enabled ? "on" : "off"}
                    </label>
                  </div>
                  <div className="mt-2 flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => runNow(job.id)}>
                      <Play />
                      Ejecutar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => edit(job)}>
                      <Pencil />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteJobAction(job.id).then(refresh)}
                    >
                      <Trash2 className="text-danger" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <Clock className="size-4" />
            Ejecuciones recientes
          </h3>
          {runs.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin ejecuciones aún.</p>
          ) : (
            <ul className="space-y-1.5">
              {runs.map((run) => (
                <li
                  key={run.id}
                  className="flex items-start gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
                >
                  {run.status === "success" ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 size-3.5 shrink-0 text-danger" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{run.jobName}</p>
                    {run.output ? (
                      <p className="truncate text-muted-foreground">{run.output}</p>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(run.startedAt).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

function safeParse(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}
