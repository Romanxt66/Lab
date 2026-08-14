"use client";

import * as React from "react";
import {
  Loader2,
  Plus,
  RefreshCw,
  Zap,
  Pencil,
  Trash2,
  History,
  Send,
  CalendarPlus,
  Webhook,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import { cn } from "@/lib/utils";
import {
  listRulesAction,
  saveRuleAction,
  deleteRuleAction,
  listRuleRunsAction,
} from "@/modules/automations/actions";
import {
  TRIGGERS,
  TRIGGER_TYPES,
  ACTION_TYPES,
  ACTION_LABELS,
  type ActionConfig,
  type ActionType,
  type AutomationRuleDTO,
  type AutomationRunDTO,
  type TriggerType,
} from "@/modules/automations/domain/automation";

function defaultActionFor(type: ActionType): ActionConfig {
  if (type === "telegram") return { type, config: { message: "" } };
  if (type === "n8n_webhook") return { type, config: { webhookUrl: "" } };
  return { type, config: { title: "", description: "", daysFromNow: 0 } };
}

export function AutomationsTool() {
  const [rules, setRules] = React.useState<AutomationRuleDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<AutomationRuleDTO | null>(null);
  const [history, setHistory] = React.useState<AutomationRuleDTO | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      setRules(await listRulesAction());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void (async () => {
      await refresh();
    })();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Automatizaciones</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            &ldquo;Cuando pase X, haz Y&rdquo; — conecta eventos de otros módulos con
            avisos de Telegram o eventos de calendario.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Actualizar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
          >
            <Plus />
            Nueva regla
          </Button>
        </div>
      </div>

      {creating || editing ? (
        <RuleForm
          rule={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            await refresh();
          }}
        />
      ) : null}

      {loading && rules.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </p>
      ) : rules.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
          <Zap className="mx-auto mb-2 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Sin reglas todavía. Crea la primera automatización.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rules.map((r) => (
            <RuleCard
              key={r.id}
              rule={r}
              onEdit={() => {
                setCreating(false);
                setEditing(r);
              }}
              onHistory={() => setHistory(r)}
              onChanged={refresh}
            />
          ))}
        </div>
      )}

      {history ? (
        <RunHistoryDialog rule={history} onClose={() => setHistory(null)} />
      ) : null}
    </div>
  );
}

function actionSummary(action: ActionConfig): string {
  if (action.type === "telegram") return "Telegram";
  if (action.type === "n8n_webhook") return "n8n";
  return "Evento de calendario";
}

function actionIcon(action: ActionConfig) {
  if (action.type === "telegram") return <Send className="size-3" />;
  if (action.type === "n8n_webhook") return <Webhook className="size-3" />;
  return <CalendarPlus className="size-3" />;
}

