import { type Result, ok, err } from "@/shared/kernel/result";
import type { CategoryKind } from "./category";

export type TransactionKind = CategoryKind; // "income" | "expense"

export interface FinancialTransaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  kind: TransactionKind;
  amount: number;
  occurredAt: Date;
  notes: string | null;
  createdAt: Date;
}

export interface TransactionInput {
  accountId: string;
  categoryId: string | null;
  kind: TransactionKind;
  amount: number;
  occurredAt: Date;
  notes: string | null;
}

/** Client-safe DTO (dates as ISO). */
export interface TransactionDTO {
  id: string;
  accountId: string;
  categoryId: string | null;
  kind: TransactionKind;
  amount: number;
  occurredAt: string;
  notes: string | null;
}

export function toTransactionDTO(t: FinancialTransaction): TransactionDTO {
  return {
    id: t.id,
    accountId: t.accountId,
    categoryId: t.categoryId,
    kind: t.kind,
    amount: t.amount,
    occurredAt: t.occurredAt.toISOString(),
    notes: t.notes,
  };
}

export function validateTransactionInput(
  input: TransactionInput,
): Result<TransactionInput> {
  if (!input.accountId) return err("Elige una cuenta.");
  if (input.kind !== "income" && input.kind !== "expense") {
    return err(`Tipo de movimiento desconocido: ${input.kind}`);
  }
  if (!Number.isFinite(input.amount)) {
    return err("El importe no es un número válido.");
  }
  if (input.amount <= 0) {
    return err("El importe debe ser mayor que 0.");
  }
  if (Number.isNaN(input.occurredAt.getTime())) {
    return err("La fecha no es válida.");
  }
  return ok({
    ...input,
    amount: Math.round(input.amount * 100) / 100, // 2 decimals
    notes: input.notes?.trim() || null,
  });
}
