import { type Result, ok, err } from "@/shared/kernel/result";

export type AccountKind = "cash" | "bank" | "card" | "savings" | "other";

export const ACCOUNT_KINDS: AccountKind[] = [
  "cash",
  "bank",
  "card",
  "savings",
  "other",
];

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  cash: "Efectivo",
  bank: "Banco",
  card: "Tarjeta",
  savings: "Ahorros",
  other: "Otra",
};

export interface FinancialAccount {
  id: string;
  name: string;
  kind: AccountKind;
  currency: string;
  initialBalance: number;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountInput {
  name: string;
  kind: AccountKind;
  currency: string;
  initialBalance: number;
  archived: boolean;
}

/** Client-safe DTO (numbers only, dates as ISO). */
export interface AccountDTO {
  id: string;
  name: string;
  kind: AccountKind;
  currency: string;
  initialBalance: number;
  archived: boolean;
}

export function toAccountDTO(a: FinancialAccount): AccountDTO {
  return {
    id: a.id,
    name: a.name,
    kind: a.kind,
    currency: a.currency,
    initialBalance: a.initialBalance,
    archived: a.archived,
  };
}

export function validateAccountInput(input: AccountInput): Result<AccountInput> {
  const name = input.name.trim();
  if (!name) return err("El nombre no puede estar vacío.");
  if (!ACCOUNT_KINDS.includes(input.kind)) {
    return err(`Tipo de cuenta desconocido: ${input.kind}`);
  }
  if (!input.currency.trim()) return err("La moneda es obligatoria.");
  if (Number.isNaN(input.initialBalance)) {
    return err("El saldo inicial no es un número válido.");
  }
  return ok({
    ...input,
    name,
    currency: input.currency.trim().toUpperCase().slice(0, 6),
  });
}
