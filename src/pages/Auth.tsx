import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useEffect } from "react";
import { Mail, CheckCircle2, Loader2 } from "lucide-react";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { session, isNewUser } = useUser();

  useEffect(() => {
    if (session) {
      navigate(isNewUser ? "/onboarding" : "/home", { replace: true });
    }
  }, [session, isNewUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2 animate-fade-up">
          <span className="text-5xl">🐝</span>
          <h1 className="text-2xl font-extrabold tracking-tight">
            <span className="gradient-primary-text">CampusBee</span>
          </h1>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-4 text-center animate-fade-up">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 size={32} className="text-success" />
            </div>
            <h2 className="text-lg font-bold">Check your email!</h2>
            <p className="text-sm text-muted-foreground">
              We've sent a login link to <span className="font-medium text-foreground">{email}</span>
            </p>
            <Button
              variant="ghost"
              className="mt-4 text-sm"
              onClick={() => { setSent(false); setEmail(""); }}
            >
              Use a different email
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 animate-fade-up" style={{ animationDelay: "100ms" }}>
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Enter your email to get started
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 pl-10 rounded-xl"
                  required
                  autoFocus
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              disabled={loading}
              className="w-full gradient-primary text-primary-foreground h-12 font-semibold rounded-xl active:scale-[0.97] transition-transform"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : "Send Magic Link"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Auth;
