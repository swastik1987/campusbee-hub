import * as React from "react";
import { WifiOff } from "lucide-react";

/**
 * Slim banner shown while the device is offline. The service worker keeps the
 * app shell renderable offline, but data queries will fail — this tells the
 * user why instead of leaving broken screens unexplained.
 */
const OfflineBanner = React.forwardRef<HTMLDivElement>((_props, ref) => {
  const [offline, setOffline] = React.useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  React.useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      ref={ref}
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-slate-800 px-4 py-2 text-center text-xs font-semibold text-white"
      style={{ paddingTop: "max(8px, env(safe-area-inset-top, 8px))" }}
    >
      <WifiOff size={13} aria-hidden />
      You're offline — reconnect to browse classes
    </div>
  );
});

OfflineBanner.displayName = "OfflineBanner";

export default OfflineBanner;
