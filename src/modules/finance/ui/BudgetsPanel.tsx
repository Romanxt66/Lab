"use client";

import * as React from "react";
import { Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import {
  budgetsWithProgressAction,
  saveBudgetAction,
  deleteBudgetAction,
  type BudgetWithProgressDTO,
  type AccountWithBalanceDTO,
} from "@/modules/finance/actions";
import type { CategoryDTO } from "@/modules/finance/domain/category";
import type { BudgetStatus } from "@/modules/finance/domain/budget";
import { formatMoney } from "./format";
import { cn } from "@/lib/utils";

const STATUS_TEXT: Record<BudgetStatus, string> = {
  ok: "text-muted-foreground",
  warning: "text-[oklch(0.7_0.14_75)]",
  over: "text-danger",
};
const STATUS_BAR: Record<BudgetStatus, string> = {
  ok: "bg-foreground/60",
  warning: "bg-[oklch(0.7_0.14_75)]",
  over: "bg-danger",
};

export function BudgetsPanel({
  accounts,
  categories,
}: {
  accounts: AccountWithBalanceDTO[];
  categories: CategoryDTO[];
}) {
  const currency = accounts[0]?.account.currency ?? "USD";
  const [rows, setRows] = React.useState<BudgetWithProgressDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [adding, setAdding] = React.useState(false);

  // Budgets track this month's spend. Compute month client-side (hydration).
  const [ym, setYm] = React.useState<{ y: number; m: number } | null>(null);
  React.useEffect(() => {
    const now = new Date();
    setYm({ y: now.getFullYear(), m: now.getMonth() + 1 });
  }, []);

  const refresh = React.useCallback(async () => {
    if (!ym) return;
    setLoading(true);
    try {
      setRows(await budgetsWithProgressAction(ym.y, ym.m));
    } finally {
      setLoading(false);
    }
  }, [ym]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const expenseCategories = React.useMemo(
    () => categories.filter((c) => c.kind === "expense"),
    [categories],
  );
  const categoryLookup = React.useMemo(() => {
    const map = new Map<string, CategoryDTO>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const budgetedIds = new Set(rows.map((r) => r.budget.categoryId));
  const availableCategories = expenseCategories.filter(
    (c) => !budgetedIds.has(c.id),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Presupuestos</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Límite mensual de gasto por categoría, con alerta al acercarte.
          </p>
        </div>
        <Button
          size="sm"
          disabled={availableCategories.length === 0}
          onClick={() => setAdding(true)}
        >
          <Plus />
          Nuevo
        </Button>
      </div>

      {expenseCategories.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          Crea categorías de gasto (al registrar movimientos) para asignarles un
          presupuesto.
        </p>
      ) : null}

      {adding ? (
        <BudgetForm
          categories={availableCategories}
          currency={currency}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await refresh();
          }}
        />
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          Sin presupuestos todavía.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map(({ budget, progress }) => {
            const cat = categoryLookup.get(budget.categoryId);
            const pct = Math.min(100, Math.round(progress.ratio * 100));
            return (
              <div
                key={budget.id}
                className="glass group rounded-lg border border-border/60 p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-1.5 font-medium">
                    {progress.status === "over" ? (
                      <AlertTriangle className="size-4 text-danger" />
                    ) : null}
                    {cat?.name ?? "Categoría"}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums text-sm">
                      <span className={STATUS_TEXT[progress.status]}>
                        {formatMoney(progress.spent, currency)}
                      </span>
                      <span className="text-muted-foreground">
                        {" / "}
                        {formatMoney(progress.limit, currency)}
                      </span>
                    </span>
                    <button
                      onClick={async () => {
                        if (confirm(`¿Eliminar el presupuesto de "${cat?.name}"?`)) {
                          await deleteBudgetAction(budget.categoryId);
                          await refresh();
                        }
                      }}
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                      title="Eliminar"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/10">
                    <div
                      className={cn("h-full transition-all", STATUS_BAR[progress.status])}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      "w-10 text-right text-xs tabular-nums",
                      STATUS_TEXT[progress.status],
                    )}
                  >
                    {pct}%
                  </span>
                </div>
                {progress.status !== "over" ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Te quedan {formatMoney(progress.remaining, currency)}.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-danger">
                    Te has pasado por{" "}
                    {formatMoney(Math.abs(progress.remaining), currency)}.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BudgetForm({
  categories,
  currency,
  onClose,
  onSaved,
}: {
  categories: CategoryDTO[];
  currency: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [categoryId, setCategoryId] = React.useState(categories[0]?.id ?? "");
  const [amount, setAmount] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const parsed = Number((amount || "").replace(",", "."));
      const res = await saveBudgetAction({
        categoryId,
        amount: Number.isFinite(parsed) ? parsed : NaN,
      });
      if (res.ok) await onSaved();
      else setError(res.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass space-y-3 rounded-lg border border-border/60 p-4">
      <h3 className="text-sm font-medium">Nuevo presupuesto</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bud-category">Categoría</Label>
          <select
            id="bud-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bud-amount">Límite mensual ({currency})</Label>
          <Input
            id="bud-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
            className="font-mono"
            autoFocus
          />
        </div>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saving || !amount || !categoryId}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          Guardar
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
