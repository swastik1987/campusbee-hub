import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { Search, UserPlus, GraduationCap, Music, Dumbbell, Palette, Shield, Building2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

const features = [
  {
    title: "Discover Classes",
    desc: "Browse sports, arts, dance, music & tuition classes in your apartment.",
    icon: Search,
  },
  {
    title: "Enroll in One Tap",
    desc: "Pick a batch, register your family member, track everything.",
    icon: UserPlus,
  },
  {
    title: "For Instructors Too",
    desc: "List your classes, manage batches, track attendance & payments.",
    icon: GraduationCap,
  },
];

const Landing = () => {
  const navigate = useNavigate();
  const { session, profile, family, loading } = useUser();

  // Auto-redirect logged-in users to the appropriate dashboard
  useEffect(() => {
    if (loading || !session || !profile) return;

    // If user has a family, go to normal home
    if (family) {
      navigate("/home", { replace: true });
      return;
    }

    // Admins without family — redirect to their respective panel
    if (profile.is_platform_admin) {
      navigate("/platform", { replace: true });
      return;
    }
    if (profile.is_apartment_admin) {
      navigate("/admin/dashboard", { replace: true });
      return;
    }

    // Regular new user without family — onboarding
    navigate("/onboarding", { replace: true });
  }, [session, profile, family, loading, navigate]);

  // Show nothing while auto-redirecting a logged-in user
  if (session && !loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo-icon.png" alt="CampusBee" className="h-12 w-12 object-contain animate-fade-in" />
          <p className="text-muted-foreground text-sm animate-fade-up">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero */}
      <div className="flex flex-1 flex-col items-center px-6 pt-16 pb-8">
        {/* Logo */}
        <div className="mb-4 animate-fade-up" style={{ animationDelay: "0ms" }}>
          <img src="/logo-full.png" alt="CampusBee" className="h-20 object-contain" />
        </div>
        <p
          className="mb-8 max-w-xs text-center text-muted-foreground animate-fade-up"
          style={{ animationDelay: "160ms" }}
        >
          Every class your community needs. One tap away.
        </p>

        {/* Hero illustration card */}
        <div
          className="mb-10 w-full max-w-sm rounded-2xl gradient-primary p-6 animate-fade-up"
          style={{ animationDelay: "240ms" }}
        >
          <div className="flex items-center justify-center gap-5">
            {[Dumbbell, Music, Palette, GraduationCap].map((Icon, i) => (
              <div
                key={i}
                className="flex h-14 w-14 items-center justify-center rounded-xl bg-card/20 backdrop-blur-sm"
              >
                <Icon size={28} className="text-primary-foreground" />
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-sm font-medium text-primary-foreground/90">
            Sports · Music · Dance · Academics
          </p>
        </div>

        {/* CTA */}
        <Button
          onClick={() => navigate("/auth")}
          className="w-full max-w-sm gradient-primary text-primary-foreground h-14 text-base font-semibold rounded-xl shadow-lg shadow-primary/25 active:scale-[0.97] transition-transform animate-fade-up"
          style={{ animationDelay: "320ms" }}
        >
          Get Started
        </Button>

        {/* Feature cards */}
        <div className="mt-10 w-full max-w-sm space-y-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="flex items-start gap-4 rounded-xl bg-card p-4 shadow-sm animate-fade-up"
              style={{ animationDelay: `${400 + i * 80}ms` }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <f.icon size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Admin quick-access section */}
        <div className="mt-8 w-full max-w-sm animate-fade-up" style={{ animationDelay: "660ms" }}>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Admin Access</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-2">
            <button
              onClick={() => navigate("/auth?role=platform_admin")}
              className="flex w-full items-center gap-3 rounded-xl bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <Shield size={20} className="text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Platform Admin</p>
                <p className="text-xs text-muted-foreground">Manage apartments, categories & analytics</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate("/auth?role=apartment_admin")}
              className="flex w-full items-center gap-3 rounded-xl bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
                <Building2 size={20} className="text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Apartment Admin</p>
                <p className="text-xs text-muted-foreground">Approve providers & manage your community</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-muted-foreground">
        Made for apartment communities across India 🇮🇳
      </footer>
    </div>
  );
};

export default Landing;
