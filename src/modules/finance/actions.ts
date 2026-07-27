"use server";

import { type Result, ok } from "@/shared/kernel/result";
import { getFinanceService } from "@/shared/di/container";
import {
  toAccountDTO,
  type AccountDTO,
  type AccountKind,
} from "@/modules/finance/domain/account";
import {
  toCategoryDTO,
  type CategoryDTO,
  type CategoryKind,
} from "@/modules/finance/domain/category";
import {
  toTransactionDTO,
  type TransactionDTO,
  type TransactionKind,
} from "@/modules/finance/domain/transaction";
import type { MonthlySummary } from "@/modules/finance/domain/balance";
import {
  toBudgetDTO,
  type BudgetDTO,
  type BudgetProgress,
} from "@/modules/finance/domain/budget";
import {
  toRecurringDTO,
  type RecurringPaymentDTO,
  type Frequency,
} from "@/modules/finance/domain/recurring";

// --- Accounts --------------------------------------------------------------

export interface AccountWithBalanceDTO {
  account: AccountDTO;
  balance: number;
}

export async function listAccountsAction(
  includeArchived = false,
): Promise<AccountDTO[]> {
  const rows = await getFinanceService().listAccounts(includeArchived);
  return rows.map(toAccountDTO);
}

export async function listAccountsWithBalancesAction(
  includeArchived = false,
): Promise<AccountWithBalanceDTO[]> {
  const rows = await getFinanceService().listAccountsWithBalances(includeArchived);
  return rows.map((r) => ({ account: toAccountDTO(r.account), balance: r.balance }));
}

export async function saveAccountAction(input: {
  id?: string;
  name: string;
  kind: AccountKind;
  currency: string;
  initialBalance: number;
  archived: boolean;
}): Promise<Result<AccountDTO>> {
  const res = await getFinanceService().saveAccount(input);
  return res.ok ? ok(toAccountDTO(res.value)) : res;
}

export async function deleteAccountAction(id: string): Promise<void> {
  await getFinanceService().removeAccount(id);
}

// --- Categories ------------------------------------------------------------

export async function listCategoriesAction(): Promise<CategoryDTO[]> {
  const rows = await getFinanceService().listCategories();
  return rows.map(toCategoryDTO);
}

export async function saveCategoryAction(input: {
  id?: string;
  name: string;
  kind: CategoryKind;
  color?: string | null;
}): Promise<Result<CategoryDTO>> {
  const res = await getFinanceService().saveCategory(input);
  return res.ok ? ok(toCategoryDTO(res.value)) : res;
}

export async function deleteCategoryAction(id: string): Promise<void> {
  await getFinanceService().removeCategory(id);
}

// --- Transactions ----------------------------------------------------------

export async function listTransactionsAction(filter?: {
  accountId?: string;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<TransactionDTO[]> {
  const rows = await getFinanceService().listTransactions({
    accountId: filter?.accountId,
    from: filter?.from ? new Date(filter.from) : undefined,
    to: filter?.to ? new Date(filter.to) : undefined,
    limit: filter?.limit,
  });
  return rows.map(toTransactionDTO);
}

export async function saveTransactionAction(input: {
  id?: string;
  accountId: string;
  categoryId: string | null;
  kind: TransactionKind;
  amount: number;
  /** ISO string from the client. */
  occurredAt: string;
  notes: string | null;
}): Promise<Result<TransactionDTO>> {
  const res = await getFinanceService().saveTransaction({
    id: input.id,
    accountId: input.accountId,
    categoryId: input.categoryId,
    kind: input.kind,
    amount: input.amount,
    occurredAt: new Date(input.occurredAt),
    notes: input.notes,
  });
  return res.ok ? ok(toTransactionDTO(res.value)) : res;
}

export async function deleteTransactionAction(id: string): Promise<void> {
  await getFinanceService().removeTransaction(id);
}

// --- Summary ---------------------------------------------------------------

export async function monthlySummaryAction(
  year: number,
  month1to12: number,
): Promise<MonthlySummary> {
  return getFinanceService().monthlySummary(year, month1to12);
}

// --- Budgets ---------------------------------------------------------------

export interface BudgetWithProgressDTO {
  budget: BudgetDTO;
  progress: BudgetProgress;
}

export async function listBudgetsAction(): Promise<BudgetDTO[]> {
  const rows = await getFinanceService().listBudgets();
  return rows.map(toBudgetDTO);
}

export async function budgetsWithProgressAction(
  year: number,
  month1to12: number,
): Promise<BudgetWithProgressDTO[]> {
  const rows = await getFinanceService().budgetsWithProgress(year, month1to12);
  return rows.map((r) => ({ budget: toBudgetDTO(r.budget), progress: r.progress }));
}

export async function saveBudgetAction(input: {
  categoryId: string;
  amount: number;
}): Promise<Result<BudgetDTO>> {
  const res = await getFinanceService().saveBudget(input);
  return res.ok ? ok(toBudgetDTO(res.value)) : res;
}

export async function deleteBudgetAction(categoryId: string): Promise<void> {
  await getFinanceService().removeBudget(categoryId);
}

// --- Recurring payments ----------------------------------------------------

export async function listRecurringAction(
  activeOnly = false,
): Promise<RecurringPaymentDTO[]> {
  const rows = await getFinanceService().listRecurring(activeOnly);
  return rows.map(toRecurringDTO);
}

export async function saveRecurringAction(input: {
  id?: string;
  name: string;
  accountId: string;
  categoryId: string | null;
  kind: "income" | "expense";
  amount: number;
  frequency: Frequency;
  /** ISO string from the client. */
  nextRunAt: string;
  remindDaysBefore: number | null;
  active: boolean;
  notes: string | null;
}): Promise<Result<RecurringPaymentDTO>> {
  const res = await getFinanceService().saveRecurring({
    id: input.id,
    name: input.name,
    accountId: input.accountId,
    categoryId: input.categoryId,
    kind: input.kind,
    amount: input.amount,
    frequency: input.frequency,
    nextRunAt: new Date(input.nextRunAt),
    remindDaysBefore: input.remindDaysBefore,
    active: input.active,
    notes: input.notes,
  });
  return res.ok ? ok(toRecurringDTO(res.value)) : res;
}

export async function deleteRecurringAction(id: string): Promise<void> {
  await getFinanceService().removeRecurring(id);
}
