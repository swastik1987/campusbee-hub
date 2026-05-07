import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useUser } from "@/contexts/UserContext";
import { OAUTH_RETURN_KEY } from "@/components/AuthDrawer";
import {
  AlertTriangle,
  GraduationCap,
  Loader2,
  Search,
  Shield,
} from "lucide-react";

// ── Design tokens (matches Landing.tsx) ───────────────────────────────────
const A_FROM = "oklch(0.78 0.18 250)";
const A_TO   = "oklch(0.62 0.20 250)";
const A_DEEP = "oklch(0.45 0.18 250)";
const INK    = "#0F172A";
const MUTED  = "#64748B";
const HAIR   = "#E2E8F0";
const PAGE   = "#FAFAF9";
const A_SOFT = "oklch(0.97 0.03 250)";

const ROLE_STORAGE_KEY = "campusbee_intended_role";

// ── Role metadata ─────────────────────────────────────────────────────────
type RoleKey = "seeker" | "provider" | "platform_admin" | null;

const ROLE_META: Record<NonNullable<RoleKey>, {
  Icon: typeof Search;
  label: string;
  tagline: string;
  badgeColor: string;
  badgeBg: string;
  gradFrom: string;
  gradTo: string;
  shadowHue: string;
}> = {
  seeker: {
    Icon: Search,
    label: "Learner",
    tagline: "Find classes near you — for any age.",
    badgeColor: A_DEEP,
    badgeBg: A_SOFT,
    gradFrom: A_FROM,
    gradTo: A_TO,
    shadowHue: "250",
  },
  provider: {
    Icon: GraduationCap,
    label: "Instructor",
    tagline: "List classes and grow your business.",
    badgeColor: A_DEEP,
    badgeBg: A_SOFT,
    gradFrom: A_FROM,
    gradTo: A_TO,
    shadowHue: "250",
  },
  platform_admin: {
    Icon: Shield,
    label: "Platform Admin",
    tagline: "Sign in to access the admin panel.",
    badgeColor: "#065f46",
    badgeBg: "rgba(16,185,129,0.08)",
    gradFrom: "#10b981",
    gradTo: "#059669",
    shadowHue: "160",
  },
};

