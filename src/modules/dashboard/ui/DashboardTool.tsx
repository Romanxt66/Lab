"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  Pencil,
  LayoutDashboard,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import { cn } from "@/lib/utils";
import {
  listDashboardsAction,
  createDashboardAction,
  renameDashboardAction,
  deleteDashboardAction,
  addWidgetAction,
  deleteWidgetAction,
} from "@/modules/dashboard/actions";
import type {
  DashboardDTO,
  WidgetDTO,
} from "@/modules/dashboard/domain/dashboard";
import {
  LAB_WIDGET_TYPES,
  WIDGET_LABELS,
  type WidgetType,
} from "@/modules/dashboard/domain/widget-types";
import {
  UpcomingEventsWidget,
  RecentJobsWidget,
  GoogleAccountsWidget,
  RecentEmailsWidget,
} from "./widgets/LabWidgets";

export function DashboardTool() {
  const [dashboards, setDashboards] = React.useState<DashboardDTO[]>([]);
  const [activeId, setActiveId] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [showPicker, setShowPicker] = React.useState(false);

  const refresh = React.useCallback(async (preserveActive = true) => {
    const list = await listDashboardsAction();
    setDashboards(list);
    setLoading(false);
    if (!preserveActive || !list.some((d) => d.id === activeId)) {
      setActiveId(list[0]?.id ?? "");
    }
  }, [activeId]);

  React.useEffect(() => {
    void refresh(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = dashboards.find((d) => d.id === activeId) ?? null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando dashboards…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardTabs
        dashboards={dashboards}
        activeId={activeId}
        onSelect={setActiveId}
        onChanged={() => refresh(true)}
      />

      {active === null ? (
        <EmptyState onCreated={(id) => setActiveId(id)} refresh={refresh} />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">{active.name}</h2>
            <Button size="sm" onClick={() => setShowPicker(true)}>
              <Plus />
              Añadir widget
            </Button>
          </div>

          {showPicker ? (
            <WidgetPicker
              dashboardId={active.id}
              onClose={() => setShowPicker(false)}
              onAdded={async () => {
                setShowPicker(false);
                await refresh(true);
              }}
            />
          ) : null}

          {active.widgets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-16 text-center text-sm text-muted-foreground">
              Dashboard vacío. Añade tu primer widget.
            </div>
          ) : (
            <WidgetGrid
              widgets={active.widgets}
              onDeleted={() => refresh(true)}
            />
          )}
        </>
      )}
    </div>
  );
}

// ---- Tabs (list, create, rename, delete) ----------------------------------

function DashboardTabs({
  dashboards,
  activeId,
  onSelect,
  onChanged,
}: {
  dashboards: DashboardDTO[];
  activeId: string;
  onSelect: (id: string) => void;
  onChanged: () => void | Promise<void>;
}) {
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  async function create() {
    const res = await createDashboardAction(newName);
    if (res.ok) {
      setNewName("");
      setCreating(false);
      setError(null);
      onSelect(res.value.id);
      await onChanged();
    } else {
      setError(res.error);
    }
  }

  async function rename(id: string) {
    const res = await renameDashboardAction(id, renameValue);
    if (res.ok) {
      setRenamingId(null);
      await onChanged();
    } else {
      setError(res.error);
    }
  }

  async function remove(id: string) {
    await deleteDashboardAction(id);
    await onChanged();
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {dashboards.map((d) =>
        renamingId === d.id ? (
          <div key={d.id} className="flex items-center gap-1">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && rename(d.id)}
              className="h-8 w-32 text-sm"
              autoFocus
            />
            <button
              onClick={() => rename(d.id)}
              className="text-success"
              aria-label="Confirmar"
            >
              <Check className="size-3.5" />
            </button>
            <button
              onClick={() => setRenamingId(null)}
              className="text-muted-foreground"
              aria-label="Cancelar"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <div
            key={d.id}
            className={cn(
              "group flex items-center gap-1 rounded-md border px-2.5 py-1 text-sm transition-colors",
              d.id === activeId
                ? "border-foreground/40 bg-foreground/[0.06] font-medium"
                : "border-border hover:bg-foreground/[0.03]",
            )}
          >
            <button
              onClick={() => onSelect(d.id)}
              className="truncate max-w-[180px]"
            >
              {d.name}
            </button>
            {d.id === activeId ? (
              <>
                <button
                  onClick={() => {
                    setRenamingId(d.id);
                    setRenameValue(d.name);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Renombrar"
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  onClick={() => remove(d.id)}
                  className="text-muted-foreground hover:text-danger"
                  aria-label="Eliminar"
                >
                  <Trash2 className="size-3" />
                </button>
              </>
            ) : null}
          </div>
        ),
      )}

      {creating ? (
        <div className="flex items-center gap-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Nombre"
            className="h-8 w-32 text-sm"
            autoFocus
          />
          <button
            onClick={create}
            className="text-success"
            aria-label="Confirmar"
          >
            <Check className="size-3.5" />
          </button>
          <button
            onClick={() => {
              setCreating(false);
              setError(null);
            }}
            className="text-muted-foreground"
            aria-label="Cancelar"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setCreating(true);
            setNewName("");
          }}
        >
          <Plus />
          Nuevo dashboard
        </Button>
      )}

      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : null}
    </div>
  );
}

