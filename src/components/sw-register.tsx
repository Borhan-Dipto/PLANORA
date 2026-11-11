"use client";

import { useEffect } from "react";

/** Registers /sw.js on mount. A service worker is one of Chrome's PWA installability
 * requirements (alongside HTTPS + a valid manifest) — without one, "Install app" fails
 * with "This app can't be installed" even though the manifest/icons are fine.
 *
 * Also makes every new deploy reach already-installed/open PWAs with zero user action:
 * - `updateViaCache: "none"` stops the browser from ever serving a cached copy of sw.js itself,
 *   so a new sw.js (and the fetch-time check below) is always seen on the very next visit.
 * - sw.js's own install/activate (`skipWaiting` + `clients.claim`) make a new worker version take
 *   over immediately instead of waiting for every tab to be closed first.
 * - the `controllerchange` listener below then reloads any already-open tab/PWA exactly once, so
 *   it picks up the new JS build instead of going stale while left open — no uninstall, no
 *   "clear site data", nothing for the user to do. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Only a page that was ALREADY controlled by a worker should auto-reload on a controller
    // change — on a brand-new registration (nothing controlling the page yet), clients.claim()
    // in sw.js's activate handler also fires "controllerchange" once, which would otherwise
    // reload a first-ever visit for no reason.
    const hadController = !!navigator.serviceWorker.controller;

    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((registration) => {
      // Ask the browser to check for a new sw.js right away, and again on every tab-focus — covers
      // a PWA window that was left open across a deploy.
      registration.update().catch(() => {});
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") registration.update().catch(() => {});
      });
    }).catch(() => {
      // Non-fatal: the app still works without it, just without offline fallback /
      // installability in browsers that require one.
    });

    if (!hadController) return;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  }, []);

  return null;
}
