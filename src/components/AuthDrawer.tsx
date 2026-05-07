/**
 * AuthDrawer — inline bottom-sheet login prompt.
 *
 * Shown when an anonymous visitor taps an action (Enroll, Book Trial, Chat)
 * on the public class detail page.  Supports Google OAuth and Apple OAuth
 * without leaving the page.
 *
 * OAuth return-to flow:
 *   Before starting an OAuth redirect, the current pathname is saved to
 *   localStorage under OAUTH_RETURN_KEY.  After the redirect completes the
 *   OAuthReturnHandler in App.tsx reads the key and navigates back.
 *   If the OAuth provider uses a popup (no page redirect), the session
 *   update is detected by the useEffect below and the drawer closes in-place.
 */

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { lovable } from "@/integrations/lovable/index";
import { useUser } from "@/contexts/UserContext";
import { AlertTriangle, Loader2 } from "lucide-react";

// ── Shared constant ──────────────────────────────────────────────────────────
/** localStorage key used to restore the page after an OAuth full-redirect. */
export const OAUTH_RETURN_KEY = "campusbee_oauth_return_to";

// ── Design tokens (matches Auth.tsx) ─────────────────────────────────────────
const INK  = "#0F172A";
const MUTED = "#64748B";
const HAIR  = "#E2E8F0";

// ── Types ────────────────────────────────────────────────────────────────────
export interface AuthDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Context-specific message shown at the top of the drawer. */
  message?: string;
}

// ── Component ────────────────────────────────────────────────────────────────
const AuthDrawer = React.forwardRef<HTMLDivElement, AuthDrawerProps>(
  ({ open, onOpenChange, message }, ref) => {
    const { session } = useUser();

    const [googleLoading, setGoogleLoading] = React.useState(false);
    const [appleLoading,  setAppleLoading]  = React.useState(false);
    const [error, setError] = React.useState("");

    const googleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const appleTimerRef  = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Auto-close when OAuth popup completes (session becomes non-null)
    React.useEffect(() => {
      if (session && open) onOpenChange(false);
    }, [session, open, onOpenChange]);

    // Clear timers on unmount
    React.useEffect(() => {
      return () => {
        if (googleTimerRef.current) clearTimeout(googleTimerRef.current);
        if (appleTimerRef.current)  clearTimeout(appleTimerRef.current);
      };
    }, []);

    // Reset state when drawer opens
    React.useEffect(() => {
      if (open) {
        setError("");
        setGoogleLoading(false);
        setAppleLoading(false);
      }
    }, [open]);

    // ── OAuth ──────────────────────────────────────────────────────────────
    const handleOAuth = async (provider: "google" | "apple") => {
      const setLoading = provider === "google" ? setGoogleLoading : setAppleLoading;
      const timerRef   = provider === "google" ? googleTimerRef   : appleTimerRef;

      setLoading(true);
      setError("");

      // Save current path so OAuthReturnHandler can navigate back after redirect
      localStorage.setItem(
        OAUTH_RETURN_KEY,
        window.location.pathname + window.location.search,
      );

      timerRef.current = setTimeout(() => {
        setLoading(false);
        setError("Sign-in timed out. Please try again.");
        localStorage.removeItem(OAUTH_RETURN_KEY);
      }, 15000);

      try {
        const result = await lovable.auth.signInWithOAuth(provider, {
          redirect_uri: window.location.origin,
        });
        // Popup flow: tokens set directly, no page redirect
        if (result?.redirected) return; // full redirect — page will navigate
        if (timerRef.current) clearTimeout(timerRef.current);
        if (result?.error) {
          const msg = result.error instanceof Error
            ? result.error.message : String(result.error);
          setError("Sign-in failed. Please try again.");
          console.error("[AuthDrawer] OAuth error:", msg);
        }
        setLoading(false);
      } catch (err: unknown) {
        if (timerRef.current) clearTimeout(timerRef.current);
        setError("Sign-in failed. Please try again.");
        console.error("[AuthDrawer] OAuth exception:", err);
        setLoading(false);
      }
    };

    const anyLoading = googleLoading || appleLoading;

    // ── Render ─────────────────────────────────────────────────────────────
    return (
      <div ref={ref}>
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="bottom" className="rounded-t-2xl p-0">
            <SheetHeader className="px-5 pt-5 pb-1">
              <SheetTitle className="text-left text-[15px]">
                {message ?? "Log in to continue"}
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                Join CampusBee to enroll, book trials, and connect with providers.
              </p>
            </SheetHeader>

            <div className="px-5 pt-4 pb-8 space-y-3">

              {/* Google */}
              <button
                type="button"
                onClick={() => handleOAuth("google")}
                disabled={anyLoading}
                style={{
                  width: "100%", height: 50,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  background: "#fff", border: `1.5px solid ${HAIR}`, borderRadius: 14,
                  fontSize: 14, fontWeight: 600, color: INK,
                  cursor: googleLoading ? "default" : "pointer",
                  opacity: googleLoading ? 0.7 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {googleLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                Continue with Google
              </button>

              {/* Apple */}
              <button
                type="button"
                onClick={() => handleOAuth("apple")}
                disabled={anyLoading}
                style={{
                  width: "100%", height: 50,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  background: INK, border: `1.5px solid ${INK}`, borderRadius: 14,
                  fontSize: 14, fontWeight: 600, color: "#fff",
                  cursor: appleLoading ? "default" : "pointer",
                  opacity: appleLoading ? 0.7 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {appleLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <svg width="16" height="18" viewBox="0 0 814 1000" fill="white" aria-hidden>
                    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.8-155.5-127.4C46 790.8 1 701.9 1 644.8c0-218.7 143.8-334.5 285.1-334.5 75.7 0 138.7 49.8 185.9 49.8 45.2 0 116.7-52.7 202.4-52.7zm-2.1-168c39.8-47.6 68-113.8 68-180 0-9.5-.7-19-2.1-26.3-64.1 2.5-141.7 42.8-188.7 95.8-36.4 40.5-71.9 106.7-71.9 174.9 0 10.1 1.6 20.3 2.3 23.4 4.3.7 11.3 1.6 18.4 1.6 57.8 0 128.8-39.1 174-89.4z"/>
                  </svg>
                )}
                Continue with Apple
              </button>

              {/* OAuth error */}
              {error && (
                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium"
                  style={{ background: "rgba(225,29,72,0.06)", color: "#e11d48", border: "1px solid rgba(225,29,72,0.2)" }}
                >
                  <AlertTriangle size={13} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              <p style={{ fontSize: 11, color: MUTED, textAlign: "center", lineHeight: 1.5, marginTop: 2 }}>
                By continuing you agree to our{" "}
                <span style={{ color: "oklch(0.62 0.20 250)", fontWeight: 600 }}>Terms</span>
                {" & "}
                <span style={{ color: "oklch(0.62 0.20 250)", fontWeight: 600 }}>Privacy Policy</span>
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  },
);

AuthDrawer.displayName = "AuthDrawer";
export default AuthDrawer;
