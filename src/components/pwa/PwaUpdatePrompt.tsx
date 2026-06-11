import * as React from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";

/**
 * Registers the service worker and surfaces a "new version available" toast.
 * Installed PWAs never hard-reload on their own, so without this users can
 * sit on a stale bundle for weeks. Renders nothing.
 */
const PwaUpdatePrompt = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      // Non-fatal: the app works without a SW (e.g. private browsing).
      console.warn("Service worker registration failed", error);
    },
  });

  React.useEffect(() => {
    if (!needRefresh) return;
    toast("A new version of CampusBee is available", {
      id: "pwa-update",
      duration: Infinity,
      action: {
        label: "Refresh",
        onClick: () => updateServiceWorker(true),
      },
      onDismiss: () => setNeedRefresh(false),
    });
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
};

export default PwaUpdatePrompt;
