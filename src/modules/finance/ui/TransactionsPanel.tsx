"use client";

import * as React from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import {
  saveTransactionAction,
  deleteTransactionAction,
  listTransactionsAction,
  saveCategoryAction,
} from "@/modules/finance/actions";
import type { AccountWithBalanceDTO } from "@/modules/finance/actions";
import type {
  TransactionDTO,
  TransactionKind,
} from "@/modules/finance/domain/transaction";
import type { CategoryDTO } from "@/modules/finance/domain/category";
import { formatMoney } from "./format";
import { cn } from "@/lib/utils";

export function TransactionsPanel({
  accounts,
  categories,
  onCategoriesChanged,
  onTransactionsChanged,
}: {
  accounts: AccountWithBalanceDTO[];
  categories: CategoryDTO[];
  onCategoriesChanged: () => void | Promise<void>;
  onTransactionsChanged: () => void | Promise<void>;
}) {
  const [transactions, setTransactions] = React.useState<TransactionDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<TransactionDTO | null>(null);
  const [filterAccount, setFilterAccount] = React.useState<string>("");
  const [filterKind, setFilterKind] = React.useState<"all" | TransactionKind>(
    "all",
  );

  const activeAccounts = React.useMemo(
    () => accounts.filter((a) => !a.account.archived),
    [accounts],
  );

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await listTransactionsAction({
        accountId: filterAccount || undefined,
        limit: 200,
      });
      const filtered =
        filterKind === "all"
          ? list
          : list.filter((t) => t.kind === filterKind);
      setTransactions(filtered);
    } finally {
      setLoading(false);
    }
  }, [filterAccount, filterKind]);

  React.useEffect(() => {
    void (async () => {
      await refresh();
    })();
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Movimientos</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Ingresos y gastos por cuenta.
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
          Crea al menos una cuenta activa antes de registrar movimientos.
        </p>
      ) : null}

      {/* Filters */}
      <div className="glass flex flex-wrap items-center gap-3 rounded-lg border border-border/60 p-3">
        <Filter className="size-3.5 text-muted-foreground" />
        <select
          value={filterAccount}
          onChange={(e) => setFilterAccount(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          <option value="">Todas las cuentas</option>
          {accounts.map(({ account }) => (
            <option key={account.id} value={account.id}>
              {account.name}
              {account.archived ? " (archivada)" : ""}
            </option>
          ))}
        </select>
        <div className="inline-flex rounded-md border border-border p-0.5">
          {(
            [
              { id: "all", label: "Todos" },
              { id: "income", label: "Ingresos" },
              { id: "expense", label: "Gastos" },
            ] as const
          ).map((k) => (
            <button
              key={k.id}
              onClick={() => setFilterKind(k.id)}
              className={cn(
                "rounded px-2.5 py-0.5 text-xs transition-colors",
                filterKind === k.id
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {creating || editing ? (
        <TransactionForm
          transaction={editing}
          accounts={activeAccounts}
          categories={categories}
          onCategoryCreated={onCategoriesChanged}
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
          Cargando movimientos…
        </p>
      ) : transactions.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          Sin movimientos con estos filtros.
        </p>
      ) : (
        <ul className="glass divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
          {transactions.map((t) => {
            const account = accountLookup.get(t.accountId);
            const category = t.categoryId ? categoryLookup.get(t.categoryId) : null;
            const isIncome = t.kind === "income";
            return (
              <li
                key={t.id}
                className="group flex items-center gap-3 px-4 py-3 hover:bg-foreground/[0.03]"
              >
                {isIncome ? (
                  <ArrowUpCircle className="size-5 shrink-0 text-success" />
                ) : (
                  <ArrowDownCircle className="size-5 shrink-0 text-danger" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium">
                      {category?.name ?? (isIncome ? "Ingreso" : "Gasto")}
                    </p>
                    <p
                      className={cn(
                        "tabular-nums text-sm font-semibold",
                        isIncome ? "text-success" : "text-foreground",
                      )}
                    >
                      {isIncome ? "+" : "−"}
                      {formatMoney(t.amount, account?.currency ?? "USD").replace(
                        /^[+-]/,
                        "",
                      )}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {account?.name ?? "—"} · {formatDate(t.occurredAt)}
                    {t.notes ? ` · ${t.notes}` : ""}
                  </p>
                </div>
                <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => {
                      setCreating(false);
                      setEditing(t);
                    }}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                    title="Editar"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm("¿Eliminar este movimiento?")) {
                        await deleteTransactionAction(t.id);
                        await refresh();
                        await onTransactionsChanged();
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

function TransactionForm({
  transaction,
  accounts,
  categories,
  onCategoryCreated,
  onClose,
  onSaved,
}: {
  transaction: TransactionDTO | null;
  accounts: AccountWithBalanceDTO[];
  categories: CategoryDTO[];
  onCategoryCreated: () => void | Promise<void>;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [kind, setKind] = React.useState<TransactionKind>(
    transaction?.kind ?? "expense",
  );
  const [accountId, setAccountId] = React.useState(
    transaction?.accountId ?? accounts[0]?.account.id ?? "",
  );
  const [amount, setAmount] = React.useState(
    transaction?.amount.toString() ?? "",
  );
  const [categoryId, setCategoryId] = React.useState<string>(
    transaction?.categoryId ?? "",
  );
  const [occurredAt, setOccurredAt] = React.useState(
    transaction ? transaction.occurredAt.slice(0, 10) : today(),
  );
  const [notes, setNotes] = React.useState(transaction?.notes ?? "");
  const [showNewCategory, setShowNewCategory] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const relevantCategories = categories.filter((c) => c.kind === kind);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const parsed = Number((amount || "").replace(",", "."));
      const res = await saveTransactionAction({
        id: transaction?.id,
        accountId,
        categoryId: categoryId || null,
        kind,
        amount: Number.isFinite(parsed) ? parsed : NaN,
        occurredAt: new Date(occurredAt).toISOString(),
        notes: notes || null,
      });
      if (res.ok) await onSaved();
      else setError(res.error);
    } finally {
      setSaving(false);
    }
  }

  async function createCategory() {
    if (!newCategoryName.trim()) return;
    const res = await saveCategoryAction({
      name: newCategoryName,
      kind,
    });
    if (res.ok) {
      await onCategoryCreated();
      setCategoryId(res.value.id);
      setNewCategoryName("");
      setShowNewCategory(false);
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="glass space-y-3 rounded-lg border border-border/60 p-4">
      <h3 className="text-sm font-medium">
        {transaction ? "Editar movimiento" : "Nuevo movimiento"}
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
          <Label htmlFor="tx-account">Cuenta</Label>
          <select
            id="tx-account"
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
          <Label htmlFor="tx-amount">Importe</Label>
          <Input
            id="tx-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tx-date">Fecha</Label>
          <Input
            id="tx-date"
            type="date"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="tx-category">Categoría</Label>
            <button
              type="button"
              onClick={() => setShowNewCategory((v) => !v)}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              {showNewCategory ? "Cancelar" : "+ Nueva"}
            </button>
          </div>
          {showNewCategory ? (
            <div className="flex gap-1">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={kind === "income" ? "Salario, freelance…" : "Comida, alquiler…"}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void createCategory();
                  }
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={createCategory}
                disabled={!newCategoryName.trim()}
              >
                <Plus />
              </Button>
            </div>
          ) : (
            <select
              id="tx-category"
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
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tx-notes">Notas</Label>
        <Textarea
          id="tx-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Comentario opcional"
          className="min-h-16 font-sans"
        />
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saving || !amount || !accountId}>
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
