import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateSeekerLocation, type LocationValue } from "@/hooks/useLocation";
import MapplsPicker from "@/components/location/MapplsPicker";
import {
  ArrowRight,
  Bell,
  BookOpen,
  ChevronRight,
  Code2,
  Dumbbell,
  GraduationCap,
  Home,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageCircle,
  Music,
  Palette,
  Pencil,
  Play,
  Search,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ── Design tokens (indigo accent, matching seeker-theme) ─────────────

const A_FROM  = "oklch(0.78 0.18 250)";
const A_TO    = "oklch(0.62 0.20 250)";
const A_DEEP  = "oklch(0.45 0.18 250)";
const A_SOFT  = "oklch(0.97 0.03 250)";
const A_RING  = "oklch(0.62 0.20 250 / 0.22)";
const INK     = "#0F172A";
const MUTED   = "#64748B";
const HAIR    = "#E2E8F0";
const PAGE    = "#FAFAF9";

/** Return the first comma-segment of an address, capped at 30 chars. */
function shortAddr(address: string): string {
  const first = address.split(",")[0]?.trim() ?? address;
  return first.length > 30 ? first.slice(0, 28) + "…" : first;
}

// ─────────────────────────────────────────────────────────────────────
//  GUEST LANDING
// ─────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { icon: Trophy,       name: "Sports",    count: 1840, hue: 16  },
  { icon: Music,        name: "Music",     count: 980,  hue: 285 },
  { icon: Sparkles,     name: "Dance",     count: 720,  hue: 330 },
  { icon: Palette,      name: "Arts",      count: 540,  hue: 200 },
  { icon: GraduationCap,name: "Academics", count: 2640, hue: 240 },
  { icon: Code2,        name: "Coding",    count: 460,  hue: 220 },
];

const HOW_IT_WORKS = [
  {
    n: "01",
    t: "Set your home location",
    s: "We show classes within walking or driving distance.",
  },
  {
    n: "02",
    t: "Compare & book a free trial",
    s: "Read reviews from learners in your area. Try risk-free.",
  },
  {
    n: "03",
    t: "Enroll & manage in one app",
    s: "Schedules, messages, payments — for everyone in your family.",
  },
];

const TRUST_BADGES = [
  { icon: Shield,       t: "Verified" },
  { icon: Play,         t: "Free trial" },
  { icon: Star,         t: "Real reviews" },
  { icon: IndianRupee,  t: "No hidden fees" },
];