function RuleCard({
  rule,
  onEdit,
  onHistory,
  onChanged,
}: {
  rule: AutomationRuleDTO;
  onEdit: () => void;
  onHistory: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);

  async function toggleActive() {
    setBusy(true);
    await saveRuleAction({ ...rule, id: rule.id, active: !rule.active });
    setBusy(false);
    await onChanged();
  }

  return (
    <div className="glass flex flex-col gap-3 rounded-lg border border-border/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{rule.name}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {TRIGGERS[rule.trigger].label}
          </p>
        </div>
        <button
          onClick={toggleActive}
          disabled={busy}
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[0.65rem] font-medium",
            rule.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
          )}
        >
          {rule.active ? "Activa" : "Pausada"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {rule.actions.map((a, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent"
          >
            {actionIcon(a)}
            {actionSummary(a)}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-1 pt-1">
        <Button size="sm" variant="outline" className="flex-1" onClick={onHistory}>
          <History className="size-3.5" />
          Historial
        </Button>
        <button onClick={onEdit} className="rounded p-1.5 text-muted-foreground hover:text-foreground" title="Editar">
          <Pencil className="size-3.5" />
        </button>
        <button
          onClick={async () => {
            if (confirm(`¿Eliminar la regla "${rule.name}"?`)) {
              await deleteRuleAction(rule.id);
              await onChanged();
            }
          }}
          className="rounded p-1.5 text-muted-foreground hover:text-danger"
          title="Eliminar"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function RuleForm({
  rule,
  onClose,
  onSaved,
}: {
  rule: AutomationRuleDTO | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = React.useState(rule?.name ?? "");
  const [trigger, setTrigger] = React.useState<TriggerType>(rule?.trigger ?? TRIGGER_TYPES[0]);
  const [active, setActive] = React.useState(rule?.active ?? true);
  const [actions, setActions] = React.useState<ActionConfig[]>(
    rule?.actions ?? [defaultActionFor("telegram")],
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const meta = TRIGGERS[trigger];

  function updateAction(i: number, next: ActionConfig) {
    setActions((prev) => prev.map((a, idx) => (idx === i ? next : a)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await saveRuleAction({ id: rule?.id, name, trigger, active, actions });
      if (res.ok) await onSaved();
      else setError(res.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass space-y-4 rounded-lg border border-border/60 p-4">
      <h3 className="text-sm font-medium">{rule ? "Editar regla" : "Nueva regla"}</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rule-name">Nombre</Label>
          <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Avisar cuando..." autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rule-trigger">Disparador</Label>
          <select
            id="rule-trigger"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as TriggerType)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {TRIGGER_TYPES.map((t) => (
              <option key={t} value={t}>{TRIGGERS[t].label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-md border border-border/50 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
        {meta.description}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {meta.variables.map((v) => (
            <code key={v} className="rounded bg-foreground/5 px-1 py-0.5 font-mono">
              {"{{" + v + "}}"}
            </code>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Acciones</Label>
        {actions.map((action, i) => (
          <ActionEditor
            key={i}
            action={action}
            onChange={(next) => updateAction(i, next)}
            onRemove={
              actions.length > 1 ? () => setActions((prev) => prev.filter((_, idx) => idx !== i)) : undefined
            }
          />
        ))}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setActions((prev) => [...prev, defaultActionFor("telegram")])}
          >
            <Plus className="size-3.5" />
            Añadir acción
          </Button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Activa
      </label>

      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saving || !name}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          Guardar
        </Button>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>
    </div>
  );
}

function ActionEditor({
  action,
  onChange,
  onRemove,
}: {
  action: ActionConfig;
  onChange: (next: ActionConfig) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <select
          value={action.type}
          onChange={(e) => onChange(defaultActionFor(e.target.value as ActionType))}
          className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs"
        >
          {ACTION_TYPES.map((t) => (
            <option key={t} value={t}>{ACTION_LABELS[t]}</option>
          ))}
        </select>
        {onRemove ? (
          <button onClick={onRemove} className="text-muted-foreground hover:text-danger" title="Quitar acción">
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {action.type === "telegram" ? (
        <Textarea
          value={action.config.message}
          onChange={(e) =>
            onChange({ type: "telegram", config: { message: e.target.value } })
          }
          placeholder="{{monitor}} está caído ({{motivo}})"
          rows={2}
          className="font-mono text-xs"
        />
      ) : action.type === "n8n_webhook" ? (
        <div className="space-y-1.5">
          <Input
            value={action.config.webhookUrl}
            onChange={(e) =>
              onChange({ type: "n8n_webhook", config: { webhookUrl: e.target.value } })
            }
            placeholder="https://n8n.midominio.com/webhook/xxxxx"
            inputMode="url"
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Envía <code className="font-mono">{"{ trigger, ...variables }"}</code> como
            JSON a la URL del nodo Webhook del workflow.
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
          <Input
            value={action.config.title}
            onChange={(e) =>
              onChange({ type: "calendar_event", config: { ...action.config, title: e.target.value } })
            }
            placeholder="Título del evento"
          />
          <Input
            value={action.config.daysFromNow}
            onChange={(e) =>
              onChange({
                type: "calendar_event",
                config: { ...action.config, daysFromNow: Number(e.target.value) || 0 },
              })
            }
            inputMode="numeric"
            placeholder="Días desde hoy"
          />
          <Textarea
            value={action.config.description}
            onChange={(e) =>
              onChange({ type: "calendar_event", config: { ...action.config, description: e.target.value } })
            }
            placeholder="Descripción (opcional)"
            rows={2}
            className="sm:col-span-2 font-mono text-xs"
          />
        </div>
      )}
    </div>
  );
}

function RunHistoryDialog({ rule, onClose }: { rule: AutomationRuleDTO; onClose: () => void }) {
  const [runs, setRuns] = React.useState<AutomationRunDTO[] | null>(null);

  React.useEffect(() => {
    void (async () => {
      setRuns(await listRuleRunsAction(rule.id));
    })();
  }, [rule.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="glass max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl border border-border/60 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-medium">{rule.name}</h2>
            <p className="text-xs text-muted-foreground">Últimas ejecuciones</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        {runs === null ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando…
          </p>
        ) : runs.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">Aún no se ha ejecutado esta regla.</p>
        ) : (
          <ul className="divide-y divide-border/50 text-sm">
            {runs.map((r, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 shrink-0 rounded-full", r.ok ? "bg-success" : "bg-danger")} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.ranAt).toLocaleString()}
                  </span>
                </div>
                {r.error ? (
                  <span className="max-w-[12rem] truncate text-xs text-danger" title={r.error}>
                    {r.error}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  );
}
