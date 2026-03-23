import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Mail, CheckCircle2, Loader2, Shield, Building2 } from "lucide-react";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, profile } = useUser();
  const intendedRole = searchParams.get("role"); // platform_admin | apartment_admin | null

  useEffect(() => {
    if (!session || !profile) return;

    // Smart redirect based on intended role from landing page
    if (intendedRole === "platform_admin" && profile.is_platform_admin) {
      navigate("/platform", { replace: true });
      return;
    }
    if (intendedRole === "apartment_admin" && profile.is_apartment_admin) {
      navigate("/admin/dashboard", { replace: true });
      return;
    }

    // Default: go to landing hub which shows contextual options for all users
    navigate("/", { replace: true });
  }, [session, profile, intendedRole, navigate]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
    } else {
      setSent(true);
    }
  };

  const handleGoogleLogin = async () => {
    setOauthLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (authError) {
      setError(authError.message);
      setOauthLoading(false);
    }
    // If no error, the browser will be redirected to Google.
    // On return, Supabase client auto-detects the tokens in the URL hash.
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3 animate-fade-up">
          <img src="/logo-full.png" alt="CampusBee" className="h-16 object-contain" />
          {intendedRole === "platform_admin" ? (
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1">
                <Shield size={14} className="text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700">Platform Admin</span>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Sign in to access the platform admin panel
              </p>
            </div>
          ) : intendedRole === "apartment_admin" ? (
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1">
                <Building2 size={14} className="text-indigo-600" />
                <span className="text-xs font-semibold text-indigo-700">Apartment Admin</span>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Sign in to manage your apartment community
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              Discover classes in your apartment community
            </p>
          )}
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-4 text-center animate-fade-up">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 size={32} className="text-success" />
            </div>
            <h2 className="text-lg font-bold">Check your email!</h2>
            <p className="text-sm text-muted-foreground">
              We've sent a login link to{" "}
              <span className="font-medium text-foreground">{email}</span>
            </p>
            <Button
              variant="ghost"
              className="mt-4 text-sm"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
            >
              Use a different email
            </Button>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-up" style={{ animationDelay: "100ms" }}>
            {/* Google login */}
            <Button
              variant="outline"
              onClick={handleGoogleLogin}
              disabled={oauthLoading}
              className="w-full h-12 rounded-xl font-medium text-sm gap-3"
            >
              {oauthLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              Continue with Google
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>

            {/* Email magic link */}
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-muted-foreground">
                  Continue with email
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
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

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="w-full gradient-primary text-primary-foreground h-12 font-semibold rounded-xl active:scale-[0.97] transition-transform"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  "Send Magic Link"
                )}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