// ── Component ──────────────────────────────────────────────────────────────
const Auth = React.forwardRef<HTMLDivElement, Record<string, never>>((_props, ref) => {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading,  setAppleLoading]  = useState(false);
  const [error,     setError]     = useState("");
  const [debugInfo, setDebugInfo] = useState("");

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, profile, profileError } = useUser();
  const googleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appleTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const urlRole    = searchParams.get("role");
  const storedRole = localStorage.getItem(ROLE_STORAGE_KEY);
  const intendedRole = (urlRole || storedRole) as RoleKey;

  // Persist role from URL
  useEffect(() => {
    if (urlRole) localStorage.setItem(ROLE_STORAGE_KEY, urlRole);
  }, [urlRole]);

  // Redirect once authenticated
  useEffect(() => {
    if (!session || !profile) return;
    localStorage.removeItem(ROLE_STORAGE_KEY);
    // Check for OAuth return-to key (set by AuthDrawer before triggering OAuth from a public page)
    const returnTo = localStorage.getItem(OAUTH_RETURN_KEY);
    if (returnTo && returnTo.startsWith("/")) {
      localStorage.removeItem(OAUTH_RETURN_KEY);
      navigate(returnTo, { replace: true });
      return;
    }
    if (intendedRole === "platform_admin" && profile.is_platform_admin) {
      navigate("/platform", { replace: true });
      return;
    }
    navigate("/", { replace: true });
  }, [session, profile, intendedRole, navigate]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (googleTimeoutRef.current) clearTimeout(googleTimeoutRef.current);
      if (appleTimeoutRef.current)  clearTimeout(appleTimeoutRef.current);
    };
  }, []);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    setDebugInfo("");
    if (intendedRole) localStorage.setItem(ROLE_STORAGE_KEY, intendedRole);

    googleTimeoutRef.current = setTimeout(() => {
      setGoogleLoading(false);
      setError("Google sign-in timed out. Please try again.");
      setDebugInfo("The OAuth flow did not complete within 15 seconds. Check if popups are blocked.");
    }, 15000);

    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result?.redirected) return;
      if (googleTimeoutRef.current) clearTimeout(googleTimeoutRef.current);
      if (!result?.error) { setGoogleLoading(false); return; }
      const errMsg = result.error instanceof Error ? result.error.message : String(result.error);
      setError("Google sign-in failed. Please try again.");
      setDebugInfo(errMsg);
      setGoogleLoading(false);
    } catch (err: any) {
      if (googleTimeoutRef.current) clearTimeout(googleTimeoutRef.current);
      setError("Google sign-in failed. Please try again.");
      setDebugInfo(err?.message ?? String(err));
      setGoogleLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setAppleLoading(true);
    setError("");
    setDebugInfo("");
    if (intendedRole) localStorage.setItem(ROLE_STORAGE_KEY, intendedRole);

    appleTimeoutRef.current = setTimeout(() => {
      setAppleLoading(false);
      setError("Apple sign-in timed out. Please try again.");
      setDebugInfo("The OAuth flow did not complete within 15 seconds.");
    }, 15000);

    try {
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (result?.redirected) return;
      if (appleTimeoutRef.current) clearTimeout(appleTimeoutRef.current);
      if (!result?.error) { setAppleLoading(false); return; }
      const errMsg = result.error instanceof Error ? result.error.message : String(result.error);
      setError("Apple sign-in failed. Please try again.");
      setDebugInfo(errMsg);
      setAppleLoading(false);
    } catch (err: any) {
      if (appleTimeoutRef.current) clearTimeout(appleTimeoutRef.current);
      setError("Apple sign-in failed. Please try again.");
      setDebugInfo(err?.message ?? String(err));
      setAppleLoading(false);
    }
  };

  // Resolve role-specific theming
  const roleKey    = intendedRole && intendedRole in ROLE_META ? intendedRole : null;
  const meta       = roleKey ? ROLE_META[roleKey] : null;
  const gradFrom   = meta?.gradFrom  ?? A_FROM;
  const gradTo     = meta?.gradTo    ?? A_TO;
  const shadowHue  = meta?.shadowHue ?? "250";
  const blobColor  = roleKey === "platform_admin" ? "#10b981" : A_FROM;
  const blob2Color = roleKey === "platform_admin" ? "#059669" : "oklch(0.85 0.15 200)";
  const anyLoading = googleLoading || appleLoading;

  // ── Profile-loading overlay (after OAuth redirect) ─────────────────────
  if (session && !profile) {
    return (
      <div
        ref={ref}
        style={{ background: PAGE, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px", fontFamily: '-apple-system,"Inter",system-ui,sans-serif' }}
      >
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 26 }}>
            C
          </div>
          {profileError ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#e11d48" }}>
                <AlertTriangle size={15} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Couldn't set up your profile</span>
              </div>
              <p style={{ fontSize: 12, color: MUTED, maxWidth: 280, lineHeight: 1.5 }}>{profileError}</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => window.location.reload()}
                  style={{ background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})`, color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  Retry
                </button>
                <button
                  onClick={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }}
                  style={{ background: "transparent", color: MUTED, border: `1px solid ${HAIR}`, borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 14, color: MUTED }}>Setting up your profile…</p>
          )}
        </div>
      </div>
    );
  }

  // ── Main auth screen ───────────────────────────────────────────────────
  return (
    <div
      ref={ref}
      style={{
        background: PAGE,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        position: "relative",
        overflow: "hidden",
        fontFamily: '-apple-system,"Inter",system-ui,sans-serif',
      }}
    >
      {/* Aurora blobs */}
      <div aria-hidden style={{ position: "absolute", top: -140, right: -80, width: 320, height: 320, borderRadius: "50%", background: blobColor, filter: "blur(72px)", opacity: 0.22, pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", bottom: -140, left: -80, width: 280, height: 280, borderRadius: "50%", background: blob2Color, filter: "blur(72px)", opacity: 0.15, pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 360, position: "relative" }}>

        {/* ── Logo + headline ──────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            display: "inline-flex",
            width: 64,
            height: 64,
            borderRadius: 20,
            background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})`,
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 800,
            fontSize: 30,
            marginBottom: 16,
            boxShadow: `0 12px 28px -8px oklch(0.62 0.20 ${shadowHue} / 0.45)`,
          }}>
            C
          </div>

          <h1 style={{ fontSize: 26, fontWeight: 800, color: INK, letterSpacing: -0.5, lineHeight: 1.1, margin: "0 0 8px" }}>
            Welcome to{" "}
            <span style={{ background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              CampusBee
            </span>
          </h1>

          {/* Role badge */}
          {meta && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: meta.badgeBg, color: meta.badgeColor, borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              <meta.Icon size={12} />
              {meta.label}
            </div>
          )}

          <p style={{ fontSize: 13, color: MUTED, marginTop: meta ? 6 : 4, lineHeight: 1.5 }}>
            {meta ? meta.tagline : "Discover classes near you."}
          </p>
        </div>

        {/* ── Card ─────────────────────────────────────────────────── */}
        <div style={{ background: "#fff", border: `1px solid ${HAIR}`, borderRadius: 22, padding: "22px 20px", boxShadow: "0 8px 28px -12px rgba(15,23,42,0.10)", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Google OAuth button */}
          <button
            onClick={handleGoogleLogin}
            disabled={anyLoading}
            style={{
              width: "100%",
              height: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              background: "#fff",
              border: `1.5px solid ${HAIR}`,
              borderRadius: 13,
              fontSize: 14,
              fontWeight: 600,
              color: INK,
              cursor: googleLoading ? "default" : "pointer",
              transition: "border-color 0.15s",
              opacity: googleLoading ? 0.7 : 1,
            }}
          >
            {googleLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            Continue with Google
          </button>

          {/* Apple OAuth button */}
          <button
            onClick={handleAppleLogin}
            disabled={anyLoading}
            style={{
              width: "100%",
              height: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              background: "#000",
              border: "1.5px solid #000",
              borderRadius: 13,
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
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

          {/* OAuth error display */}
          {error && (
            <div style={{ borderRadius: 10, background: "rgba(225,29,72,0.06)", border: "1px solid rgba(225,29,72,0.2)", padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={13} style={{ color: "#e11d48", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#e11d48", fontWeight: 600 }}>{error}</span>
              </div>
              {debugInfo && (
                <p style={{ fontSize: 11, color: MUTED, marginTop: 4, marginLeft: 19, lineHeight: 1.4 }}>{debugInfo}</p>
              )}
            </div>
          )}

          {/* Privacy note */}
          <p style={{ fontSize: 11, color: MUTED, textAlign: "center", lineHeight: 1.5, marginTop: 2 }}>
            By continuing you agree to our{" "}
            <span style={{ color: A_DEEP, fontWeight: 600, cursor: "pointer" }}>Terms</span>
            {" & "}
            <span style={{ color: A_DEEP, fontWeight: 600, cursor: "pointer" }}>Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
});

Auth.displayName = "Auth";

export default Auth;
