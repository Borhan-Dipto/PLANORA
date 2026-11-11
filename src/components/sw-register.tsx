"use client";

import { useEffect } from "react";

/** Registers /sw.js on mount. A service worker is one of Chrome's PWA installability
 * requirements (alongside HTTPS + a valid manifest) — without one, "Install app" fails
 * with "This app can't be installed" even though the manifest/icons are fine. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-fatal: the app still works without it, just without offline fallback /
        // installability in browsers that require one.
      });
    }
  }, []);

  return null;
}