function EmptyState({
  onCreated,
  refresh,
}: {
  onCreated: (id: string) => void;
  refresh: (preserveActive?: boolean) => Promise<void>;
}) {
  const [name, setName] = React.useState("Personal");
  const [error, setError] = React.useState<string | null>(null);

  async function create() {
    const res = await createDashboardAction(name);
    if (res.ok) {
      onCreated(res.value.id);
      await refresh(false);
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-border p-12 text-center">
      <LayoutDashboard className="mx-auto mb-3 size-8 text-muted-foreground" />
      <h2 className="mb-2 text-base font-medium">
        Aún no tienes dashboards
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Crea el primero para empezar a añadir widgets.
      </p>
      <div className="mx-auto flex max-w-sm items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre"
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <Button onClick={create}>
          <Plus />
          Crear
        </Button>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </div>
  );
}

// ---- Widget picker --------------------------------------------------------

function WidgetPicker({
  dashboardId,
  onClose,
  onAdded,
}: {
  dashboardId: string;
  onClose: () => void;
  onAdded: () => void | Promise<void>;
}) {
  const [type, setType] = React.useState<WidgetType>("lab-upcoming-events");
  const [title, setTitle] = React.useState(WIDGET_LABELS["lab-upcoming-events"]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTitle(WIDGET_LABELS[type]);
  }, [type]);

  async function add() {
    setError(null);
    setSaving(true);
    try {
      const res = await addWidgetAction({
        dashboardId,
        type,
        title,
      });
      if (res.ok) await onAdded();
      else setError(res.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass rounded-lg border border-border/60 p-4">
      <h3 className="mb-3 text-sm font-medium">Añadir widget</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {LAB_WIDGET_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-md border p-3 text-left text-sm transition-colors",
              type === t
                ? "border-foreground/40 bg-foreground/[0.06]"
                : "border-border hover:bg-foreground/[0.03]",
            )}
          >
            <span className="font-medium">{WIDGET_LABELS[t]}</span>
            <span className="text-[11px] text-muted-foreground">
              Datos del Lab
            </span>
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título del widget"
        />
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <div className="flex gap-2">
          <Button onClick={add} disabled={saving || !title}>
            {saving ? <Loader2 className="animate-spin" /> : <Plus />}
            Añadir
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- Widget grid (no drag & drop yet — Commit C adds it) ----------------

function WidgetGrid({
  widgets,
  onDeleted,
}: {
  widgets: WidgetDTO[];
  onDeleted: () => void | Promise<void>;
}) {
  return (
    <div className="grid grid-cols-12 gap-3 auto-rows-[minmax(80px,auto)]">
      {widgets.map((w) => (
        <div
          key={w.id}
          className="min-h-[220px]"
          style={{
            gridColumn: `span ${clampSpan(w.layout.w)} / span ${clampSpan(w.layout.w)}`,
            gridRow: `span ${Math.max(1, w.layout.h)} / span ${Math.max(1, w.layout.h)}`,
          }}
        >
          <WidgetRenderer widget={w} onDeleted={onDeleted} />
        </div>
      ))}
    </div>
  );
}

function clampSpan(w: number): number {
  return Math.min(12, Math.max(3, w));
}

function WidgetRenderer({
  widget,
  onDeleted,
}: {
  widget: WidgetDTO;
  onDeleted: () => void | Promise<void>;
}) {
  const onDelete = async () => {
    await deleteWidgetAction(widget.id);
    await onDeleted();
  };
  switch (widget.type) {
    case "lab-upcoming-events":
      return (
        <UpcomingEventsWidget
          widgetId={widget.id}
          title={widget.title}
          onDelete={onDelete}
        />
      );
    case "lab-recent-jobs":
      return (
        <RecentJobsWidget
          widgetId={widget.id}
          title={widget.title}
          onDelete={onDelete}
        />
      );
    case "lab-google-accounts":
      return (
        <GoogleAccountsWidget
          widgetId={widget.id}
          title={widget.title}
          onDelete={onDelete}
        />
      );
    case "lab-recent-emails":
      return (
        <RecentEmailsWidget
          widgetId={widget.id}
          title={widget.title}
          onDelete={onDelete}
        />
      );
    // sql widgets will be added in Commit B
    default:
      return (
        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
          Tipo de widget no soportado en este build.
        </div>
      );
  }
}