const GuestLanding = () => {
  const navigate = useNavigate();
  const [activeToggle, setActiveToggle] = useState<"learner" | "instructor">("learner");

  return (
    <div style={{ background: PAGE, minHeight: "100vh", color: INK, fontFamily: '-apple-system, "Inter", system-ui, sans-serif' }}>

      {/* ── Top bar ──────────────────────────────────────────────── */}
      <div style={{ padding: "12px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg, ${A_FROM}, ${A_TO})`, color: "#fff", fontWeight: 800, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
            C
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>CampusBee</span>
        </div>
        <button
          onClick={() => navigate("/auth")}
          style={{ background: INK, color: "#fff", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          Sign in
        </button>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div style={{ padding: "14px 20px 28px", position: "relative", overflow: "hidden" }}>
        {/* Aurora blobs */}
        <div aria-hidden style={{ position: "absolute", top: -80, right: -60, width: 240, height: 240, borderRadius: "50%", background: A_FROM, filter: "blur(60px)", opacity: 0.4, pointerEvents: "none" }} />
        <div aria-hidden style={{ position: "absolute", bottom: -100, left: -60, width: 240, height: 240, borderRadius: "50%", background: "oklch(0.85 0.15 200)", filter: "blur(60px)", opacity: 0.25, pointerEvents: "none" }} />

        <div style={{ position: "relative" }}>
          {/* Pill badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: A_SOFT, color: A_DEEP, borderRadius: 999, padding: "4px 10px", fontSize: 10, fontWeight: 700, letterSpacing: 0.3, marginBottom: 12 }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: A_TO, display: "inline-block" }} />
            50,000+ learners · 1,800+ instructors
          </div>

          <h1 style={{ fontSize: 35, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1.07, margin: "0 0 10px" }}>
            Classes for every age,{" "}
            <span style={{ display: "block" }}>
              made for your{" "}
              <span style={{ background: `linear-gradient(135deg, ${A_FROM}, ${A_TO})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                neighborhood.
              </span>
            </span>
          </h1>
          <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.5, margin: 0 }}>
            Find verified classes nearby for any age — or list your own.
          </p>
        </div>
      </div>

      {/* ── Toggle ───────────────────────────────────────────────── */}
      <div style={{ padding: "0 20px 16px" }}>
        <div style={{ background: "#fff", border: `1px solid ${HAIR}`, borderRadius: 14, padding: 4, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          <button
            onClick={() => setActiveToggle("learner")}
            style={{
              background: activeToggle === "learner" ? `linear-gradient(135deg, ${A_FROM}, ${A_TO})` : "transparent",
              color: activeToggle === "learner" ? "#fff" : INK,
              border: "none", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 800,
              textAlign: "center", cursor: "pointer", transition: "all 0.15s ease",
            }}
          >
            I'm a learner
          </button>
          <button
            onClick={() => setActiveToggle("instructor")}
            style={{
              background: activeToggle === "instructor" ? INK : "transparent",
              color: activeToggle === "instructor" ? "#fff" : INK,
              border: "none", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 700,
              textAlign: "center", cursor: "pointer", transition: "all 0.15s ease",
            }}
          >
            I'm an instructor
          </button>
        </div>
      </div>

      {/* ── Learner card ─────────────────────────────────────────── */}
      <div style={{ margin: "0 20px 20px", background: "#fff", border: `1px solid ${HAIR}`, borderRadius: 20, padding: 18, boxShadow: "0 8px 24px -16px rgba(15,23,42,0.1)" }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 6px", letterSpacing: -0.3, lineHeight: 1.25 }}>
          Find a class you (or your family) will love.
        </h2>
        <p style={{ fontSize: 12.5, color: MUTED, margin: "0 0 14px", lineHeight: 1.5 }}>
          12,000+ verified classes for every age. Free trials. Real local reviews.
        </p>

        {/* Location-first CTA block */}
        <div style={{ background: A_SOFT, border: `1px solid ${A_RING}`, borderRadius: 14, padding: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: `1px solid ${HAIR}`, borderRadius: 10, padding: "10px 12px" }}>
            <MapPin size={16} style={{ color: A_TO, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: MUTED, flex: 1 }}>HSR Layout, Bengaluru</span>
            <Pencil size={13} style={{ color: MUTED }} />
          </div>
          <button
            onClick={() => navigate("/auth")}
            style={{ marginTop: 8, width: "100%", background: `linear-gradient(135deg, ${A_FROM}, ${A_TO})`, color: "#fff", border: "none", borderRadius: 11, padding: "13px 14px", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: `0 6px 14px -4px ${A_RING}`, cursor: "pointer" }}
          >
            Find classes near me <ArrowRight size={15} />
          </button>
        </div>

        {/* Trust badges */}
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {TRUST_BADGES.map(b => (
            <div key={b.t} style={{ display: "flex", gap: 7, alignItems: "center", background: PAGE, padding: "8px 10px", borderRadius: 9 }}>
              <b.icon size={13} style={{ color: A_TO, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: INK }}>{b.t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Provider card (dark) ──────────────────────────────────── */}
      <div style={{ margin: "0 20px 24px", background: INK, color: "#fff", borderRadius: 20, padding: 18, position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: "50%", background: A_FROM, opacity: 0.3, filter: "blur(40px)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", background: "rgba(255,255,255,0.18)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 999, padding: "4px 10px", fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>
            FOR INSTRUCTORS
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 800, margin: "10px 0 6px", letterSpacing: -0.3, lineHeight: 1.25 }}>
            Build a class business — without the spreadsheets.
          </h2>
          <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.7)", margin: "0 0 14px", lineHeight: 1.5 }}>
            Reach learners of every age nearby. Run payments, attendance & messages in one app.
          </p>

          {/* Proof stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.1)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            {[{ v: "₹84k", l: "Avg / mo" }, { v: "3.2x", l: "Faster fill" }, { v: "0%", l: "Listing fee" }].map(s => (
              <div key={s.l}>
                <div style={{ fontSize: 18, fontWeight: 800, background: `linear-gradient(135deg, ${A_FROM}, ${A_TO})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{s.v}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", fontWeight: 700, letterSpacing: 0.4, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate("/auth")}
            style={{ marginTop: 14, width: "100%", background: `linear-gradient(135deg, ${A_FROM}, ${A_TO})`, color: "#fff", border: "none", borderRadius: 11, padding: "13px 14px", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}
          >
            Become an instructor <ArrowRight size={15} />
          </button>
          <button
            onClick={() => navigate("/auth")}
            style={{ marginTop: 8, width: "100%", background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 11, padding: "12px 14px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}
          >
            <Play size={13} /> Watch demo (90s)
          </button>
        </div>
      </div>

      {/* ── How It Works ─────────────────────────────────────────── */}
      <div style={{ padding: "8px 20px 4px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: A_DEEP, letterSpacing: 1, marginBottom: 4 }}>HOW IT WORKS</div>
        <h3 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4, margin: "0 0 18px", lineHeight: 1.2 }}>
          Three steps to your first class.
        </h3>
        {HOW_IT_WORKS.map((s, i) => (
          <div key={s.n} style={{ display: "flex", gap: 12, paddingBottom: 20, position: "relative" }}>
            {i < HOW_IT_WORKS.length - 1 && (
              <div style={{ position: "absolute", left: 19, top: 42, bottom: 0, width: 2, background: A_RING, borderRadius: 1 }} />
            )}
            <div style={{ width: 40, height: 40, borderRadius: 20, background: `linear-gradient(135deg, ${A_FROM}, ${A_TO})`, color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {s.n}
            </div>
            <div style={{ paddingTop: 4 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: INK }}>{s.t}</div>
              <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3, lineHeight: 1.45 }}>{s.s}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Category grid ────────────────────────────────────────── */}
      <div style={{ padding: "12px 20px 32px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: A_DEEP, letterSpacing: 1, marginBottom: 4 }}>EXPLORE</div>
        <h3 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4, margin: "0 0 14px", lineHeight: 1.2 }}>
          What India learns on CampusBee.
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {CATEGORIES.map(c => (
            <button
              key={c.name}
              onClick={() => navigate("/auth")}
              style={{ background: "#fff", border: `1px solid ${HAIR}`, borderRadius: 14, padding: "12px 10px", textAlign: "left", cursor: "pointer", transition: "box-shadow 0.15s" }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `oklch(0.95 0.04 ${c.hue})`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                <c.icon size={18} style={{ color: `oklch(0.45 0.15 ${c.hue})` }} />
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: INK }}>{c.name}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: MUTED, marginTop: 1 }}>{c.count.toLocaleString("en-IN")}+ classes</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Closer CTA strip ─────────────────────────────────────── */}
      <div style={{ margin: "0 20px 28px", background: `linear-gradient(135deg, ${A_FROM}, ${A_TO})`, borderRadius: 18, padding: "22px 20px", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", right: -40, bottom: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.15)", pointerEvents: "none" }} />
        <h3 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: "0 0 6px", lineHeight: 1.2 }}>
          Find your next favourite class.
        </h3>
        <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)", margin: "0 0 16px", lineHeight: 1.5 }}>
          Free trials. Real reviews. Verified instructors. All within 5 km.
        </p>
        <button
          onClick={() => navigate("/auth")}
          style={{ background: "#fff", color: A_DEEP, border: "none", borderRadius: 11, padding: "11px 18px", fontSize: 14, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}
        >
          Get started free <ArrowRight size={15} style={{ color: A_DEEP }} />
        </button>
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderTop: `1px solid ${HAIR}`, padding: "20px 20px 32px", textAlign: "center" }}>
        <div style={{ display: "flex", gap: 20, justifyContent: "center", marginBottom: 8, fontSize: 12, color: MUTED, fontWeight: 600 }}>
          <span>About</span><span>Help</span><span>Privacy</span><span>Terms</span>
        </div>
        <div style={{ fontSize: 11, color: MUTED }}>© 2026 CampusBee · Built in Bengaluru 🇮🇳</div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
//  LOGGED-IN LANDING  (role-aware)
// ─────────────────────────────────────────────────────────────────────

const LoggedInLanding = () => {
  const navigate = useNavigate();
  const { profile, family, refreshProfile } = useUser();
  const updateLocation = useUpdateSeekerLocation();

  // Location picker sheet
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<LocationValue | null>(null);

  const handleSaveLocation = async () => {
    if (!profile || !pendingLocation) return;
    try {
      await updateLocation.mutateAsync({ userId: profile.id, ...pendingLocation });
      await refreshProfile();
      setShowLocationSheet(false);
      setPendingLocation(null);
      toast.success("Location updated");
    } catch {
      toast.error("Failed to save location");
    }
  };

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

  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const isAdmin    = !!profile?.is_platform_admin;
  const isProvider = !!profile?.is_provider;
  const hasFamily  = !!family;

  // Determine which roles are active
  const activeRoles: string[] = [];
  if (isAdmin)    activeRoles.push("admin");
  if (isProvider) activeRoles.push("provider");
  if (hasFamily)  activeRoles.push("seeker");
  const isMultiRole = activeRoles.length > 1;
  const isNewUser   = activeRoles.length === 0;
  const hasAnyRole  = activeRoles.length >= 1;

  // Users always stay on "/" — no auto-redirect to /explore, /provider/dashboard or /platform.

  return (
    <div className="flex min-h-screen flex-col" style={{ background: PAGE, color: INK, fontFamily: '-apple-system, "Inter", system-ui, sans-serif' }}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(250,250,249,0.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${HAIR}`, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg, ${A_FROM}, ${A_TO})`, color: "#fff", fontWeight: 800, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>C</div>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.3 }}>CampusBee</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/notifications")}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-accent"
          >
            <Bell size={18} className="text-muted-foreground" />
          </button>
          <Avatar className="h-9 w-9 cursor-pointer" onClick={() => navigate("/profile")}>
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback style={{ background: A_SOFT, color: A_DEEP, fontSize: 12, fontWeight: 800 }}>
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      <div className="flex-1 mx-auto w-full max-w-lg px-5 py-6 space-y-5">

        {/* ── Welcome strip ────────────────────────────────────────── */}
        <div style={{ background: `linear-gradient(135deg, ${A_FROM}, ${A_TO})`, borderRadius: 20, padding: "20px 18px", position: "relative", overflow: "hidden", color: "#fff" }}>
          <div aria-hidden style={{ position: "absolute", top: -50, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.15)", pointerEvents: "none" }} />
          <div aria-hidden style={{ position: "absolute", bottom: -60, left: -30, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none" }} />
          <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, letterSpacing: 0.3, marginBottom: 2 }}>
                WELCOME BACK
              </p>
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.3 }}>
                Hi {firstName} 👋
              </h2>
              {profile?.seeker_home_address ? (
                <button
                  onClick={() => setShowLocationSheet(true)}
                  style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.18)", border: "none", borderRadius: 8, padding: "5px 8px", color: "#fff", fontSize: 11, fontWeight: 700, marginTop: 8, cursor: "pointer" }}
                >
                  <MapPin size={11} /> {shortAddr(profile.seeker_home_address)} <Pencil size={9} />
                </button>
              ) : (
                <button
                  onClick={() => setShowLocationSheet(true)}
                  style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "5px 8px", color: "#fff", fontSize: 11, fontWeight: 700, marginTop: 8, cursor: "pointer" }}
                >
                  <MapPin size={11} /> Set home location
                </button>
              )}
            </div>
            <Avatar className="h-12 w-12 border-2" style={{ borderColor: "rgba(255,255,255,0.4)" }}>
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback style={{ background: "rgba(255,255,255,0.25)", color: "#fff", fontWeight: 800, fontSize: 14 }}>
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Role pills — only shown for users who have set up roles */}
          {(hasFamily || isProvider || isAdmin) && (
            <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
              {hasFamily && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.28)", borderRadius: 999, padding: "4px 10px", fontSize: 10, fontWeight: 700 }}>
                  <Home size={10} /> Seeker
                </div>
              )}
              {isProvider && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.28)", borderRadius: 999, padding: "4px 10px", fontSize: 10, fontWeight: 700 }}>
                  <GraduationCap size={10} /> Provider
                </div>
              )}
              {isAdmin && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.28)", borderRadius: 999, padding: "4px 10px", fontSize: 10, fontWeight: 700 }}>
                  <Shield size={10} /> Admin
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Role cards — always visible ───────────────────────────── */}
        <div className="space-y-4">
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 4px", letterSpacing: -0.3 }}>What brings you here?</h3>
            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Choose how you'd like to get started</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Find Classes — go to /explore if already a seeker, else start onboarding */}
            <button
              onClick={() => navigate(hasFamily ? "/explore" : "/onboarding?role=seeker")}
              style={{ background: A_SOFT, border: `2px solid ${A_RING}`, borderRadius: 18, padding: "18px 14px", textAlign: "left", cursor: "pointer", transition: "all 0.15s", display: "flex", flexDirection: "column", gap: 10 }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${A_FROM}, ${A_TO})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Search size={22} color="#fff" />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: A_DEEP, margin: "0 0 3px", lineHeight: 1.2 }}>Find Classes</p>
                <p style={{ fontSize: 11, color: MUTED, margin: 0, lineHeight: 1.4 }}>Discover & enroll in sports, arts & more near you</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: A_DEEP }}>
                {hasFamily ? "Explore →" : "Get started"} <ArrowRight size={11} />
              </div>
            </button>

            {/* Teach Classes — go to /provider/dashboard if already a provider, else start onboarding */}
            <button
              onClick={() => navigate(isProvider ? "/provider/dashboard" : "/onboarding?role=provider")}
              style={{ background: INK, borderRadius: 18, padding: "18px 14px", textAlign: "left", cursor: "pointer", transition: "all 0.15s", display: "flex", flexDirection: "column", gap: 10, position: "relative", overflow: "hidden" }}
            >
              <div aria-hidden style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: A_FROM, opacity: 0.35, filter: "blur(20px)", pointerEvents: "none" }} />
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${A_FROM}, ${A_TO})`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <GraduationCap size={22} color="#fff" />
              </div>
              <div style={{ position: "relative" }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: "0 0 3px", lineHeight: 1.2 }}>Teach Classes</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.4 }}>List classes, manage students & grow your business</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)", position: "relative" }}>
                {isProvider ? "Dashboard →" : "Get started"} <ArrowRight size={11} />
              </div>
            </button>
          </div>

          {/* Platform Admin card — only for admins */}
          {isAdmin && (
            <button
              onClick={() => navigate("/platform")}
              style={{ width: "100%", background: "#fff", border: `1px solid ${HAIR}`, borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", textAlign: "left", boxShadow: "0 4px 12px -6px rgba(15,23,42,0.08)" }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, oklch(0.72 0.16 160), oklch(0.58 0.18 160))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Shield size={22} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>Platform Admin</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Analytics, moderation, providers</div>
              </div>
              <ChevronRight size={16} style={{ color: MUTED, flexShrink: 0 }} />
            </button>
          )}
        </div>

        {/* ── Quick links ───────────────────────────────────────────── */}
        <div style={{ background: "#fff", border: `1px solid ${HAIR}`, borderRadius: 16, overflow: "hidden" }}>
          <button
            onClick={() => navigate("/profile")}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", textAlign: "left", cursor: "pointer", background: "transparent", border: "none", borderBottom: `1px solid ${HAIR}` }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(100,116,139,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Users size={17} style={{ color: MUTED }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>Your profile & family</div>
            </div>
            <ChevronRight size={15} style={{ color: MUTED }} />
          </button>
          <button
            onClick={handleLogout}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", textAlign: "left", cursor: "pointer", background: "transparent", border: "none" }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(225,29,72,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <LogOut size={17} style={{ color: "#e11d48" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e11d48" }}>Log out</div>
            </div>
          </button>
        </div>

        {/* spacer */}
      </div>

      {/* ── Location picker sheet ──────────────────────────────── */}
      <Sheet open={showLocationSheet} onOpenChange={(open) => {
        setShowLocationSheet(open);
        if (!open) setPendingLocation(null);
      }}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>
              {profile?.seeker_home_address ? "Update Your Location" : "Set Your Location"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <MapplsPicker
              value={pendingLocation}
              onChange={setPendingLocation}
              showMap={false}
            />
            <Button
              className="w-full"
              disabled={!pendingLocation || updateLocation.isPending}
              onClick={handleSaveLocation}
            >
              {updateLocation.isPending ? "Saving…" : "Save Location"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
//  ROOT LANDING COMPONENT (auth-state router)
// ─────────────────────────────────────────────────────────────────────

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div style={{ width: 44, height: 44, borderRadius: 13, background: `linear-gradient(135deg, ${A_FROM}, ${A_TO})`, color: "#fff", fontWeight: 800, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>C</div>
          <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
        </div>
      </div>
    );
  }

  if (session && !profile && !profileTimeout) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div style={{ width: 44, height: 44, borderRadius: 13, background: `linear-gradient(135deg, ${A_FROM}, ${A_TO})`, color: "#fff", fontWeight: 800, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>C</div>
          <p className="text-sm text-muted-foreground animate-pulse">Setting up…</p>
        </div>
      </div>
    );
  }

  if (session && !profile && profileTimeout) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div style={{ width: 44, height: 44, borderRadius: 13, background: `linear-gradient(135deg, ${A_FROM}, ${A_TO})`, color: "#fff", fontWeight: 800, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>C</div>
          <p className="text-sm text-muted-foreground">Having trouble loading your profile.</p>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium rounded-lg text-white"
              style={{ background: `linear-gradient(135deg, ${A_FROM}, ${A_TO})` }}
            >
              Retry
            </button>
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground"
            >
              Sign in again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (session && profile) ? <LoggedInLanding /> : <GuestLanding />;
};

export default Landing;
