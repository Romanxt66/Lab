import type {
  AccountInput,
  FinancialAccount,
} from "@/modules/finance/domain/account";
import type {
  CategoryInput,
  TransactionCategory,
} from "@/modules/finance/domain/category";
import type {
  FinancialTransaction,
  TransactionInput,
} from "@/modules/finance/domain/transaction";
import type { Budget, BudgetInput } from "@/modules/finance/domain/budget";
import type {
  RecurringPayment,
  RecurringPaymentInput,
} from "@/modules/finance/domain/recurring";

export interface AccountRepoPort {
  list(includeArchived?: boolean): Promise<FinancialAccount[]>;
  get(id: string): Promise<FinancialAccount | null>;
  create(input: AccountInput): Promise<FinancialAccount>;
  update(id: string, input: AccountInput): Promise<FinancialAccount>;
  remove(id: string): Promise<void>;
}

export interface CategoryRepoPort {
  list(): Promise<TransactionCategory[]>;
  get(id: string): Promise<TransactionCategory | null>;
  create(input: CategoryInput): Promise<TransactionCategory>;
  update(id: string, input: CategoryInput): Promise<TransactionCategory>;
  remove(id: string): Promise<void>;
}

export interface TransactionRepoPort {
  list(filter?: {
    accountId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<FinancialTransaction[]>;
  get(id: string): Promise<FinancialTransaction | null>;
  create(input: TransactionInput): Promise<FinancialTransaction>;
  update(id: string, input: TransactionInput): Promise<FinancialTransaction>;
  remove(id: string): Promise<void>;
}

export interface BudgetRepoPort {
  list(): Promise<Budget[]>;
  /** Upsert by categoryId (one budget per category). */
  upsert(input: BudgetInput): Promise<Budget>;
  remove(categoryId: string): Promise<void>;
}

export interface RecurringRepoPort {
  list(activeOnly?: boolean): Promise<RecurringPayment[]>;
  get(id: string): Promise<RecurringPayment | null>;
  create(input: RecurringPaymentInput): Promise<RecurringPayment>;
  update(id: string, input: RecurringPaymentInput): Promise<RecurringPayment>;
  remove(id: string): Promise<void>;
  /** Advance a payment's schedule after processing due occurrences. */
  markProcessed(id: string, newNextRunAt: Date): Promise<void>;
  /** Record that the reminder for the current nextRunAt has been sent. */
  markReminded(id: string, at: Date): Promise<void>;
}
