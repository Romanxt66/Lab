import { describe, it, expect } from "vitest";
import {
  validateAccountInput,
  type AccountInput,
} from "./domain/account";
import { validateCategoryInput } from "./domain/category";
import {
  validateTransactionInput,
  type TransactionInput,
} from "./domain/transaction";
import {
  accountBalance,
  groupByCategory,
  monthlySummary,
  netMovements,
} from "./domain/balance";
import type { FinancialAccount } from "./domain/account";
import type { FinancialTransaction } from "./domain/transaction";

// ---- Domain validation ---------------------------------------------------

describe("validateAccountInput", () => {
  const base: AccountInput = {
    name: "Cuenta",
    kind: "bank",
    currency: "usd",
    initialBalance: 0,
    archived: false,
  };
  it("uppercases and trims the currency", () => {
    const r = validateAccountInput({ ...base, currency: "  eur  " });
    expect(r.ok && r.value.currency).toBe("EUR");
  });
  it("rejects empty name", () => {
    expect(validateAccountInput({ ...base, name: "   " }).ok).toBe(false);
  });
  it("rejects NaN initial balance", () => {
    expect(
      validateAccountInput({ ...base, initialBalance: Number.NaN }).ok,
    ).toBe(false);
  });
});

describe("validateCategoryInput", () => {
  it("accepts valid input", () => {
    const r = validateCategoryInput({ name: "Comida", kind: "expense" });
    expect(r.ok && r.value.name).toBe("Comida");
  });
  it("rejects invalid kind", () => {
    expect(
      // @ts-expect-error deliberately bad
      validateCategoryInput({ name: "x", kind: "other" }).ok,
    ).toBe(false);
  });
});

describe("validateTransactionInput", () => {
  const base: TransactionInput = {
    accountId: "a1",
    categoryId: null,
    kind: "expense",
    amount: 12.34,
    occurredAt: new Date("2026-01-15T10:00:00"),
    notes: null,
  };
  it("rejects amount <= 0", () => {
    expect(validateTransactionInput({ ...base, amount: 0 }).ok).toBe(false);
    expect(validateTransactionInput({ ...base, amount: -5 }).ok).toBe(false);
  });
  it("rejects when no account is chosen", () => {
    expect(validateTransactionInput({ ...base, accountId: "" }).ok).toBe(false);
  });
  it("rounds the amount to two decimals", () => {
    const r = validateTransactionInput({ ...base, amount: 1.239 });
    expect(r.ok && r.value.amount).toBe(1.24);
  });
});

// ---- Balance math --------------------------------------------------------

function tx(
  over: Partial<FinancialTransaction> = {},
): FinancialTransaction {
  return {
    id: over.id ?? "t",
    accountId: over.accountId ?? "a1",
    categoryId: over.categoryId ?? null,
    kind: over.kind ?? "expense",
    amount: over.amount ?? 10,
    occurredAt: over.occurredAt ?? new Date(),
    notes: over.notes ?? null,
    createdAt: over.createdAt ?? new Date(),
  };
}

const account: FinancialAccount = {
  id: "a1",
  name: "Test",
  kind: "cash",
  currency: "USD",
  initialBalance: 100,
  archived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("netMovements", () => {
  it("adds income and subtracts expense", () => {
    expect(
      netMovements([
        tx({ kind: "income", amount: 50 }),
        tx({ kind: "expense", amount: 20 }),
        tx({ kind: "expense", amount: 5.5 }),
      ]),
    ).toBe(24.5);
  });
  it("returns 0 for empty input", () => {
    expect(netMovements([])).toBe(0);
  });
});

describe("accountBalance", () => {
  it("adds movements to the initial balance", () => {
    expect(
      accountBalance(account, [
        tx({ kind: "income", amount: 200 }),
        tx({ kind: "expense", amount: 50 }),
      ]),
    ).toBe(250);
  });
});

describe("groupByCategory", () => {
  it("groups signed amounts under each category id", () => {
    const rows = groupByCategory([
      tx({ categoryId: "c1", kind: "expense", amount: 10 }),
      tx({ categoryId: "c1", kind: "expense", amount: 5 }),
      tx({ categoryId: "c2", kind: "income", amount: 30 }),
      tx({ categoryId: null, kind: "expense", amount: 3 }),
    ]);
    const byId = Object.fromEntries(
      rows.map((r) => [r.categoryId ?? "none", r.amount]),
    );
    expect(byId["c1"]).toBe(-15);
    expect(byId["c2"]).toBe(30);
    expect(byId["none"]).toBe(-3);
  });
});

describe("monthlySummary", () => {
  it("splits income/expense/net", () => {
    const s = monthlySummary([
      tx({ kind: "income", amount: 500 }),
      tx({ kind: "expense", amount: 120 }),
      tx({ kind: "expense", amount: 30 }),
    ]);
    expect(s.income).toBe(500);
    expect(s.expense).toBe(150);
    expect(s.net).toBe(350);
  });
});
