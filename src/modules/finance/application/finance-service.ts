import { type Result, ok } from "@/shared/kernel/result";
import {
  validateAccountInput,
  type AccountInput,
  type FinancialAccount,
} from "@/modules/finance/domain/account";
import {
  validateCategoryInput,
  type CategoryInput,
  type TransactionCategory,
} from "@/modules/finance/domain/category";
import {
  validateTransactionInput,
  type TransactionInput,
  type FinancialTransaction,
} from "@/modules/finance/domain/transaction";
import {
  accountBalance,
  monthlySummary,
  type MonthlySummary,
} from "@/modules/finance/domain/balance";
import type {
  AccountRepoPort,
  CategoryRepoPort,
  TransactionRepoPort,
} from "./ports";

export interface AccountWithBalance {
  account: FinancialAccount;
  balance: number;
}

/**
 * Orchestrates the finance domain over three repos. All write operations run
 * validation first and never touch the DB when input is invalid.
 */
export class FinanceService {
  constructor(
    private readonly accounts: AccountRepoPort,
    private readonly categories: CategoryRepoPort,
    private readonly transactions: TransactionRepoPort,
  ) {}

  // -- Accounts -----------------------------------------------------------

  listAccounts(includeArchived = false): Promise<FinancialAccount[]> {
    return this.accounts.list(includeArchived);
  }

  async saveAccount(
    input: AccountInput & { id?: string },
  ): Promise<Result<FinancialAccount>> {
    const valid = validateAccountInput(input);
    if (!valid.ok) return valid;
    return ok(
      input.id
        ? await this.accounts.update(input.id, valid.value)
        : await this.accounts.create(valid.value),
    );
  }

  async removeAccount(id: string): Promise<void> {
    await this.accounts.remove(id);
  }

  /** Accounts + their current balance (initial + all transactions). */
  async listAccountsWithBalances(
    includeArchived = false,
  ): Promise<AccountWithBalance[]> {
    const accounts = await this.accounts.list(includeArchived);
    const rows: AccountWithBalance[] = [];
    for (const account of accounts) {
      const tx = await this.transactions.list({ accountId: account.id });
      rows.push({ account, balance: accountBalance(account, tx) });
    }
    return rows;
  }

  // -- Categories ---------------------------------------------------------

  listCategories(): Promise<TransactionCategory[]> {
    return this.categories.list();
  }

  async saveCategory(
    input: CategoryInput & { id?: string },
  ): Promise<Result<TransactionCategory>> {
    const valid = validateCategoryInput(input);
    if (!valid.ok) return valid;
    return ok(
      input.id
        ? await this.categories.update(input.id, valid.value)
        : await this.categories.create(valid.value),
    );
  }

  async removeCategory(id: string): Promise<void> {
    await this.categories.remove(id);
  }

  // -- Transactions -------------------------------------------------------

  listTransactions(filter?: {
    accountId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<FinancialTransaction[]> {
    return this.transactions.list(filter);
  }

  async saveTransaction(
    input: TransactionInput & { id?: string },
  ): Promise<Result<FinancialTransaction>> {
    const valid = validateTransactionInput(input);
    if (!valid.ok) return valid;
    return ok(
      input.id
        ? await this.transactions.update(input.id, valid.value)
        : await this.transactions.create(valid.value),
    );
  }

  async removeTransaction(id: string): Promise<void> {
    await this.transactions.remove(id);
  }

  // -- Summary ------------------------------------------------------------

  /** Aggregate income / expense / by-category for a given month. */
  async monthlySummary(year: number, month1to12: number): Promise<MonthlySummary> {
    const from = new Date(year, month1to12 - 1, 1);
    const to = new Date(year, month1to12, 1);
    const tx = await this.transactions.list({ from, to });
    return monthlySummary(tx);
  }
}
