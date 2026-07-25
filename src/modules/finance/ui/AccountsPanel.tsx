"use client";

import * as React from "react";
import {
  Plus,
  Wallet,
  Landmark,
  CreditCard,
  PiggyBank,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  ArchiveRestore,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import {
  saveAccountAction,
  deleteAccountAction,
  type AccountWithBalanceDTO,
} from "@/modules/finance/actions";
import {
  ACCOUNT_KINDS,
  ACCOUNT_KIND_LABELS,
  type AccountKind,
  type AccountDTO,
} from "@/modules/finance/domain/account";
import { formatMoney } from "./format";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<AccountKind, React.ComponentType<{ className?: string }>> = {
  cash: Wallet,
  bank: Landmark,
  card: CreditCard,
  savings: PiggyBank,
  other: MoreHorizontal,
};

export function AccountsPanel({
  accounts,
  onChanged,
}: {
  accounts: AccountWithBalanceDTO[];
  onChanged: () => void | Promise<void>;
}) {
  const [editing, setEditing] = React.useState<AccountDTO | null>(null);
  const [creating, setCreating] = React.useState(false);

  const totalByCurrency = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const { account, balance } of accounts) {
      if (account.archived) continue;
      map.set(account.currency, (map.get(account.currency) ?? 0) + balance);
    }
    return [...map.entries()];
  }, [accounts]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium">Cuentas</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Efectivo, bancos, tarjetas… tu red financiera.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus />
          Nueva
        </Button>
      </div>

      {/* Totals */}
      {totalByCurrency.length > 0 ? (
        <div className="glass flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-border/60 p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Saldo total
          </span>
          {totalByCurrency.map(([currency, total]) => (
            <span
              key={currency}
              className="text-2xl font-semibold tabular-nums"
            >
              {formatMoney(total, currency)}
            </span>
          ))}
        </div>
      ) : null}

      {creating || editing ? (
        <AccountForm
          account={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            await onChanged();
          }}
        />
      ) : null}

      {/* Grid of accounts */}
      {accounts.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          Aún no tienes cuentas. Crea la primera para empezar.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map(({ account, balance }) => {
            const Icon = KIND_ICON[account.kind];
            return (
              <div
                key={account.id}
                className={cn(
                  "glass group flex flex-col gap-3 rounded-lg border border-border/60 p-4",
                  account.archived && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between">
                  <span className="flex size-10 items-center justify-center rounded-md border border-border/60 bg-foreground/5">
                    <Icon className="size-[18px]" />
                  </span>
                  <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => setEditing(account)}
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                      title="Editar"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        if (
                          confirm(
                            `¿Eliminar la cuenta "${account.name}" y todos sus movimientos?`,
                          )
                        ) {
                          await deleteAccountAction(account.id);
                          await onChanged();
                        }
                      }}
                      className="rounded p-1 text-muted-foreground hover:text-danger"
                      title="Eliminar"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">{account.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ACCOUNT_KIND_LABELS[account.kind]}
                    {account.archived ? " · archivada" : ""}
                  </p>
                </div>
                <p
                  className={cn(
                    "text-xl font-semibold tabular-nums",
                    balance < 0 && "text-danger",
                  )}
                >
                  {formatMoney(balance, account.currency)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AccountForm({
  account,
  onClose,
  onSaved,
}: {
  account: AccountDTO | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = React.useState(account?.name ?? "");
  const [kind, setKind] = React.useState<AccountKind>(account?.kind ?? "cash");
  const [currency, setCurrency] = React.useState(account?.currency ?? "USD");
  const [initialBalance, setInitialBalance] = React.useState(
    account?.initialBalance.toString() ?? "0",
  );
  const [archived, setArchived] = React.useState(account?.archived ?? false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const parsed = Number(initialBalance.replace(",", "."));
      const res = await saveAccountAction({
        id: account?.id,
        name,
        kind,
        currency,
        initialBalance: Number.isFinite(parsed) ? parsed : 0,
        archived,
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
        {account ? "Editar cuenta" : "Nueva cuenta"}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="acc-name">Nombre</Label>
          <Input
            id="acc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cuenta corriente"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acc-kind">Tipo</Label>
          <select
            id="acc-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as AccountKind)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {ACCOUNT_KINDS.map((k) => (
              <option key={k} value={k}>
                {ACCOUNT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acc-currency">Moneda</Label>
          <Input
            id="acc-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            placeholder="USD"
            className="font-mono uppercase"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="acc-initial">Saldo inicial</Label>
          <Input
            id="acc-initial"
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
            className="font-mono"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={archived}
          onChange={(e) => setArchived(e.target.checked)}
        />
        {archived ? (
          <span className="flex items-center gap-1">
            <Archive className="size-3.5" /> Archivada
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <ArchiveRestore className="size-3.5" /> Activa
          </span>
        )}
      </label>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saving || !name}>
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
