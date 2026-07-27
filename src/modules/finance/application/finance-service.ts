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
  groupByCategory,
  type MonthlySummary,
} from "@/modules/finance/domain/balance";
import {
  validateBudgetInput,
  budgetProgress,
  type Budget,
  type BudgetInput,
  type BudgetProgress,
} from "@/modules/finance/domain/budget";
import {
  validateRecurringInput,
  type RecurringPayment,
  type RecurringPaymentInput,
} from "@/modules/finance/domain/recurring";
import type {
  AccountRepoPort,
  CategoryRepoPort,
  TransactionRepoPort,
  BudgetRepoPort,
  RecurringRepoPort,
} from "./ports";

export interface AccountWithBalance {
  account: FinancialAccount;
  balance: number;
}

/**
 * Orchestrates the finance domain over three repos. All write operations run
 * validation first and never touch the DB when input is invalid.
 */
export interface BudgetWithProgress {
  budget: Budget;
  progress: BudgetProgress;
}

export class FinanceService {
  constructor(
    private readonly accounts: AccountRepoPort,
    private readonly categories: CategoryRepoPort,
    private readonly transactions: TransactionRepoPort,
    private readonly budgets: BudgetRepoPort,
    private readonly recurring: RecurringRepoPort,
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

  // -- Budgets ------------------------------------------------------------

  listBudgets(): Promise<Budget[]> {
    return this.budgets.list();
  }

  async saveBudget(input: BudgetInput): Promise<Result<Budget>> {
    const valid = validateBudgetInput(input);
    if (!valid.ok) return valid;
    return ok(await this.budgets.upsert(valid.value));
  }

  async removeBudget(categoryId: string): Promise<void> {
    await this.budgets.remove(categoryId);
  }

  /**
   * Budgets paired with this month's spend for each category. `spent` is the
   * absolute value of expense movements for the category in the given month.
   */
  async budgetsWithProgress(
    year: number,
    month1to12: number,
  ): Promise<BudgetWithProgress[]> {
    const [budgets, tx] = await Promise.all([
      this.budgets.list(),
      this.transactions.list({
        from: new Date(year, month1to12 - 1, 1),
        to: new Date(year, month1to12, 1),
      }),
    ]);
    const byCategory = new Map<string, number>();
    for (const row of groupByCategory(tx)) {
      if (row.categoryId) byCategory.set(row.categoryId, row.amount);
    }
    return budgets.map((budget) => {
      // groupByCategory returns signed amounts; expenses are negative.
      const signed = byCategory.get(budget.categoryId) ?? 0;
      const spent = signed < 0 ? -signed : 0;
      return {
        budget,
        progress: budgetProgress(budget.categoryId, budget.amount, spent),
      };
    });
  }

  // -- Recurring payments -------------------------------------------------

  listRecurring(activeOnly = false): Promise<RecurringPayment[]> {
    return this.recurring.list(activeOnly);
  }

  async saveRecurring(
    input: RecurringPaymentInput & { id?: string },
  ): Promise<Result<RecurringPayment>> {
    const valid = validateRecurringInput(input);
    if (!valid.ok) return valid;
    return ok(
      input.id
        ? await this.recurring.update(input.id, valid.value)
        : await this.recurring.create(valid.value),
    );
  }

  async removeRecurring(id: string): Promise<void> {
    await this.recurring.remove(id);
  }
}
