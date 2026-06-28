"use client";

import { useEffect, useState } from "react";

/**
 * Returns `true` once the component has mounted on the client.
 *
 * Use this as a fallback guard for components that cannot rely on a
 * store-level `_hasHydrated` flag (e.g. non-persisted stores, or when you
 * need a generic client-mount check).
 *
 * For persisted Zustand stores, prefer the per-store `useStoreHydration`
 * selector exported alongside each store — it fires only after
 * `onRehydrateStorage` completes rather than on the first render tick.
 */
export function useHydration(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
