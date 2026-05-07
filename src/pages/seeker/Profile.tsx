import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import BottomNav from "@/components/BottomNav";
import { useIncomingInvites } from "@/hooks/useFamilyLinking";
import { useMyEnrollments } from "@/hooks/useSeeker";
import {
  Bell,
  ChevronRight,
  GraduationCap,
  Link2,
  LogOut,
  MapPin,
  Shield,
  Users,
} from "lucide-react";
import { toast } from "sonner";

const Profile = () => {
  const { profile, family, familyMembers, activePersona, familyRole } = useUser();
  const navigate = useNavigate();
  const { data: incomingInvites } = useIncomingInvites(
    profile?.id,
    profile?.email ?? null,
    profile?.mobile_number ?? null
  );
  const { data: activeEnrollments } = useMyEnrollments(profile?.id, "active");
  const pendingInviteCount = incomingInvites?.length ?? 0;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
    toast.success("Logged out");
  };

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  const locationLabel = profile?.seeker_home_address
    ? profile.seeker_home_address.split(",").slice(0, 2).join(", ").trim()
    : null;

  const children = familyMembers.filter(
    (m) => m.relationship === "child" || m.relationship === "grandchild"
  );

  const activeCount = activeEnrollments?.filter(
    (e) => e.status === "active" || e.status === "pending"
  ).length ?? 0;

  const accountItems = [
    ...(family ? [{
      icon: <Link2 size={18} className="text-primary" />,
      bg: "bg-primary/10",
      label: "Manage Family",
      sub: familyRole ? `${familyRole} account` : undefined,
      badge: pendingInviteCount > 0 ? pendingInviteCount : undefined,
      action: () => navigate("/family"),
    }] : []),
    {
      icon: <Bell size={18} className="text-primary" />,
      bg: "bg-primary/10",
      label: "Notifications",
      sub: undefined,
      badge: undefined,
      action: () => navigate("/notifications"),
    },
    {
      icon: <MapPin size={18} className="text-primary" />,
      bg: "bg-primary/10",
      label: "Update Home Location",
      sub: locationLabel ?? "Not set",
      badge: undefined,
      action: () => navigate("/explore"),
    },
    ...(!profile?.is_provider ? [{
      icon: <GraduationCap size={18} className="text-indigo-600" />,
      bg: "bg-indigo-100",
      label: "Become a Provider",
      sub: "List your classes",
      badge: undefined,
      action: () => navigate("/become-provider"),
    }] : [{
      icon: <GraduationCap size={18} className="text-indigo-600" />,
      bg: "bg-indigo-100",
      label: "Provider Dashboard",
      sub: "Manage your classes",
      badge: undefined,
      action: () => navigate("/provider/dashboard"),
    }]),
    ...(profile?.is_platform_admin ? [{
      icon: <Shield size={18} className="text-slate-600" />,
      bg: "bg-slate-100",
      label: "Platform Admin",
      sub: "Manage categories & analytics",
      badge: undefined,
      action: () => navigate("/platform"),
    }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Hero card */}
      <div className="gradient-primary px-4 pt-14 pb-8">
        <div className="mx-auto max-w-lg flex items-center gap-4">
          <Avatar className="h-16 w-16 border-4 border-white/30 shadow-md flex-shrink-0">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-xl font-bold bg-white/20 text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-white text-lg font-bold leading-snug truncate">
              {profile?.full_name ?? "My Profile"}
            </h1>
            <p className="text-white/70 text-xs truncate">{profile?.email}</p>
            {locationLabel && (
              <div className="flex items-center gap-1 mt-1">
                <MapPin size={11} className="text-white/60" />
                <p className="text-white/70 text-xs truncate">{locationLabel}</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="mx-auto max-w-lg mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white/15 px-3 py-2.5 text-center">
            <p className="text-white text-lg font-bold">{activeCount}</p>
            <p className="text-white/60 text-[10px] font-semibold">Active Classes</p>
          </div>
          <div className="rounded-xl bg-white/15 px-3 py-2.5 text-center">
            <p className="text-white text-lg font-bold">{familyMembers.length}</p>
            <p className="text-white/60 text-[10px] font-semibold">Family</p>
          </div>
          <div className="rounded-xl bg-white/15 px-3 py-2.5 text-center">
            <p className="text-white text-lg font-bold">{children.length}</p>
            <p className="text-white/60 text-[10px] font-semibold">Children</p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-lg px-4 py-5 space-y-5">
        {/* Children avatar row */}
        {children.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">Children</p>
              <button
                onClick={() => navigate("/family")}
                className="text-xs text-primary font-medium"
              >
                Manage →
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
              {children.map((child) => {
                const initials = child.full_name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) ?? "?";
                return (
                  <div key={child.id} className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    <Avatar className="h-12 w-12 border-2 border-primary/20">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-[11px] font-medium text-center">
                      {child.full_name?.split(" ")[0]}
                    </p>
                  </div>
                );
              })}
              <button
                onClick={() => navigate("/family")}
                className="flex flex-col items-center gap-1.5 flex-shrink-0"
              >
                <div className="h-12 w-12 rounded-full border-2 border-dashed border-primary/30 flex items-center justify-center">
                  <Users size={18} className="text-primary/40" />
                </div>
                <p className="text-[11px] font-medium text-muted-foreground text-center">Add</p>
              </button>
            </div>
          </div>
        )}

        {/* Account settings list */}
        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Account</p>
          {accountItems.map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-colors hover:bg-accent active:bg-accent/80"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0 ${item.bg}`}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                {item.sub && (
                  <p className="text-[11px] text-muted-foreground capitalize truncate">{item.sub}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {item.badge && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
                <ChevronRight size={16} className="text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>

        {/* Sign out */}
        <div className="pt-2">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-destructive transition-colors hover:bg-destructive/10"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 flex-shrink-0">
              <LogOut size={18} className="text-destructive" />
            </div>
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </div>

      <BottomNav persona={
        activePersona === "platform_admin" ? "platform_admin" :
        activePersona === "provider" ? "provider" : "seeker"
      } />
    </div>
  );
};

export default Profile;
