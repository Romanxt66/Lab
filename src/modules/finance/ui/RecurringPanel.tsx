"use client";

import * as React from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Repeat,
  Bell,
  BellOff,
  Pause,
  Play,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import {
  listRecurringAction,
  saveRecurringAction,
  deleteRecurringAction,
  type AccountWithBalanceDTO,
} from "@/modules/finance/actions";
import type { CategoryDTO } from "@/modules/finance/domain/category";
import {
  FREQUENCIES,
  FREQUENCY_LABELS,
  type Frequency,
  type RecurringPaymentDTO,
} from "@/modules/finance/domain/recurring";
import type { TransactionKind } from "@/modules/finance/domain/transaction";
import { formatMoney } from "./format";
import { cn } from "@/lib/utils";

export function RecurringPanel({
  accounts,
  categories,
  onTransactionsChanged,
}: {
  accounts: AccountWithBalanceDTO[];
  categories: CategoryDTO[];
  onTransactionsChanged: () => void | Promise<void>;
}) {
  const [items, setItems] = React.useState<RecurringPaymentDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<RecurringPaymentDTO | null>(null);

  const activeAccounts = React.useMemo(
    () => accounts.filter((a) => !a.account.archived),
    [accounts],
  );

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listRecurringAction(false));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const accountLookup = React.useMemo(() => {
    const map = new Map<string, AccountWithBalanceDTO["account"]>();
    for (const a of accounts) map.set(a.account.id, a.account);
    return map;
  }, [accounts]);
  const categoryLookup = React.useMemo(() => {
    const map = new Map<string, CategoryDTO>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  async function toggleActive(item: RecurringPaymentDTO) {
    await saveRecurringAction({ ...item, active: !item.active });
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Pagos recurrentes</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Alquiler, suscripciones… se registran solos y te avisan por Telegram.
          </p>
        </div>
        <Button
          size="sm"
          disabled={activeAccounts.length === 0}
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
        >
          <Plus />
          Nuevo
        </Button>
      </div>

      {activeAccounts.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          Crea al menos una cuenta activa antes de programar pagos recurrentes.
        </p>
      ) : null}

      {creating || editing ? (
        <RecurringForm
          item={editing}
          accounts={activeAccounts}
          categories={categories}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            await refresh();
            await onTransactionsChanged();
          }}
        />
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          Sin pagos recurrentes todavía.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const account = accountLookup.get(item.accountId);
            const category = item.categoryId
              ? categoryLookup.get(item.categoryId)
              : null;
            const isIncome = item.kind === "income";
            return (
              <li
                key={item.id}
                className={cn(
                  "glass group flex items-center gap-3 rounded-lg border border-border/60 p-4",
                  !item.active && "opacity-60",
                )}
              >
                {isIncome ? (
                  <ArrowUpCircle className="size-5 shrink-0 text-success" />
                ) : (
                  <ArrowDownCircle className="size-5 shrink-0 text-danger" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="tabular-nums text-sm font-semibold">
                      {formatMoney(item.amount, account?.currency ?? "USD")}
                    </p>
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Repeat className="size-3" />
                      {FREQUENCY_LABELS[item.frequency]}
                    </span>
                    <span>· Próximo {formatDate(item.nextRunAt)}</span>
                    {account ? <span>· {account.name}</span> : null}
                    {category ? <span>· {category.name}</span> : null}
                    <span className="inline-flex items-center gap-1">
                      ·
                      {item.remindDaysBefore != null ? (
                        <>
                          <Bell className="size-3" />
                          {item.remindDaysBefore === 0
                            ? "el mismo día"
                            : `${item.remindDaysBefore} día(s) antes`}
                        </>
                      ) : (
                        <>
                          <BellOff className="size-3" />
                          sin aviso
                        </>
                      )}
                    </span>
                  </p>
                </div>
                <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => toggleActive(item)}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                    title={item.active ? "Pausar" : "Reanudar"}
                  >
                    {item.active ? (
                      <Pause className="size-3.5" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setCreating(false);
                      setEditing(item);
                    }}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                    title="Editar"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`¿Eliminar el pago recurrente "${item.name}"?`)) {
                        await deleteRecurringAction(item.id);
                        await refresh();
                      }
                    }}
                    className="rounded p-1 text-muted-foreground hover:text-danger"
                    title="Eliminar"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RecurringForm({
  item,
  accounts,
  categories,
  onClose,
  onSaved,
}: {
  item: RecurringPaymentDTO | null;
  accounts: AccountWithBalanceDTO[];
  categories: CategoryDTO[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = React.useState(item?.name ?? "");
  const [kind, setKind] = React.useState<TransactionKind>(item?.kind ?? "expense");
  const [accountId, setAccountId] = React.useState(
    item?.accountId ?? accounts[0]?.account.id ?? "",
  );
  const [categoryId, setCategoryId] = React.useState<string>(
    item?.categoryId ?? "",
  );
  const [amount, setAmount] = React.useState(item?.amount.toString() ?? "");
  const [frequency, setFrequency] = React.useState<Frequency>(
    item?.frequency ?? "monthly",
  );
  const [nextRunAt, setNextRunAt] = React.useState(
    item ? item.nextRunAt.slice(0, 10) : today(),
  );
  const [remind, setRemind] = React.useState(item?.remindDaysBefore != null);
  const [remindDays, setRemindDays] = React.useState(
    item?.remindDaysBefore?.toString() ?? "1",
  );
  const [notes, setNotes] = React.useState(item?.notes ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const relevantCategories = categories.filter((c) => c.kind === kind);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const parsedAmount = Number((amount || "").replace(",", "."));
      const parsedDays = Number(remindDays);
      const res = await saveRecurringAction({
        id: item?.id,
        name,
        accountId,
        categoryId: categoryId || null,
        kind,
        amount: Number.isFinite(parsedAmount) ? parsedAmount : NaN,
        frequency,
        // Anchor at noon local time so DST/timezone never shifts the day.
        nextRunAt: new Date(`${nextRunAt}T12:00:00`).toISOString(),
        remindDaysBefore: remind
          ? Number.isFinite(parsedDays)
            ? Math.max(0, Math.trunc(parsedDays))
            : 0
          : null,
        active: item?.active ?? true,
        notes: notes || null,
      });
      if (res.ok) await onSaved();
      else setError(res.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass space-y-3 rounded-lg border border-border/60 p-4">
      <h3 className="text-sm font-medium">
        {item ? "Editar pago recurrente" : "Nuevo pago recurrente"}
      </h3>

      <div className="inline-flex rounded-md border border-border p-0.5">
        {(
          [
            { id: "expense", label: "Gasto" },
            { id: "income", label: "Ingreso" },
          ] as const
        ).map((k) => (
          <button
            key={k.id}
            onClick={() => {
              setKind(k.id);
              setCategoryId("");
            }}
            className={cn(
              "rounded px-3 py-1 text-sm transition-colors",
              kind === k.id
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rec-name">Nombre</Label>
          <Input
            id="rec-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alquiler, Netflix…"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rec-amount">Importe</Label>
          <Input
            id="rec-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rec-account">Cuenta</Label>
          <select
            id="rec-account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {accounts.map(({ account }) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rec-category">Categoría</Label>
          <select
            id="rec-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Sin categoría</option>
            {relevantCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rec-frequency">Frecuencia</Label>
          <select
            id="rec-frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rec-next">Próximo cargo</Label>
          <Input
            id="rec-next"
            type="date"
            value={nextRunAt}
            onChange={(e) => setNextRunAt(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={remind}
            onChange={(e) => setRemind(e.target.checked)}
          />
          Avisarme por Telegram
        </label>
        {remind ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Input
              value={remindDays}
              onChange={(e) => setRemindDays(e.target.value)}
              inputMode="numeric"
              className="h-8 w-16 font-mono"
            />
            día(s) antes
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rec-notes">Notas</Label>
        <Textarea
          id="rec-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Comentario opcional"
          className="min-h-16 font-sans"
        />
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saving || !name || !amount || !accountId}>
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

function today(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}
