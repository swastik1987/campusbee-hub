import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useUser } from "@/contexts/UserContext";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Loader2,
  Mail,
  Search,
  Shield,
} from "lucide-react";

// ── Design tokens (matches Landing.tsx) ───────────────────────────────────
const A_FROM = "oklch(0.78 0.18 250)";
const A_TO   = "oklch(0.62 0.20 250)";
const A_DEEP = "oklch(0.45 0.18 250)";
const A_SOFT = "oklch(0.97 0.03 250)";
const INK    = "#0F172A";
const MUTED  = "#64748B";
const HAIR   = "#E2E8F0";
const PAGE   = "#FAFAF9";

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
  const [email, setEmail]               = useState("");
  const [sent, setSent]                 = useState(false);
  const [loading, setLoading]           = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading]   = useState(false);
  const [error, setError]               = useState("");
  const [debugInfo, setDebugInfo]       = useState("");

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, profile, profileError } = useUser();
  const googleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const urlRole = searchParams.get("role");
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
    if (intendedRole === "platform_admin" && profile.is_platform_admin) {
      navigate("/platform", { replace: true });
      return;
    }
    navigate("/", { replace: true });
  }, [session, profile, intendedRole, navigate]);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (googleTimeoutRef.current) clearTimeout(googleTimeoutRef.current);
      if (appleTimeoutRef.current) clearTimeout(appleTimeoutRef.current);
    };
  }, []);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    setDebugInfo("");
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      setDebugInfo(`Error code: ${(authError as any).status || "unknown"}`);
    } else {
      setSent(true);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    setDebugInfo("");
    if (intendedRole) localStorage.setItem(ROLE_STORAGE_KEY, intendedRole);

    googleTimeoutRef.current = setTimeout(() => {
      setGoogleLoading(false);
      setError("Google sign-in timed out. Please try again or use email login.");
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
      setError("Google sign-in failed. Please try email login.");
      setDebugInfo(errMsg);
      setGoogleLoading(false);
    } catch (err: any) {
      if (googleTimeoutRef.current) clearTimeout(googleTimeoutRef.current);
      setError("Google sign-in failed. Please try email login.");
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
      setError("Apple sign-in timed out. Please try again or use email login.");
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
      setError("Apple sign-in failed. Please try email login.");
      setDebugInfo(errMsg);
      setAppleLoading(false);
    } catch (err: any) {
      if (appleTimeoutRef.current) clearTimeout(appleTimeoutRef.current);
      setError("Apple sign-in failed. Please try email login.");
      setDebugInfo(err?.message ?? String(err));
      setAppleLoading(false);
    }
  };

  // Resolve role-specific theming
  const roleKey = intendedRole && intendedRole in ROLE_META ? intendedRole : null;
  const meta = roleKey ? ROLE_META[roleKey] : null;
  const gradFrom   = meta?.gradFrom   ?? A_FROM;
  const gradTo     = meta?.gradTo     ?? A_TO;
  const shadowHue  = meta?.shadowHue  ?? "250";
  const blobColor  = roleKey === "platform_admin" ? "#10b981" : A_FROM;
  const blob2Color = roleKey === "platform_admin" ? "#059669" : "oklch(0.85 0.15 200)";

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
          {/* Gradient logo mark */}
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
        {sent ? (
          /* Email-sent confirmation */
          <div style={{ background: "#fff", border: `1px solid ${HAIR}`, borderRadius: 22, padding: "28px 22px", textAlign: "center", boxShadow: "0 8px 28px -12px rgba(15,23,42,0.10)" }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: A_SOFT, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <CheckCircle2 size={30} style={{ color: A_TO }} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: INK, margin: "0 0 8px" }}>Check your email!</h2>
            <p style={{ fontSize: 13, color: MUTED, margin: "0 0 22px", lineHeight: 1.55 }}>
              We've sent a magic link to{" "}
              <span style={{ fontWeight: 700, color: INK }}>{email}</span>
            </p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              style={{ background: "transparent", color: MUTED, border: `1px solid ${HAIR}`, borderRadius: 11, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          /* Sign-in form */
          <div style={{ background: "#fff", border: `1px solid ${HAIR}`, borderRadius: 22, padding: "22px 20px", boxShadow: "0 8px 28px -12px rgba(15,23,42,0.10)" }}>

            {/* Google OAuth button */}
            <button
              onClick={handleGoogleLogin}
              disabled={googleLoading}
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
                <svg width="18" height="18" viewBox="0 0 24 24">
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
              disabled={appleLoading}
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
                marginTop: 10,
                opacity: appleLoading ? 0.7 : 1,
              }}
            >
              {appleLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              )}
              Continue with Apple
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
              <div style={{ flex: 1, height: 1, background: HAIR }} />
              <span style={{ fontSize: 11, color: MUTED, fontWeight: 600, whiteSpace: "nowrap" }}>or continue with email</span>
              <div style={{ flex: 1, height: 1, background: HAIR }} />
            </div>

            {/* Email + submit */}
            <form onSubmit={handleEmailSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <Mail
                  size={16}
                  style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: MUTED, pointerEvents: "none" }}
                />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    height: 48,
                    borderRadius: 13,
                    border: `1.5px solid ${HAIR}`,
                    paddingLeft: 40,
                    paddingRight: 14,
                    fontSize: 14,
                    color: INK,
                    background: "#fff",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = A_TO)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = HAIR)}
                />
              </div>

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

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  height: 50,
                  borderRadius: 13,
                  background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})`,
                  color: "#fff",
                  border: "none",
                  fontSize: 14,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.8 : 1,
                  boxShadow: `0 6px 16px -4px oklch(0.62 0.20 ${shadowHue} / 0.40)`,
                  transition: "opacity 0.15s",
                }}
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>Send Magic Link <ArrowRight size={15} /></>
                )}
              </button>
            </form>

            {/* Privacy note */}
            <p style={{ fontSize: 11, color: MUTED, textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
              By continuing you agree to our{" "}
              <span style={{ color: A_DEEP, fontWeight: 600, cursor: "pointer" }}>Terms</span>
              {" & "}
              <span style={{ color: A_DEEP, fontWeight: 600, cursor: "pointer" }}>Privacy Policy</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

Auth.displayName = "Auth";

export default Auth;
