import * as React from "react";

/** Chromium's non-standard install event (Android Chrome, desktop Chrome/Edge). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// beforeinstallprompt fires once, early, and only when install criteria are
// met — capture it at module scope so the hook works no matter when the
// consuming component mounts.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((fn) => fn());
  });
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari legacy flag
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports as Mac; distinguish via touch points.
  return (
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

/**
 * Install-state helper for the "Install app" UI.
 * - `canPrompt` → Chromium captured beforeinstallprompt; call `promptInstall()`.
 * - `showIosInstructions` → iOS browser, not installed; show Share → Add to
 *   Home Screen instructions (iOS has no programmatic install prompt).
 * - `installed` → already running standalone; hide install UI.
 */
export function useInstallPrompt() {
  const subscribe = React.useCallback((onChange: () => void) => {
    listeners.add(onChange);
    return () => listeners.delete(onChange);
  }, []);
  const canPrompt = React.useSyncExternalStore(
    subscribe,
    () => deferredPrompt !== null,
    () => false,
  );

  const promptInstall = React.useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") deferredPrompt = null;
    listeners.forEach((fn) => fn());
    return outcome === "accepted";
  }, []);

  const installed = isStandalone();
  return {
    installed,
    canPrompt: canPrompt && !installed,
    showIosInstructions: isIos() && !installed && !canPrompt,
    promptInstall,
  };
}
