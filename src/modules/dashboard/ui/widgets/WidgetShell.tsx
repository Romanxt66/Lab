"use client";

import * as React from "react";
import { Trash2, MoreVertical, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { loadWidgetDataAction } from "@/modules/dashboard/actions";

/** Chrome for every widget: title, delete button, loading + error states. */
export function WidgetShell({
  widgetId,
  title,
  onDelete,
  children,
  className,
}: {
  widgetId: string;
  title: string;
  onDelete?: () => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass flex h-full flex-col rounded-lg border border-border/60",
        className,
      )}
    >
      <header className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h4 className="truncate text-sm font-medium">{title}</h4>
        {onDelete ? (
          <button
            onClick={onDelete}
            className="text-muted-foreground hover:text-danger"
            aria-label="Eliminar widget"
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </header>
      <div className="flex-1 overflow-auto p-3 text-sm">{children}</div>
    </div>
  );
}

/**
 * Reusable data-loading hook for every widget. Calls the server action, keeps
 * loading/error state, and re-fetches when `deps` change.
 */
export function useWidgetData<T>(widgetId: string): {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    void loadWidgetDataAction(widgetId).then((r) => {
      if (!live) return;
      if (r.ok) setData(r.value as T);
      else setError(r.error);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [widgetId, tick]);

  return {
    data,
    loading,
    error,
    refresh: () => setTick((t) => t + 1),
  };
}

/** Common "loading / error / empty" wrapper the widgets can reuse. */
export function WidgetBody<T>({
  state,
  emptyMessage,
  children,
}: {
  state: { data: T | null; loading: boolean; error: string | null };
  emptyMessage: string;
  children: (data: T) => React.ReactNode;
}) {
  if (state.loading && !state.data) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Cargando…
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="flex items-start gap-1.5 text-xs text-danger">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
        <span>{state.error}</span>
      </div>
    );
  }
  const data = state.data;
  if (data === null || (Array.isArray(data) && data.length === 0)) {
    return (
      <p className="text-xs text-muted-foreground">{emptyMessage}</p>
    );
  }
  return <>{children(data)}</>;
}

// Not used from every file; keep to preserve the import surface if we add
// menus later.
export const _widgetMoreIcon = MoreVertical;
export const _widgetActionButton = Button;
