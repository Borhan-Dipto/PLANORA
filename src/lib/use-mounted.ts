"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * True once hydrated on the client, false during SSR and the first client render.
 * Prefer this over `useState(false) + useEffect(() => setMounted(true))` — that pattern
 * calls setState synchronously inside an effect body, which triggers a cascading re-render;
 * useSyncExternalStore gives the same "has hydrated" flag without ever calling setState.
 */
export function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
