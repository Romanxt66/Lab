"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * `false` during SSR and the first (hydration) render, then `true` once the
 * component is running on the client. Lets a component render a stable,
 * server-safe placeholder and swap in client-only values (Date.now(),
 * localStorage, DOM state) without a setState-in-effect.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
