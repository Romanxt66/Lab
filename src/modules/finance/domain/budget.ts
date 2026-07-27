import { type Result, ok, err } from "@/shared/kernel/result";

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetInput {
  categoryId: string;
  amount: number;
}

export interface BudgetDTO {
  id: string;
  categoryId: string;
  amount: number;
}

export function toBudgetDTO(b: Budget): BudgetDTO {
  return { id: b.id, categoryId: b.categoryId, amount: b.amount };
}

export function validateBudgetInput(input: BudgetInput): Result<BudgetInput> {
  if (!input.categoryId) return err("Elige una categoría.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return err("El límite debe ser mayor que 0.");
  }
  return ok({ ...input, amount: Math.round(input.amount * 100) / 100 });
}

export type BudgetStatus = "ok" | "warning" | "over";

export interface BudgetProgress {
  categoryId: string;
  limit: number;
  spent: number;
  remaining: number;
  ratio: number; // spent / limit, clamped display handled in UI
  status: BudgetStatus;
}

/**
 * Compare a budget limit against what's been spent. `warning` at ≥ 80%,
 * `over` once spending meets or exceeds the limit.
 */
export function budgetProgress(
  categoryId: string,
  limit: number,
  spent: number,
): BudgetProgress {
  const safeLimit = limit > 0 ? limit : 0;
  const ratio = safeLimit > 0 ? spent / safeLimit : 0;
  const status: BudgetStatus =
    ratio >= 1 ? "over" : ratio >= 0.8 ? "warning" : "ok";
  return {
    categoryId,
    limit: round2(safeLimit),
    spent: round2(spent),
    remaining: round2(safeLimit - spent),
    ratio,
    status,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
