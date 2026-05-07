import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useUser } from "@/contexts/UserContext";
import { Mail, AlertTriangle, Loader2, Phone, Shield } from "lucide-react";
import { toast } from "sonner";

const ROLE_STORAGE_KEY = "campusbee_intended_role";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [debugInfo, setDebugInfo] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, profile, profileError } = useUser();
  const googleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const urlRole = searchParams.get("role");
  const storedRole = localStorage.getItem(ROLE_STORAGE_KEY);
  const intendedRole = urlRole || storedRole;

  useEffect(() => {
    if (urlRole) {
      localStorage.setItem(ROLE_STORAGE_KEY, urlRole);
    }
  }, [urlRole]);

  useEffect(() => {
    if (!session) return;
    if (!profile) return;
    localStorage.removeItem(ROLE_STORAGE_KEY);
    if (intendedRole === "platform_admin" && profile.is_platform_admin) {
      navigate("/platform", { replace: true });
      return;
    }
    navigate("/home", { replace: true });
  }, [session, profile, intendedRole, navigate]);

  useEffect(() => {
    return () => {
      if (googleTimeoutRef.current) clearTimeout(googleTimeoutRef.current);
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
    if (intendedRole) {
      localStorage.setItem(ROLE_STORAGE_KEY, intendedRole);
    }
    googleTimeoutRef.current = setTimeout(() => {
      setGoogleLoading(false);
      setError("Google sign-in timed out. Please try again or use email login.");
    }, 15000);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result?.redirected) {
        return;
      }
      if (!result?.error) {
        if (googleTimeoutRef.current) clearTimeout(googleTimeoutRef.current);
        setGoogleLoading(false);
        return;
      }
      if (googleTimeoutRef.current) clearTimeout(googleTimeoutRef.current);
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

  // Loading state while profile sets up
  if (session && !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-3 max-w-md text-center">
          <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-xl">C</span>
          </div>
          {profileError ? (
            <>
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle size={16} />
                <p className="text-sm font-medium">Couldn't set up your profile</p>
              </div>
              <p className="text-xs text-muted-foreground break-all px-4">{profileError}</p>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                  Retry
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.href = "/auth";
                  }}
                >
                  Sign out
                </Button>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm animate-fade-up">Setting up your profile...</p>
          )}
        </div>
      </div>
    );
  }

  // Sent state
  if (sent) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        {/* Blue hero */}
        <div className="gradient-primary px-6 pb-10 pt-16 rounded-b-[2.5rem]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
            <span className="text-white font-bold text-xl">C</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white leading-snug">
            Check your email!
          </h1>
          <p className="mt-2 text-sm text-white/80">
            We sent a magic link to{" "}
            <span className="font-semibold text-white">{email}</span>
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 px-6 pt-10 text-center">
          <p className="text-sm text-muted-foreground">Click the link in the email to sign in. It expires in 1 hour.</p>
          <Button
            variant="outline"
            className="mt-4 rounded-xl"
            onClick={() => { setSent(false); setEmail(""); }}
          >
            Use a different email
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Blue hero section */}
      <div className="gradient-primary px-6 pb-12 pt-16 rounded-b-[2.5rem]">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
          {intendedRole === "platform_admin" ? (
            <Shield size={22} className="text-white" />
          ) : (
            <span className="text-white font-bold text-xl">C</span>
          )}
        </div>
        <h1 className="mt-5 text-2xl font-bold text-white leading-snug">
          {intendedRole === "platform_admin"
            ? "Admin sign in."
            : "Welcome back.\nLet's find a class."}
        </h1>
        <p className="mt-2 text-sm text-white/80">
          {intendedRole === "platform_admin"
            ? "Sign in to access the platform admin panel"
            : "Sign in with email — we'll send you a magic link."}
        </p>
      </div>

      {/* Form area */}
      <div className="flex-1 px-6 pt-8 space-y-5 max-w-sm mx-auto w-full">
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Email Address
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 pl-10 rounded-xl"
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-destructive" />
                <p className="text-sm text-destructive font-medium">{error}</p>
              </div>
              {debugInfo && (
                <p className="text-xs text-muted-foreground pl-5">{debugInfo}</p>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full gradient-primary text-white h-12 font-semibold rounded-xl active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>Send magic link →</>
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-medium">OR CONTINUE WITH</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Social buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="flex-1 h-12 rounded-xl font-medium text-sm gap-2"
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
            Google
          </Button>

          <Button
            variant="outline"
            disabled
            className="flex-1 h-12 rounded-xl font-medium text-sm gap-2 opacity-50 cursor-not-allowed"
            onClick={() => toast.info("Phone OTP coming soon")}
          >
            <Phone size={16} />
            Phone OTP
          </Button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pb-8">
          By continuing you agree to CampusBee's{" "}
          <span className="text-primary font-medium">Terms</span> and{" "}
          <span className="text-primary font-medium">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
};

export default Auth;
