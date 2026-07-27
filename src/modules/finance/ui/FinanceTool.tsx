"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccountsPanel } from "./AccountsPanel";
import { TransactionsPanel } from "./TransactionsPanel";
import { BudgetsPanel } from "./BudgetsPanel";
import { RecurringPanel } from "./RecurringPanel";
import { SummaryPanel } from "./SummaryPanel";
import {
  listAccountsWithBalancesAction,
  listCategoriesAction,
  type AccountWithBalanceDTO,
} from "@/modules/finance/actions";
import type { CategoryDTO } from "@/modules/finance/domain/category";

type Tab =
  | "accounts"
  | "transactions"
  | "budgets"
  | "recurring"
  | "summary";

/**
 * Root of the finance tool. Owns the shared caches (accounts + categories)
 * because they're needed by more than one panel; individual panels manage
 * their own transaction lists.
 */
export function FinanceTool() {
  const [tab, setTab] = React.useState<Tab>("accounts");
  const [accounts, setAccounts] = React.useState<AccountWithBalanceDTO[]>([]);
  const [categories, setCategories] = React.useState<CategoryDTO[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refreshAccounts = React.useCallback(async () => {
    setAccounts(await listAccountsWithBalancesAction(true));
  }, []);

  const refreshCategories = React.useCallback(async () => {
    setCategories(await listCategoriesAction());
  }, []);

  React.useEffect(() => {
    void Promise.all([refreshAccounts(), refreshCategories()]).finally(() =>
      setLoading(false),
    );
  }, [refreshAccounts, refreshCategories]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-md border border-border p-0.5">
        {(
          [
            { id: "accounts", label: "Cuentas" },
            { id: "transactions", label: "Movimientos" },
            { id: "budgets", label: "Presupuestos" },
            { id: "recurring", label: "Recurrentes" },
            { id: "summary", label: "Resumen" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded px-3 py-1 text-sm transition-colors",
              tab === t.id
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "accounts" ? (
        <AccountsPanel
          accounts={accounts}
          onChanged={async () => {
            await refreshAccounts();
          }}
        />
      ) : null}

      {tab === "transactions" ? (
        <TransactionsPanel
          accounts={accounts}
          categories={categories}
          onCategoriesChanged={refreshCategories}
          onTransactionsChanged={refreshAccounts}
        />
      ) : null}

      {tab === "budgets" ? (
        <BudgetsPanel accounts={accounts} categories={categories} />
      ) : null}

      {tab === "recurring" ? (
        <RecurringPanel
          accounts={accounts}
          categories={categories}
          onTransactionsChanged={refreshAccounts}
        />
      ) : null}

      {tab === "summary" ? (
        <SummaryPanel
          accounts={accounts}
          categories={categories}
        />
      ) : null}
    </div>
  );
}
