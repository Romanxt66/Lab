/**
 * Result: a tiny, dependency-free way to model success/failure without throwing.
 *
 * The domain and application layers return `Result<T>` so callers must handle
 * the error path explicitly. Adapters (infrastructure) translate exceptions
 * from the outside world into `err(...)`.
 */
export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E = string>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(
  r: Result<T, E>,
): r is { ok: true; value: T } {
  return r.ok;
}
