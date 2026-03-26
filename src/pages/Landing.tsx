import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  UserPlus,
  GraduationCap,
  Music,
  Dumbbell,
  Palette,
  Shield,
  Building2,
  ChevronRight,
  Home,
  BookOpen,
  LayoutDashboard,
  Users,
  LogOut,
  ClipboardList,
  UserCog,
  BarChart3,
  FolderTree,
  MessageCircle,
  Bell,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
// Tabs import removed — using custom colored tab buttons
import { toast } from "sonner";

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

// ─── LOGGED-IN DASHBOARD VIEW ────────────────────────────────────

const LoggedInLanding = () => {
  const navigate = useNavigate();
  const { profile, family, currentApartment, activePersona } = useUser();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
    toast.success("Logged out");
  };

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "";

  // Action items per role
  type ActionItem = { label: string; desc: string; icon: typeof Home; path: string; color: string; bgColor: string };

  const residentActions: ActionItem[] = [
    { label: "Home", desc: "Browse classes in your community", icon: Home, path: "/home", color: "text-primary", bgColor: "bg-primary/10" },
    { label: "Explore Classes", desc: "Search & discover new classes", icon: Search, path: "/explore", color: "text-primary", bgColor: "bg-primary/10" },
    { label: "My Classes", desc: "View enrollments & schedules", icon: BookOpen, path: "/my-classes", color: "text-primary", bgColor: "bg-primary/10" },
    { label: "Messages", desc: "Chat with providers", icon: MessageCircle, path: "/chat", color: "text-primary", bgColor: "bg-primary/10" },
  ];

  const providerActions: ActionItem[] = [
    { label: "Provider Dashboard", desc: "Manage classes, students & payments", icon: LayoutDashboard, path: "/provider/dashboard", color: "text-indigo-600", bgColor: "bg-indigo-500/10" },
    { label: "My Classes", desc: "Create & manage your class listings", icon: BookOpen, path: "/provider/classes", color: "text-indigo-600", bgColor: "bg-indigo-500/10" },
    { label: "My Students", desc: "View enrollments & take attendance", icon: Users, path: "/provider/students", color: "text-indigo-600", bgColor: "bg-indigo-500/10" },
    { label: "Messages", desc: "Chat with students & parents", icon: MessageCircle, path: "/provider-chat", color: "text-indigo-600", bgColor: "bg-indigo-500/10" },
  ];

  const adminActions: ActionItem[] = [
    { label: "Admin Dashboard", desc: "Manage your apartment community", icon: Building2, path: "/admin/dashboard", color: "text-indigo-600", bgColor: "bg-indigo-500/10" },
    { label: "Manage Providers", desc: "Approve & manage service providers", icon: UserCog, path: "/admin/providers", color: "text-indigo-600", bgColor: "bg-indigo-500/10" },
    { label: "Admin Reports", desc: "View revenue & commission reports", icon: BarChart3, path: "/admin/reports", color: "text-indigo-600", bgColor: "bg-indigo-500/10" },
  ];

  const platformActions: ActionItem[] = [
    { label: "Platform Dashboard", desc: "Manage the CampusBee platform", icon: Shield, path: "/platform", color: "text-emerald-600", bgColor: "bg-emerald-500/10" },
    { label: "Manage Apartments", desc: "Approve & assign apartment admins", icon: Building2, path: "/platform/apartments", color: "text-emerald-600", bgColor: "bg-emerald-500/10" },
    { label: "Categories", desc: "Manage class categories", icon: FolderTree, path: "/platform/categories", color: "text-emerald-600", bgColor: "bg-emerald-500/10" },
    { label: "Platform Analytics", desc: "Growth & city-wise metrics", icon: BarChart3, path: "/platform/analytics", color: "text-emerald-600", bgColor: "bg-emerald-500/10" },
  ];

  // Build tabs in precedence order with accent colors
  const tabs = useMemo(() => {
    const t: { id: string; label: string; icon: typeof Home; activeClass: string; inactiveClass: string }[] = [];
    if (profile?.is_platform_admin) t.push({
      id: "platform", label: "Platform", icon: Shield,
      activeClass: "bg-emerald-600 text-white shadow-sm shadow-emerald-200",
      inactiveClass: "text-emerald-700 bg-emerald-50 hover:bg-emerald-100",
    });
    if (profile?.is_apartment_admin) t.push({
      id: "admin", label: "Admin", icon: Building2,
      activeClass: "bg-indigo-600 text-white shadow-sm shadow-indigo-200",
      inactiveClass: "text-indigo-700 bg-indigo-50 hover:bg-indigo-100",
    });
    if (profile?.is_provider) t.push({
      id: "provider", label: "Provider", icon: GraduationCap,
      activeClass: "bg-indigo-600 text-white shadow-sm shadow-indigo-200",
      inactiveClass: "text-indigo-700 bg-indigo-50 hover:bg-indigo-100",
    });
    t.push({
      id: "resident", label: "Resident", icon: Home,
      activeClass: "bg-primary text-primary-foreground shadow-sm shadow-primary/20",
      inactiveClass: "text-primary bg-primary/10 hover:bg-primary/15",
    });
    return t;
  }, [profile]);

  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "resident");

  const renderActionList = (actions: ActionItem[]) => (
    <div className="space-y-2">
      {actions.map((action) => (
        <button
          key={action.path}
          onClick={() => navigate(action.path === "/provider-chat" ? "/chat" : action.path)}
          className="flex w-full items-center gap-3 rounded-xl bg-card p-3.5 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${action.bgColor}`}>
            <action.icon size={20} className={action.color} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{action.label}</p>
            <p className="text-xs text-muted-foreground truncate">{action.desc}</p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground shrink-0" />
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <img src="/logo-icon.png" alt="CampusBee" className="h-8 w-8 object-contain" />
            <h1 className="text-sm font-extrabold gradient-primary-text">CampusBee</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/notifications")}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-accent"
            >
              <Bell size={18} className="text-muted-foreground" />
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-accent"
            >
              <Settings size={18} className="text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 py-6 space-y-5">
        {/* Welcome card */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-border">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold truncate">
                Welcome, {profile?.full_name?.split(" ")[0] || "User"}!
              </p>
              {currentApartment ? (
                <p className="text-xs text-muted-foreground truncate">
                  {currentApartment.name} · {currentApartment.locality}
                </p>
              ) : (
                <p className="text-xs text-amber-600 font-medium">
                  Complete setup to explore classes
                </p>
              )}
            </div>
          </div>

          {/* Role badges */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {family && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                <Home size={10} /> Resident
              </span>
            )}
            {profile?.is_provider && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                <GraduationCap size={10} /> Provider
              </span>
            )}
            {profile?.is_apartment_admin && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                <Building2 size={10} /> Apt Admin
              </span>
            )}
            {profile?.is_platform_admin && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                <Shield size={10} /> Platform Admin
              </span>
            )}
          </div>
        </Card>

        {/* Role-based tabs */}
        {tabs.length > 1 ? (
          <div className="space-y-4">
            {/* Tab buttons */}
            <div className="flex gap-2 rounded-xl bg-muted/50 p-1.5">
              {tabs.map((t) => {
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                      isActive ? t.activeClass : t.inactiveClass
                    }`}
                  >
                    <t.icon size={14} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            {activeTab === "platform" && profile?.is_platform_admin && (
              <div className="space-y-4">{renderActionList(platformActions)}</div>
            )}

            {activeTab === "admin" && profile?.is_apartment_admin && (
              <div className="space-y-4">{renderActionList(adminActions)}</div>
            )}

            {activeTab === "provider" && profile?.is_provider && (
              <div className="space-y-4">{renderActionList(providerActions)}</div>
            )}

            {activeTab === "resident" && (
              <div className="space-y-4">
                {!family && (
                  <button
                    onClick={() => navigate("/onboarding")}
                    className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-primary/30 p-4 text-left transition-colors hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <ClipboardList size={20} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-primary">Complete Your Setup</p>
                      <p className="text-xs text-muted-foreground">
                        Select your apartment & add family members to discover classes
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-primary" />
                  </button>
                )}
                {family && renderActionList(residentActions)}
                {!profile?.is_provider && family && (
                  <button
                    onClick={() => navigate("/become-provider")}
                    className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-indigo-300 p-4 text-left transition-colors hover:border-indigo-500 hover:bg-indigo-50 active:scale-[0.98]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
                      <GraduationCap size={20} className="text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-indigo-600">Start Teaching</p>
                      <p className="text-xs text-muted-foreground">
                        Become a provider on CampusBee
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-indigo-400" />
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Single role — no tabs needed, just show resident content */
          <div className="space-y-4">
            {!family && (
              <button
                onClick={() => navigate("/onboarding")}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-primary/30 p-4 text-left transition-colors hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <ClipboardList size={20} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-primary">Complete Your Setup</p>
                  <p className="text-xs text-muted-foreground">
                    Select your apartment & add family members to discover classes
                  </p>
                </div>
                <ChevronRight size={16} className="text-primary" />
              </button>
            )}
            {family && renderActionList(residentActions)}
            {!profile?.is_provider && family && (
              <button
                onClick={() => navigate("/become-provider")}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-indigo-300 p-4 text-left transition-colors hover:border-indigo-500 hover:bg-indigo-50 active:scale-[0.98]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
                  <GraduationCap size={20} className="text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-indigo-600">Start Teaching</p>
                  <p className="text-xs text-muted-foreground">
                    Become a provider on CampusBee
                  </p>
                </div>
                <ChevronRight size={16} className="text-indigo-400" />
              </button>
            )}
          </div>
        )}

        <Separator />

        {/* Logout */}
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut size={18} />
          Log Out
        </Button>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-muted-foreground">
        Made for apartment communities across India 🇮🇳
      </footer>
    </div>
  );
};

// ─── GUEST (LOGGED-OUT) LANDING PAGE ─────────────────────────────

const GuestLanding = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero */}
      <div className="flex flex-1 flex-col items-center px-6 pt-8 pb-8">
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

      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-muted-foreground">
        Made for apartment communities across India 🇮🇳
      </footer>
    </div>
  );
};

// ─── MAIN LANDING COMPONENT ──────────────────────────────────────

const ROLE_STORAGE_KEY = "campusbee_intended_role";

const Landing = () => {
  const { session, profile, loading } = useUser();
  const navigate = useNavigate();
  const [profileTimeout, setProfileTimeout] = useState(false);

  // Give profile fetch up to 5 seconds before showing the page anyway
  useEffect(() => {
    if (session && !profile && !loading) {
      const timer = setTimeout(() => setProfileTimeout(true), 5000);
      return () => clearTimeout(timer);
    }
    if (profile) setProfileTimeout(false);
  }, [session, profile, loading]);

  // After OAuth callback lands on "/", check if there's a pending admin
  // role redirect stored before the OAuth flow began
  useEffect(() => {
    if (!session || !profile) return;
    const pendingRole = localStorage.getItem(ROLE_STORAGE_KEY);
    if (!pendingRole) return;

    localStorage.removeItem(ROLE_STORAGE_KEY);

    if (pendingRole === "platform_admin" && profile.is_platform_admin) {
      navigate("/platform", { replace: true });
    } else if (pendingRole === "apartment_admin" && profile.is_apartment_admin) {
      navigate("/admin/dashboard", { replace: true });
    }
    // If role doesn't match, just stay on landing (normal logged-in view)
  }, [session, profile, navigate]);

  // Show loading only during initial auth check
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo-icon.png" alt="CampusBee" className="h-12 w-12 object-contain animate-fade-in" />
          <p className="text-muted-foreground text-sm animate-fade-up">Loading...</p>
        </div>
      </div>
    );
  }

  // Brief wait for profile after OAuth return (max 5s)
  if (session && !profile && !profileTimeout) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo-icon.png" alt="CampusBee" className="h-12 w-12 object-contain animate-fade-in" />
          <p className="text-muted-foreground text-sm animate-fade-up">Setting up...</p>
        </div>
      </div>
    );
  }

  // Session exists but profile failed to load after timeout — show helpful state
  if (session && !profile && profileTimeout) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <img src="/logo-icon.png" alt="CampusBee" className="h-12 w-12 object-contain" />
          <p className="text-sm text-muted-foreground">
            Having trouble loading your profile.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground"
            >
              Retry
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/auth";
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground"
            >
              Sign in again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If profile loaded, show logged-in hub. Otherwise show guest page.
  return (session && profile) ? <LoggedInLanding /> : <GuestLanding />;
};

export default Landing;
