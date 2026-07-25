import { type Result, ok, err } from "@/shared/kernel/result";

export type CategoryKind = "income" | "expense";
export const CATEGORY_KINDS: CategoryKind[] = ["income", "expense"];

export interface TransactionCategory {
  id: string;
  name: string;
  kind: CategoryKind;
  color: string | null;
  createdAt: Date;
}

export interface CategoryInput {
  name: string;
  kind: CategoryKind;
  color?: string | null;
}

export interface CategoryDTO {
  id: string;
  name: string;
  kind: CategoryKind;
  color: string | null;
}

export function toCategoryDTO(c: TransactionCategory): CategoryDTO {
  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    color: c.color,
  };
}

export function validateCategoryInput(input: CategoryInput): Result<CategoryInput> {
  const name = input.name.trim();
  if (!name) return err("El nombre no puede estar vacío.");
  if (!CATEGORY_KINDS.includes(input.kind)) {
    return err(`Tipo desconocido: ${input.kind}`);
  }
  return ok({
    ...input,
    name,
    color: input.color?.trim() || null,
  });
}
