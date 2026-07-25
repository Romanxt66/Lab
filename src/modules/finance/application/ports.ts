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
