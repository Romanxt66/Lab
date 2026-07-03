/**
 * Id: opaque identifier helpers shared across domains.
 * Uses the Web Crypto API (available in Node 24 and the browser).
 */
export type Id = string;

export function newId(): Id {
  return crypto.randomUUID();
}
