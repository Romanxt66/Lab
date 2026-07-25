import type { FinancialAccount } from "./account";
import type { FinancialTransaction } from "./transaction";

/**
 * Pure balance math. All amounts are treated as `number` (JS floats), which
 * gives ~15 significant digits — plenty for a personal finance ledger where
 * amounts are stored as 2-decimal numerics in the DB.
 */

/** Sum of a set of transactions: income adds, expense subtracts. */
export function netMovements(transactions: FinancialTransaction[]): number {
  let n = 0;
  for (const t of transactions) {
    n += t.kind === "income" ? t.amount : -t.amount;
  }
  return round2(n);
}

/** Current balance = initial + sum of movements. */
export function accountBalance(
  account: FinancialAccount,
  transactions: FinancialTransaction[],
): number {
  return round2(account.initialBalance + netMovements(transactions));
}

export interface CategoryBreakdownRow {
  categoryId: string | null;
  amount: number;
}

/** Grouped totals by category (unassigned rows land under `null`). */
export function groupByCategory(
  transactions: FinancialTransaction[],
): CategoryBreakdownRow[] {
  const map = new Map<string | null, number>();
  for (const t of transactions) {
    const signed = t.kind === "income" ? t.amount : -t.amount;
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + signed);
  }
  return [...map.entries()].map(([categoryId, amount]) => ({
    categoryId,
    amount: round2(amount),
  }));
}

export interface MonthlySummary {
  income: number;
  expense: number;
  net: number;
  byCategory: CategoryBreakdownRow[];
}

/** Aggregate metrics for the given transactions (typically a month's range). */
export function monthlySummary(
  transactions: FinancialTransaction[],
): MonthlySummary {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.kind === "income") income += t.amount;
    else expense += t.amount;
  }
  income = round2(income);
  expense = round2(expense);
  return {
    income,
    expense,
    net: round2(income - expense),
    byCategory: groupByCategory(transactions),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
