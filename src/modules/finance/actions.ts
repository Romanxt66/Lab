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
